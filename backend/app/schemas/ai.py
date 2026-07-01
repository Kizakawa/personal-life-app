from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AIChatRequest(BaseModel):
    message: str
    image_base64: str | None = None
    image_mime_type: str | None = None


class AIChatMessage(BaseModel):
    id: int
    role: str
    content: str
    model: str | None = None
    token_input: int | None = None
    token_output: int | None = None
    latency_ms: int | None = None
    error_message: str | None = None
    suggested_action: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AIChatResponse(BaseModel):
    message: AIChatMessage


class AISettingsResponse(BaseModel):
    ai_model: str
    has_api_key: bool
    ai_allow_tasks: bool
    ai_allow_deadlines: bool
    ai_allow_schedule: bool
    ai_allow_study: bool
    ai_allow_grades: bool
    ai_allow_finance: bool
    ai_allow_journal: bool
    ai_allow_people: bool
    ai_allow_class_notes: bool


class AISettingsUpdate(BaseModel):
    gemini_api_key: str | None = None
    ai_model: str | None = None
    ai_allow_tasks: bool | None = None
    ai_allow_deadlines: bool | None = None
    ai_allow_schedule: bool | None = None
    ai_allow_study: bool | None = None
    ai_allow_grades: bool | None = None
    ai_allow_finance: bool | None = None
    ai_allow_journal: bool | None = None
    ai_allow_people: bool | None = None
    ai_allow_class_notes: bool | None = None
