from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship as orm_relationship

from app.database import Base


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    relationship = Column(String, nullable=False)
    birthday = Column(Date, nullable=True)
    phone = Column(String, nullable=True)
    priority_level = Column(Integer, nullable=False, default=3)
    likes = Column(Text, nullable=True)
    dislikes = Column(Text, nullable=True)
    personality_notes = Column(Text, nullable=True)
    conversation_notes = Column(Text, nullable=True)
    gift_ideas = Column(Text, nullable=True)
    important_notes = Column(Text, nullable=True)
    relationship_group = Column(String, nullable=True, default="ban_be")
    closeness_level = Column(String, nullable=True, default="binh_thuong")
    relationship_status = Column(String, nullable=True, default="on_dinh")
    main_contact_channel = Column(String, nullable=True)
    last_contact_date = Column(Date, nullable=True)
    special_date = Column(Date, nullable=True)
    special_date_label = Column(String, nullable=True)
    gift_budget = Column(String, nullable=True)
    safe_topics = Column(Text, nullable=True)
    avoid_topics = Column(Text, nullable=True)
    next_action = Column(Text, nullable=True)
    privacy_level = Column(String, nullable=True, default="normal")
    reminder_enabled = Column(Integer, nullable=False, default=0)
    reminder_interval_days = Column(Integer, nullable=True, default=30)

    notes = orm_relationship(
        "PersonNote",
        back_populates="person",
        cascade="all, delete-orphan",
    )


class PersonNote(Base):
    __tablename__ = "person_notes"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("people.id"), nullable=False, index=True)
    note_date = Column(Date, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    mood = Column(String, nullable=True, default="neutral")
    next_action = Column(Text, nullable=True)
    is_private = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    person = orm_relationship("Person", back_populates="notes")
