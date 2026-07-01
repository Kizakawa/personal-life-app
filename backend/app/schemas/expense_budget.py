from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ExpenseBudgetBase(BaseModel):
    category: str
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2200)
    limit_amount: int = Field(default=0, ge=0)
    note: Optional[str] = None


class ExpenseBudgetCreate(ExpenseBudgetBase):
    pass


class ExpenseBudgetUpdate(BaseModel):
    category: Optional[str] = None
    month: Optional[int] = Field(default=None, ge=1, le=12)
    year: Optional[int] = Field(default=None, ge=2000, le=2200)
    limit_amount: Optional[int] = Field(default=None, ge=0)
    note: Optional[str] = None


class ExpenseBudgetResponse(ExpenseBudgetBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
