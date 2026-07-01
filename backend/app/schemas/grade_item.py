from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GradeItemBase(BaseModel):
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    title: str
    category: str = "process"
    score: Optional[float] = Field(default=None, ge=0)
    max_score: float = Field(default=10, gt=0)
    weight_percent: Optional[float] = Field(default=None, ge=0, le=100)
    note: Optional[str] = None


class GradeItemCreate(GradeItemBase):
    pass


class GradeItemUpdate(BaseModel):
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None
    score: Optional[float] = Field(default=None, ge=0)
    max_score: Optional[float] = Field(default=None, gt=0)
    weight_percent: Optional[float] = Field(default=None, ge=0, le=100)
    note: Optional[str] = None


class GradeItemResponse(GradeItemBase):
    id: int
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
