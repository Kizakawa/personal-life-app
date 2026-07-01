from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ExpenseCategoryBase(BaseModel):
    name: str
    type: str = Field(default="expense", pattern="^(income|expense)$")
    icon: str = "KH"
    color: str = "#64748b"
    default_budget: int = Field(default=0, ge=0)


class ExpenseCategoryCreate(ExpenseCategoryBase):
    value: Optional[str] = None


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = Field(default=None, pattern="^(income|expense)$")
    icon: Optional[str] = None
    color: Optional[str] = None
    default_budget: Optional[int] = Field(default=None, ge=0)


class ExpenseCategoryResponse(ExpenseCategoryBase):
    id: int
    value: str
    is_default: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
