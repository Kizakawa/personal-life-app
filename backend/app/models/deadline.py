from sqlalchemy import Column, Integer, String, Date, DateTime, Text
from datetime import datetime

from app.database import Base


class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    type = Column(String, default="assignment")  
    # assignment, report, exam, presentation, other

    due_date = Column(Date, nullable=False)

    priority = Column(String, default="medium")
    # low, medium, high

    status = Column(String, default="pending")
    # pending, doing, done

    note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)