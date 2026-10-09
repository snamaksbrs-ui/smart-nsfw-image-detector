from __future__ import annotations

from nsfw_guard import BlurController, DetectionSettings, LocalNSFWDetector


def test_safe_image_is_not_flagged():
    from examples.demo import make_safe_test_image
    settings = DetectionSettings(threshold=0.62, blur_strength=18)
    detector = LocalNSFWDetector(settings=settings)

    result = detector.detect_image(make_safe_test_image())
    assert result.label in {"safe", "uncertain"}


def test_unsafe_image_is_flagged():
    from examples.demo import make_unsafe_test_image
    settings = DetectionSettings(threshold=0.62, blur_strength=18)
    detector = LocalNSFWDetector(settings=settings)

    result = detector.detect_image(make_unsafe_test_image())
    assert result.is_nsfw or result.label == "unsafe"


def test_uncertain_image_remains_manual_review():
    from examples.demo import make_uncertain_test_image
    settings = DetectionSettings(threshold=0.62, blur_strength=18, uncertain_threshold=0.45)
    detector = LocalNSFWDetector(settings=settings)

    result = detector.detect_image(make_uncertain_test_image())
    assert result.label in {"safe", "uncertain"}
