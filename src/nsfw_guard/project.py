from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent.parent


def get_project_root() -> Path:
    return ROOT
