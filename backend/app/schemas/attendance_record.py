from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AttendanceRecordBase(BaseModel):
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    session_date: date
    status: str = "present"
    lesson_title: Optional[str] = None
    note: Optional[str] = None


class AttendanceRecordCreate(AttendanceRecordBase):
    pass


class AttendanceRecordUpdate(BaseModel):
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    session_date: Optional[date] = None
    status: Optional[str] = None
    lesson_title: Optional[str] = None
    note: Optional[str] = None


class AttendanceRecordResponse(AttendanceRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
