from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class SubjectBase(BaseModel):
    name: str
    lecturer: Optional[str] = None
    credits: Optional[int] = None
    room: Optional[str] = None
    semester: Optional[str] = None
    attendance_limit: Optional[int] = 3
    target_score: Optional[float] = None
    progress_status: Optional[str] = "not_started"
    note: Optional[str] = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    lecturer: Optional[str] = None
    credits: Optional[int] = None
    room: Optional[str] = None
    semester: Optional[str] = None
    attendance_limit: Optional[int] = None
    target_score: Optional[float] = None
    progress_status: Optional[str] = None
    note: Optional[str] = None


class SubjectResponse(SubjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)