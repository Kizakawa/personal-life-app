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


class ImagePayload(BaseModel):
    base64: str
    mime_type: str = "image/jpeg"


class ScheduleExtractionResult(BaseModel):
    subject_name: str
    day_of_week: int  # 1 = Chủ nhật, 2 = Thứ 2, ..., 7 = Thứ 7
    start_time: str   # Format "HH:MM", chuẩn 24h
    end_time: str     # Format "HH:MM", chuẩn 24h
    room: str | None = None
    teacher: str | None = None
    note: str | None = None
    missing_info: str | None = None


from pydantic import Field


class QuickScheduleRequest(BaseModel):
    prompt: str = ""
    image_base64: str | None = None
    image_mime_type: str | None = "image/jpeg"
    images: list[ImagePayload] = Field(default_factory=list, max_length=7)


class QuickScheduleResponse(BaseModel):
    success: bool
    message: str
    data: dict | None = None


from enum import Enum
from typing import Any


class ActionType(str, Enum):
    ADD = "ADD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    VIEW = "VIEW"
    UNKNOWN = "UNKNOWN"


class ScheduleDraft(BaseModel):
    schedule_id: int | None = None
    subject_name: str | None = None
    day_of_week: int | None = None  # 1 = Chủ nhật, 2..7 = Thứ 2..7 (hoặc 8 = Chủ nhật)
    start_time: str | None = None  # HH:MM
    end_time: str | None = None  # HH:MM
    room: str | None = None
    teacher: str | None = None
    note: str | None = None


class ScheduleItemDraft(BaseModel):
    id: str | None = None  # UUID tạm thời cho frontend checkbox
    subject_name: str = Field(description="Tên môn học/học phần, chuẩn hóa chữ hoa đầu từ")
    day_of_week: int = Field(description="Thứ trong tuần: 2 (Thứ 2), 3 (Thứ 3), ..., 8 hoặc 1 (Chủ nhật)")
    start_time: str = Field(description="Giờ bắt đầu dạng HH:MM chuẩn 24h, ví dụ 07:00, 13:00")
    end_time: str = Field(description="Giờ kết thúc dạng HH:MM chuẩn 24h, ví dụ 09:30, 17:15")
    room: str | None = Field(None, description="Phòng học, giảng đường (nếu có)")
    teacher: str | None = Field(None, description="Tên giảng viên (nếu có)")
    class_code: str | None = Field(None, description="Mã lớp học phần (nếu có)")
    note: str | None = Field(None, description="Ghi chú thêm nếu có")
    status: str = Field("NEW", description="Trạng thái xung đột: NEW | TIME_OVERLAP | SAME_SUBJECT | ANOTHER_DAY_NOTICE")
    conflict_detail: str | None = Field(None, description="Chi tiết xung đột hoặc thông báo nếu có")
    existing_schedule_id: int | None = Field(None, description="ID lịch học hiện có bị trùng")


class BatchScheduleExtractionResult(BaseModel):
    summary: str = Field(description="Tóm tắt số lượng môn và lịch học tìm thấy trong các ảnh")
    schedules: list[ScheduleItemDraft] = Field(default_factory=list, description="Danh sách các buổi học được bóc tách từ tất cả các ảnh")


class AIParseResult(BaseModel):
    action: ActionType = ActionType.UNKNOWN
    confidence: float = 1.0
    draft: ScheduleDraft = ScheduleDraft()
    target_subject_name: str | None = None
    clarification_needed: str | None = None


class ConflictItem(BaseModel):
    type: str  # "SAME_SUBJECT" | "TIME_OVERLAP" | "ANOTHER_DAY_NOTICE"
    existing_schedule_id: int
    subject_name: str
    day_of_week: int
    start_time: str
    end_time: str
    room: str | None = None
    detail: str


class ProposeActionResponse(BaseModel):
    action: ActionType
    status: str  # "READY_TO_CONFIRM" | "CONFLICT_DETECTED" | "NEED_INFO" | "NO_ACTION" | "BATCH_READY_TO_CONFIRM"
    message: str
    draft: ScheduleDraft = ScheduleDraft()
    conflicts: list[ConflictItem] = []
    batch_drafts: list[ScheduleItemDraft] = Field(default_factory=list)
    summary: str | None = None
    confirmation_payload: dict | None = None


class ExecuteActionRequest(BaseModel):
    action: ActionType
    confirmation_payload: dict
    override_conflict: bool = False


class ExecuteActionResponse(BaseModel):
    success: bool
    message: str
    action: ActionType
    data: dict | None = None


class ExecuteBatchScheduleRequest(BaseModel):
    items: list[ScheduleItemDraft]
    override_conflicts: bool = False


class ExecuteBatchScheduleResponse(BaseModel):
    success: bool
    message: str
    saved_count: int = 0
    created_subjects: list[str] = Field(default_factory=list)
    data: dict | None = None



