from __future__ import annotations

from typing import Any

from PIL import Image, ImageFilter

from .config import DetectionResult, DetectionSettings


class BlurController:
    def __init__(self, settings: DetectionSettings | None = None):
        self.settings = settings or DetectionSettings()

    def should_blur(self, result: DetectionResult) -> bool:
        if not self.settings.enabled:
            return False
        if result.is_nsfw and result.confidence >= self.settings.threshold:
            return True
        return False

    def apply_to_image(self, image: Any, result: DetectionResult, manual_reveal: bool = False) -> Image.Image:
        if manual_reveal and self.settings.allow_manual_override:
            return image
        if not self.should_blur(result):
            return image

        source = image.convert("RGB") if isinstance(image, Image.Image) else Image.open(image).convert("RGB")
        blur_strength = max(1, self.settings.blur_strength)
        if self.settings.blur_method == "gaussian":
            blurred = source.filter(ImageFilter.GaussianBlur(radius=blur_strength))
            overlay = Image.new("RGBA", source.size, (15, 15, 15, 120))
            return Image.alpha_composite(blurred.convert("RGBA"), overlay).convert("RGB")

        overlay = Image.new("RGBA", source.size, (0, 0, 0, 180))
        return Image.alpha_composite(source.convert("RGBA"), overlay).convert("RGB")


class BrowserImageMonitor:
    def __init__(self, detector, blur_controller):
        self.detector = detector
        self.blur_controller = blur_controller
        self._images: dict[str, str] = {}

    def register(self, element_id: str, source: str):
        self._images[element_id] = source

    def refresh(self, element_id: str, source: str | None = None):
        image_source = source or self._images.get(element_id)
        if not image_source:
            return None
        result = self.detector.detect_file(image_source)
        return {
            "element_id": element_id,
            "result": result,
            "blurred": self.blur_controller.should_blur(result),
        }
