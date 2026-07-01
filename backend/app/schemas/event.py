from datetime import date, time

from pydantic import BaseModel, ConfigDict


class EventBase(BaseModel):
    title: str
    event_date: date
    event_time: time | None = None
    event_type: str = "other"
    priority: str = "medium"
    location: str | None = None
    reminder_before: int = 0
    status: str = "upcoming"
    color: str = "#2563eb"
    repeat_type: str = "none"
    note: str | None = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: str | None = None
    event_date: date | None = None
    event_time: time | None = None
    event_type: str | None = None
    priority: str | None = None
    location: str | None = None
    reminder_before: int | None = None
    status: str | None = None
    color: str | None = None
    repeat_type: str | None = None
    note: str | None = None


class EventResponse(EventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
