from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.gamification_event import GamificationEvent

LEVEL_SIZE = 100

ACHIEVEMENT_RULES = [
    {
        "id": "first_win",
        "title": "Khởi động nghiêm túc",
        "description": "Ghi nhận điểm EXP đầu tiên.",
        "condition": lambda data: data["total_points"] >= 10,
    },
    {
        "id": "focus_100",
        "title": "100 phút tập trung",
        "description": "Tích lũy ít nhất 100 phút Pomodoro.",
        "condition": lambda data: data["focus_minutes"] >= 100,
    },
    {
        "id": "task_closer",
        "title": "Người đóng việc",
        "description": "Hoàn thành ít nhất 10 việc hoặc mục học tập.",
        "condition": lambda data: data["completed_items"] >= 10,
    },
    {
        "id": "seven_day_streak",
        "title": "Chuỗi 7 ngày",
        "description": "Có hoạt động học tập hoặc hoàn thành việc trong 7 ngày liên tiếp.",
        "condition": lambda data: data["streak_days"] >= 7,
    },
]


def record_gamification_event(
    db: Session,
    *,
    source_type: str,
    source_id: int | None,
    action: str,
    points: int,
    title: str,
    reason: str | None = None,
    event_date: date | None = None,
    unique: bool = True,
) -> GamificationEvent | None:
    if points <= 0:
        return None

    if unique and source_id is not None:
        existing = (
            db.query(GamificationEvent)
            .filter(
                GamificationEvent.source_type == source_type,
                GamificationEvent.source_id == source_id,
                GamificationEvent.action == action,
            )
            .first()
        )

        if existing:
            return existing

    event = GamificationEvent(
        source_type=source_type,
        source_id=source_id,
        action=action,
        points=points,
        title=title,
        reason=reason,
        event_date=event_date or date.today(),
    )
    db.add(event)
    return event


def calculate_streak(events: list[GamificationEvent]) -> int:
    event_dates = {item.event_date for item in events if item.event_date}
    current = date.today()
    streak = 0

    while current in event_dates:
        streak += 1
        current -= timedelta(days=1)

    return streak


def build_gamification_summary(db: Session) -> dict[str, Any]:
    events = db.query(GamificationEvent).order_by(GamificationEvent.created_at.desc()).all()
    total_points = sum(item.points for item in events)
    level = total_points // LEVEL_SIZE + 1
    points_in_level = total_points % LEVEL_SIZE
    points_to_next_level = LEVEL_SIZE - points_in_level if events else LEVEL_SIZE
    streak_days = calculate_streak(events)

    by_action = defaultdict(int)
    for item in events:
        by_action[item.action] += 1

    focus_minutes = sum(
        int((item.reason or "0").split(" phút")[0])
        for item in events
        if item.action == "complete_focus" and (item.reason or "").split(" phút")[0].isdigit()
    )
    completed_items = by_action["complete_task"] + by_action["complete_workspace_item"]

    achievement_data = {
        "total_points": total_points,
        "focus_minutes": focus_minutes,
        "completed_items": completed_items,
        "streak_days": streak_days,
    }

    achievements = []
    for rule in ACHIEVEMENT_RULES:
        unlocked = bool(rule["condition"](achievement_data))
        achievements.append({
            "id": rule["id"],
            "title": rule["title"],
            "description": rule["description"],
            "unlocked": unlocked,
        })

    return {
        "totalPoints": total_points,
        "level": level,
        "pointsInLevel": points_in_level,
        "pointsToNextLevel": points_to_next_level,
        "levelProgress": round((points_in_level / LEVEL_SIZE) * 100, 1),
        "streakDays": streak_days,
        "focusMinutes": focus_minutes,
        "completedItems": completed_items,
        "achievementCount": len([item for item in achievements if item["unlocked"]]),
        "achievements": achievements,
        "recentEvents": [
            {
                "id": item.id,
                "title": item.title,
                "points": item.points,
                "action": item.action,
                "reason": item.reason,
                "eventDate": str(item.event_date),
                "createdAt": item.created_at.isoformat() if item.created_at else None,
            }
            for item in events[:8]
        ],
    }
