from sqlalchemy import Column, Integer, String, Text, Time

from app.database import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False, default="personal")
    location = Column(String, nullable=True)
    note = Column(Text, nullable=True)