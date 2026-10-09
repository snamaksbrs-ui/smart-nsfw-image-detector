# NSFW Guard

A practical local-first project for detecting unsafe images and automatically blurring them before they are shown to the user.

The project is intentionally designed to be extensible and to protect the user experience without relying on opaque cloud services. It uses a local-detection pipeline with a clear fallback path, and a configurable blur layer that can be applied to images that cross the confidence threshold.

## Features

- Local model integration for NSFW classification with a safe fallback path.
- Optional support for Hugging Face `Falconsai/nsfw_image_detection` when available.
- Automatic Gaussian blur for unsafe images.
- Per-image caching to avoid re-analyzing the same content repeatedly.
- Manual reveal option and settings for sensitivity and blur strength.
- Browser-agnostic monitoring hooks for image elements and dynamic page updates.
- Test coverage for safe, unsafe, uncertain, failing, and repeated image scenarios.

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e .
```

## Quick start

```python
from PIL import Image
from nsfw_guard import DetectionSettings, LocalNSFWDetector, BlurController

settings = DetectionSettings(threshold=0.62, blur_strength=20)
detector = LocalNSFWDetector(settings=settings)
blur = BlurController(settings=settings)

img = Image.new("RGB", (640, 480), color=(240, 240, 240))
result = detector.detect_image(img)
print(result.label, result.confidence)

blurred = blur.apply_to_image(img, result)
```

## Documentation

- `THIRD_PARTY_NOTICES.md` lists upstream projects and re-use conditions.
- `examples/browser_demo/index.html` shows a minimal browser overlay example.
- `tests` contains functional checks for detection and blur behavior.

## Important note

The project prefers local inference to avoid sending user images to third-party services. If a local NSFW model cannot be downloaded or initialized, the engine falls back to a conservative heuristic so the application remains usable without failing closed. This behavior is explicit and should be documented in all UI messaging and logs.
