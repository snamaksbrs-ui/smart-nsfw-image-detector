from __future__ import annotations

from .blur import BlurController
from .config import DetectionSettings
from .engine import LocalNSFWDetector

__all__ = [
    "DetectionSettings",
    "DetectionResult",
    "LocalNSFWDetector",
    "BlurController",
    "BrowserImageMonitor",
    "ImageResultCache",
]

try:
    from .config import DetectionResult
except Exception:  # pragma: no cover
    DetectionResult = None
