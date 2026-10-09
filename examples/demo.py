from __future__ import annotations

from PIL import Image

from nsfw_guard import BlurController, DetectionSettings, LocalNSFWDetector


def run_example() -> None:
    settings = DetectionSettings(threshold=0.62, blur_strength=18)
    detector = LocalNSFWDetector(settings=settings)
    blur_controller = BlurController(settings=settings)

    safe = Image.new("RGB", (800, 600), color=(220, 220, 220))
    unsafe = Image.new("RGB", (800, 600), color=(150, 60, 60))

    safe_result = detector.detect_image(safe)
    unsafe_result = detector.detect_image(unsafe)

    print("safe", safe_result.label, safe_result.confidence)
    print("unsafe", unsafe_result.label, unsafe_result.confidence)
    print("blurred size", blur_controller.apply_to_image(unsafe, unsafe_result).size)


if __name__ == "__main__":
    run_example()
