from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class GamificationEventResponse(BaseModel):
    id: int
    source_type: str
    source_id: Optional[int] = None
    action: str
    points: int
    title: str
    reason: Optional[str] = None
    event_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
