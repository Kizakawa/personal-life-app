from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional


class DeadlineBase(BaseModel):
    title: str
    subject: Optional[str] = None
    type: Optional[str] = "assignment"
    due_date: date
    priority: Optional[str] = "medium"
    status: Optional[str] = "pending"
    note: Optional[str] = None


class DeadlineCreate(DeadlineBase):
    pass


class DeadlineUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    type: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None


class DeadlineResponse(DeadlineBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)