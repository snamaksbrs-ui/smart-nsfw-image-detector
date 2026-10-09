from __future__ import annotations

import io
import hashlib
import time
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageFilter

from .cache import ImageResultCache
from .config import DetectionResult, DetectionSettings


class LocalNSFWDetector:
    def __init__(self, settings: DetectionSettings | None = None, cache: ImageResultCache | None = None):
        self.settings = settings or DetectionSettings()
        self.cache = cache or ImageResultCache(max_size=self.settings.cache_size)
        self._last_error: Exception | None = None
        self._model = None

    def detect_file(self, path: str | Path) -> DetectionResult:
        with Image.open(path) as image:
            return self.detect_image(image, source_key=str(path))

    def detect_image(self, image: Any, source_key: str | None = None) -> DetectionResult:
        if not self.settings.enabled:
            return DetectionResult(
                source_key=source_key or "disabled",
                is_nsfw=False,
                confidence=0.0,
                label="safe",
                model_name="disabled",
                latency_ms=0.0,
                notes="Detection disabled by settings.",
            )

        normalized = self._normalize_image(image)
        key = self._make_key(normalized, source_key)
        cached = self.cache.get(key)
        if cached is not None:
            return cached

        started = time.perf_counter()
        try:
            result = self._detect_with_model(normalized)
        except Exception as exc:  # pragma: no cover - defensive; tests cover fallback path
            self._last_error = exc
            result = self._detect_with_fallback(normalized)

        result.source_key = source_key or key
        result.latency_ms = round((time.perf_counter() - started) * 1000, 2)
        self.cache.set(key, result)
        return result

    def _normalize_image(self, image: Any) -> Image.Image:
        if isinstance(image, str | Path):
            with Image.open(image) as img:
                return img.convert("RGB")
        if isinstance(image, (bytes, bytearray)):
            return Image.open(io.BytesIO(image)).convert("RGB")
        if isinstance(image, np.ndarray):
            img = Image.fromarray(image.astype("uint8"))
            return img.convert("RGB")
        if isinstance(image, Image.Image):
            return image.convert("RGB")
        raise TypeError(f"Unsupported image input type: {type(image)!r}")

    def _make_key(self, image: Image.Image, source_key: str | None) -> str:
        if source_key:
            return source_key
        payload = image.tobytes()
        return hashlib.sha256(payload).hexdigest()

    def _detect_with_model(self, image: Image.Image) -> DetectionResult:
        try:
            from transformers import pipeline
        except ImportError:
            return self._detect_with_fallback(image)

        if self._model is None:
            try:
                self._model = pipeline(
                    "image-classification",
                    model=self.settings.preferred_model,
                    device=-1,
                    top_k=1,
                )
            except Exception as exc:  # pragma: no cover - network or model-availability may fail
                self._last_error = exc
                return self._detect_with_fallback(image)

        try:
            prediction = self._model(image)[0]
            label = str(prediction["label"]).lower()
            score = float(prediction["score"])
            nsfw = "nsfw" in label or "unsafe" in label or "sexual" in label
            if nsfw:
                return DetectionResult(
                    source_key="",
                    is_nsfw=True,
                    confidence=score,
                    label="unsafe",
                    model_name=self.settings.preferred_model,
                    latency_ms=0.0,
                    notes="Detected via the local Hugging Face model when available.",
                )
            return DetectionResult(
                source_key="",
                is_nsfw=False,
                confidence=max(0.0, 1.0 - score),
                label="safe",
                model_name=self.settings.preferred_model,
                latency_ms=0.0,
                notes="Detected via the local Hugging Face model when available.",
            )
        except Exception as exc:  # pragma: no cover
            self._last_error = exc
            return self._detect_with_fallback(image)

    def _detect_with_fallback(self, image: Image.Image) -> DetectionResult:
        arr = np.array(image.convert("RGB"), dtype=np.float32)
        red = arr[:, :, 0]
        green = arr[:, :, 1]
        blue = arr[:, :, 2]

        saturation = np.maximum(0.0, (np.maximum(red, green, blue) - np.minimum(red, green, blue)) / (np.maximum(np.mean(arr, axis=2), 1.0)))
        brightness = np.mean(arr, axis=2)
        edges = np.abs(np.diff(arr, axis=0)).mean() + np.abs(np.diff(arr, axis=1)).mean()

        score = float(np.clip((np.mean(saturation) * 0.8) + (np.mean(edges) / 255.0) * 0.4 + (1.0 - np.mean(brightness / 255.0)) * 0.2, 0.0, 1.0))

        if score >= self.settings.threshold:
            return DetectionResult(
                source_key="",
                is_nsfw=True,
                confidence=round(score, 4),
                label="unsafe",
                model_name="heuristic-fallback",
                latency_ms=0.0,
                notes="Fallback heuristic used because the optional local model was unavailable or failed.",
                details={"saturation": round(float(np.mean(saturation)), 4), "brightness": round(float(np.mean(brightness)), 4)},
            )
        if score >= self.settings.uncertain_threshold:
            return DetectionResult(
                source_key="",
                is_nsfw=False,
                confidence=round(score, 4),
                label="uncertain",
                model_name="heuristic-fallback",
                latency_ms=0.0,
                notes="The image is near the decision boundary. Keep the image visible or require a manual action.",
                details={"saturation": round(float(np.mean(saturation)), 4), "brightness": round(float(np.mean(brightness)), 4)},
            )
        return DetectionResult(
            source_key="",
            is_nsfw=False,
            confidence=round(1.0 - score, 4),
            label="safe",
            model_name="heuristic-fallback",
            latency_ms=0.0,
            notes="Fallback heuristic classifies the image as safe.",
            details={"saturation": round(float(np.mean(saturation)), 4), "brightness": round(float(np.mean(brightness)), 4)},
        )

    @property
    def last_error(self) -> Exception | None:
        return self._last_error
