from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    lecturer = Column(String, nullable=True)
    credits = Column(Integer, nullable=True)
    room = Column(String, nullable=True)
    semester = Column(String, nullable=True)
    attendance_limit = Column(Integer, nullable=True, default=3)
    target_score = Column(Float, nullable=True)

    progress_status = Column(String, nullable=False, default="not_started")
    note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)