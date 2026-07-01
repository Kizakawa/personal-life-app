from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProjectBase(BaseModel):
    name: str
    goal: Optional[str] = None

    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"

    deadline_date: Optional[date] = None

    todo: Optional[str] = None
    current_bug: Optional[str] = None
    solution: Optional[str] = None

    related_files: Optional[str] = None
    note: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None

    status: Optional[str] = None
    priority: Optional[str] = None

    deadline_date: Optional[date] = None

    todo: Optional[str] = None
    current_bug: Optional[str] = None
    solution: Optional[str] = None

    related_files: Optional[str] = None
    note: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)