from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AppSettingBase(BaseModel):
    key: str
    value: Optional[str] = None
    note: Optional[str] = None


class AppSettingCreate(AppSettingBase):
    pass


class AppSettingUpdate(BaseModel):
    value: Optional[str] = None
    note: Optional[str] = None


class AppSettingResponse(AppSettingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)