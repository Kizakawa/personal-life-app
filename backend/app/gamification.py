"""Compatibility shim for older imports.

The real implementation lives in app.services.gamification_service. Keeping this
file prevents stale folders or old PyInstaller builds from reusing the previous
module body, which caused circular imports in portable builds.
"""

from app.services.gamification_service import (
    build_gamification_summary,
    calculate_streak,
    record_gamification_event,
)

__all__ = [
    "build_gamification_summary",
    "calculate_streak",
    "record_gamification_event",
]
