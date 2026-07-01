from sqlalchemy import Column, Date, Integer, String, Text, Time

from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    event_date = Column(Date, nullable=False)
    event_time = Column(Time, nullable=True)
    event_type = Column(String, nullable=False, default="other")
    priority = Column(String, nullable=False, default="medium")
    location = Column(String, nullable=True)
    reminder_before = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="upcoming")
    color = Column(String, nullable=False, default="#2563eb")
    repeat_type = Column(String, nullable=False, default="none")
    note = Column(Text, nullable=True)
