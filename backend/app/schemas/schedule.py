from datetime import time

from pydantic import BaseModel, Field


class ScheduleCreate(BaseModel):
    day_of_week: int = Field(ge=1, le=7)
    start_time: time
    end_time: time
    title: str
    category: str = "personal"
    location: str | None = None
    note: str | None = None


class ScheduleUpdate(ScheduleCreate):
    pass


class ScheduleResponse(ScheduleCreate):
    id: int

    class Config:
        from_attributes = True