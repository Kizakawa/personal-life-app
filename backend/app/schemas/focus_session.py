from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FocusSessionBase(BaseModel):
    title: str = "Phiên tập trung"
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    mode: str = "pomodoro"
    planned_minutes: int = Field(default=25, ge=1, le=240)
    actual_minutes: int = Field(default=25, ge=1, le=240)
    status: str = "completed"
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    note: Optional[str] = None


class FocusSessionCreate(FocusSessionBase):
    pass


class FocusSessionUpdate(BaseModel):
    title: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    mode: Optional[str] = None
    planned_minutes: Optional[int] = Field(default=None, ge=1, le=240)
    actual_minutes: Optional[int] = Field(default=None, ge=1, le=240)
    status: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    note: Optional[str] = None


class FocusSessionResponse(FocusSessionBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
