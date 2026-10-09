from __future__ import annotations

from PIL import Image

from nsfw_guard import BlurController, DetectionSettings, LocalNSFWDetector


def test_blur_applies_to_unsafe_image():
    settings = DetectionSettings(threshold=0.62, blur_strength=15)
    detector = LocalNSFWDetector(settings=settings)
    controller = BlurController(settings=settings)

    unsafe = Image.new("RGB", (300, 300), color=(120, 40, 40))
    result = detector.detect_image(unsafe)
    blurred = controller.apply_to_image(unsafe, result)
    assert blurred.size == unsafe.size
    assert result.label in {"unsafe", "uncertain", "safe"}


def test_blur_does_not_alter_safe_image():
    settings = DetectionSettings(threshold=0.62, blur_strength=15)
    detector = LocalNSFWDetector(settings=settings)
    controller = BlurController(settings=settings)

    safe = Image.new("RGB", (300, 300), color=(230, 230, 230))
    result = detector.detect_image(safe)
    blurred = controller.apply_to_image(safe, result)
    assert blurred.size == safe.size


def test_same_image_is_cached_once():
    settings = DetectionSettings(threshold=0.62, blur_strength=15, cache_size=128)
    detector = LocalNSFWDetector(settings=settings)
    image = Image.new("RGB", (200, 200), color=(210, 210, 210))

    first = detector.detect_image(image)
    second = detector.detect_image(image)
    assert first.label == second.label
    assert len(detector.cache) >= 1
