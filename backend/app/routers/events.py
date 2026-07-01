from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.event import Event
from app.schemas.event import EventCreate, EventResponse, EventUpdate

router = APIRouter(prefix="/events", tags=["Events"])


EVENT_COLUMN_MIGRATIONS = {
    "event_type": "ALTER TABLE events ADD COLUMN event_type VARCHAR NOT NULL DEFAULT 'other'",
    "priority": "ALTER TABLE events ADD COLUMN priority VARCHAR NOT NULL DEFAULT 'medium'",
    "location": "ALTER TABLE events ADD COLUMN location VARCHAR",
    "reminder_before": "ALTER TABLE events ADD COLUMN reminder_before INTEGER NOT NULL DEFAULT 0",
    "status": "ALTER TABLE events ADD COLUMN status VARCHAR NOT NULL DEFAULT 'upcoming'",
    "color": "ALTER TABLE events ADD COLUMN color VARCHAR NOT NULL DEFAULT '#2563eb'",
    "repeat_type": "ALTER TABLE events ADD COLUMN repeat_type VARCHAR NOT NULL DEFAULT 'none'",
}


def ensure_event_columns(db: Session):
    existing_columns = {
        row[1] for row in db.execute(text("PRAGMA table_info(events)")).fetchall()
    }

    for column_name, statement in EVENT_COLUMN_MIGRATIONS.items():
        if column_name not in existing_columns:
            db.execute(text(statement))

    db.commit()


@router.get("", response_model=list[EventResponse])
def get_events(
    event_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    ensure_event_columns(db)

    query = db.query(Event)

    if event_type:
        query = query.filter(Event.event_type == event_type)

    if status:
        query = query.filter(Event.status == status)

    return query.order_by(Event.event_date.asc(), Event.event_time.asc()).all()


@router.post("", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    ensure_event_columns(db)

    new_event = Event(**event.model_dump())
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
):
    ensure_event_columns(db)

    event = db.query(Event).filter(Event.id == event_id).first()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(event, key, value)

    db.commit()
    db.refresh(event)

    return event


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    ensure_event_columns(db)

    event = db.query(Event).filter(Event.id == event_id).first()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()

    return {
        "message": "Event deleted successfully",
        "id": event_id,
    }
