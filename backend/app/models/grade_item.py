from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.database import Base


class GradeItem(Base):
    __tablename__ = "grade_items"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True, index=True)
    subject_name = Column(String, nullable=True, index=True)

    title = Column(String, nullable=False)
    category = Column(String, nullable=False, default="process")
    score = Column(Float, nullable=True)
    max_score = Column(Float, nullable=False, default=10)
    weight_percent = Column(Float, nullable=True)
    note = Column(Text, nullable=True)

    recorded_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
