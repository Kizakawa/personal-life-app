from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class WorkspaceItemBase(BaseModel):
    module: str
    title: str

    category: Optional[str] = None
    status: Optional[str] = "active"
    priority: Optional[str] = "medium"

    subject: Optional[str] = None
    project_name: Optional[str] = None

    target_date: Optional[date] = None

    file_path: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[str] = None
    content: Optional[str] = None


class WorkspaceItemCreate(WorkspaceItemBase):
    pass


class WorkspaceItemUpdate(BaseModel):
    module: Optional[str] = None
    title: Optional[str] = None

    category: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None

    subject: Optional[str] = None
    project_name: Optional[str] = None

    target_date: Optional[date] = None

    file_path: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[str] = None
    content: Optional[str] = None


class WorkspaceItemResponse(WorkspaceItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)