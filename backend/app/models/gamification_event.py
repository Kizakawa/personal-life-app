from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Integer, String, Text

from app.database import Base


class GamificationEvent(Base):
    __tablename__ = "gamification_events"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, nullable=False, index=True)
    source_id = Column(Integer, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    points = Column(Integer, nullable=False, default=0)
    title = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    event_date = Column(Date, nullable=False, default=date.today, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
