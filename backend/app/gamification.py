from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.gamification import build_gamification_summary
from app.models.gamification_event import GamificationEvent
from app.schemas.gamification_event import GamificationEventResponse

router = APIRouter(prefix="/gamification", tags=["Gamification"])


@router.get("/summary")
def get_gamification_summary(db: Session = Depends(get_db)):
    return build_gamification_summary(db)


@router.get("/events", response_model=list[GamificationEventResponse])
def get_gamification_events(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return (
        db.query(GamificationEvent)
        .order_by(GamificationEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
