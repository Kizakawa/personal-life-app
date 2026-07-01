from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.gamification import record_gamification_event
from app.models.focus_session import FocusSession
from app.schemas.focus_session import FocusSessionCreate, FocusSessionResponse, FocusSessionUpdate

router = APIRouter(prefix="/focus", tags=["Focus"])


def serialize_focus_summary(db: Session):
    today = date.today()
    week_start = today - timedelta(days=6)
    today_start = datetime.combine(today, time.min)
    week_start_dt = datetime.combine(week_start, time.min)

    sessions = db.query(FocusSession).filter(FocusSession.status == "completed").all()
    today_sessions = [item for item in sessions if (item.ended_at or item.created_at) and (item.ended_at or item.created_at) >= today_start]
    week_sessions = [item for item in sessions if (item.ended_at or item.created_at) and (item.ended_at or item.created_at) >= week_start_dt]

    total_minutes = sum(item.actual_minutes or 0 for item in sessions)
    today_minutes = sum(item.actual_minutes or 0 for item in today_sessions)
    week_minutes = sum(item.actual_minutes or 0 for item in week_sessions)

    return {
        "totalSessions": len(sessions),
        "totalMinutes": total_minutes,
        "todaySessions": len(today_sessions),
        "todayMinutes": today_minutes,
        "weekSessions": len(week_sessions),
        "weekMinutes": week_minutes,
        "recentSessions": [
            {
                "id": item.id,
                "title": item.title,
                "subjectName": item.subject_name,
                "mode": item.mode,
                "plannedMinutes": item.planned_minutes,
                "actualMinutes": item.actual_minutes,
                "status": item.status,
                "endedAt": item.ended_at.isoformat() if item.ended_at else None,
                "createdAt": item.created_at.isoformat() if item.created_at else None,
            }
            for item in sorted(sessions, key=lambda value: value.created_at or datetime.min, reverse=True)[:8]
        ],
    }


@router.get("/summary")
def get_focus_summary(db: Session = Depends(get_db)):
    return serialize_focus_summary(db)


@router.get("/sessions", response_model=list[FocusSessionResponse])
def get_focus_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return (
        db.query(FocusSession)
        .order_by(FocusSession.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post("/sessions", response_model=FocusSessionResponse)
def create_focus_session(payload: FocusSessionCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    if data.get("status") == "completed" and not data.get("ended_at"):
        data["ended_at"] = datetime.utcnow()
    if not data.get("started_at"):
        data["started_at"] = data.get("ended_at") or datetime.utcnow()

    item = FocusSession(**data)
    db.add(item)
    db.flush()

    if item.status == "completed":
        minutes = max(1, int(item.actual_minutes or item.planned_minutes or 0))
        points = min(40, max(5, minutes // 5 * 2))
        record_gamification_event(
            db,
            source_type="focus_session",
            source_id=item.id,
            action="complete_focus",
            points=points,
            title=f"Hoàn thành {minutes} phút tập trung",
            reason=f"{minutes} phút · {item.subject_name or 'Tự học'}",
        )

    db.commit()
    db.refresh(item)
    return item


@router.put("/sessions/{session_id}", response_model=FocusSessionResponse)
def update_focus_session(session_id: int, payload: FocusSessionUpdate, db: Session = Depends(get_db)):
    item = db.query(FocusSession).filter(FocusSession.id == session_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên tập trung")

    old_status = item.status
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    if item.status == "completed" and not item.ended_at:
        item.ended_at = datetime.utcnow()

    if old_status != "completed" and item.status == "completed":
        minutes = max(1, int(item.actual_minutes or item.planned_minutes or 0))
        points = min(40, max(5, minutes // 5 * 2))
        record_gamification_event(
            db,
            source_type="focus_session",
            source_id=item.id,
            action="complete_focus",
            points=points,
            title=f"Hoàn thành {minutes} phút tập trung",
            reason=f"{minutes} phút · {item.subject_name or 'Tự học'}",
        )

    db.commit()
    db.refresh(item)
    return item


@router.delete("/sessions/{session_id}")
def delete_focus_session(session_id: int, db: Session = Depends(get_db)):
    item = db.query(FocusSession).filter(FocusSession.id == session_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên tập trung")

    db.delete(item)
    db.commit()
    return {"message": "Đã xóa phiên tập trung", "id": session_id}
