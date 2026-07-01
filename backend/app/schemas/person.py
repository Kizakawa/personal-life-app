from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PersonBase(BaseModel):
    full_name: str
    relationship: str
    birthday: date | None = None
    phone: str | None = None
    priority_level: int = Field(default=3, ge=1, le=5)
    likes: str | None = None
    dislikes: str | None = None
    personality_notes: str | None = None
    conversation_notes: str | None = None
    gift_ideas: str | None = None
    important_notes: str | None = None
    relationship_group: str | None = "ban_be"
    closeness_level: str | None = "binh_thuong"
    relationship_status: str | None = "on_dinh"
    main_contact_channel: str | None = None
    last_contact_date: date | None = None
    special_date: date | None = None
    special_date_label: str | None = None
    gift_budget: str | None = None
    safe_topics: str | None = None
    avoid_topics: str | None = None
    next_action: str | None = None
    privacy_level: str | None = "normal"
    reminder_enabled: int = Field(default=0, ge=0, le=1)
    reminder_interval_days: int | None = Field(default=30, ge=1, le=365)


class PersonCreate(PersonBase):
    pass


class PersonUpdate(PersonCreate):
    pass


class PersonResponse(PersonCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class PersonNoteBase(BaseModel):
    note_date: date
    title: str
    content: str | None = None
    mood: str | None = "neutral"
    next_action: str | None = None
    is_private: int = Field(default=0, ge=0, le=1)


class PersonNoteCreate(PersonNoteBase):
    pass


class PersonNoteUpdate(PersonNoteBase):
    pass


class PersonNoteResponse(PersonNoteBase):
    id: int
    person_id: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
