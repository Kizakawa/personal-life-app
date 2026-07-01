from sqlalchemy import Column, Integer, String, Date, Time, Text, ForeignKey, DateTime
from datetime import datetime

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    task_date = Column(Date, nullable=False)

    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)

    priority = Column(String, default="medium")
    # low, medium, high

    status = Column(String, default="pending")
    # pending, doing, done

    note = Column(Text, nullable=True)

    linked_deadline_id = Column(Integer, ForeignKey("deadlines.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)