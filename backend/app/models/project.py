from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Integer, String, Text

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    goal = Column(Text, nullable=True)

    status = Column(String, nullable=False, default="pending")
    priority = Column(String, nullable=False, default="medium")

    deadline_date = Column(Date, nullable=True)

    todo = Column(Text, nullable=True)
    current_bug = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)

    related_files = Column(Text, nullable=True)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)