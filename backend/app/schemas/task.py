from pydantic import BaseModel, ConfigDict
from datetime import date, time, datetime
from typing import Optional


class TaskBase(BaseModel):
    title: str
    task_date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "pending"
    note: Optional[str] = None
    linked_deadline_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    task_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None
    linked_deadline_id: Optional[int] = None


class TaskResponse(TaskBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)