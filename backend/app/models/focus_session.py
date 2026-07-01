from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.database import Base


class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, default="Phiên tập trung")
    subject_id = Column(Integer, nullable=True, index=True)
    subject_name = Column(String, nullable=True, index=True)
    mode = Column(String, nullable=False, default="pomodoro")
    planned_minutes = Column(Integer, nullable=False, default=25)
    actual_minutes = Column(Integer, nullable=False, default=25)
    status = Column(String, nullable=False, default="completed")
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
