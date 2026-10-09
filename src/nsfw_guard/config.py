from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class DetectionSettings:
    enabled: bool = True
    threshold: float = 0.62
    uncertain_threshold: float = 0.45
    blur_strength: int = 20
    blur_method: Literal["gaussian", "overlay"] = "gaussian"
    allow_manual_override: bool = True
    max_parallel: int = 4
    max_image_size: int = 1600
    cache_size: int = 1024
    debug: bool = False
    preferred_model: str = "Falconsai/nsfw_image_detection"
    use_fallback_detector: bool = True


@dataclass
class DetectionResult:
    source_key: str
    is_nsfw: bool
    confidence: float
    label: str
    model_name: str
    latency_ms: float
    notes: str = ""
    details: dict = field(default_factory=dict)

    @property
    def should_blur(self) -> bool:
        return self.is_nsfw and self.confidence >= 0.5
