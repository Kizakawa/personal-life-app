import base64
import json
import os
import re
import uuid
from datetime import datetime, time as dt_time
from typing import Any

from sqlalchemy.orm import Session

from app.models.ai_chat_history import AIChatHistory
from app.models.schedule import Schedule
from app.models.subject import Subject
from app.models.user import User
from app.schemas.ai import (
    ActionType,
    AIParseResult,
    BatchScheduleExtractionResult,
    ConflictItem,
    ExecuteActionRequest,
    ExecuteActionResponse,
    ExecuteBatchScheduleRequest,
    ExecuteBatchScheduleResponse,
    ImagePayload,
    ProposeActionResponse,
    ScheduleDraft,
    ScheduleItemDraft,
)


DAY_LABELS = {
    1: "Chủ nhật",
    2: "Thứ 2",
    3: "Thứ 3",
    4: "Thứ 4",
    5: "Thứ 5",
    6: "Thứ 6",
    7: "Thứ 7",
    8: "Chủ nhật",
}


def normalize_day(day_val: Any) -> int:
    """Chuẩn hóa ngày: 8 hoặc 1 thành 1 (Chủ nhật), 2-7 giữ nguyên."""
    try:
        val = int(day_val)
        if val in (1, 8):
            return 1
        if 2 <= val <= 7:
            return val
        return 2
    except (ValueError, TypeError):
        return 2


def day_to_text(day_val: int | None) -> str:
    if not day_val:
        return "Chưa rõ thứ"
    norm = normalize_day(day_val)
    return DAY_LABELS.get(norm, f"Thứ {norm}")


def normalize_time_str(time_str: str | None) -> str:
    if not time_str:
        return "07:00"
    cleaned = str(time_str).strip().lower().replace("h", ":").replace("g", ":")
    if ":" not in cleaned:
        cleaned += ":00"
    parts = cleaned.split(":")
    hours = int(parts[0]) if parts[0] else 7
    minutes = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    return f"{hours:02d}:{minutes:02d}"


def parse_time_obj(time_str: str) -> dt_time:
    norm = normalize_time_str(time_str)
    parts = norm.split(":")
    return dt_time(int(parts[0]), int(parts[1]))


def normalize_subject_name(name: str | None) -> str:
    if not name:
        return "Môn học"
    cleaned = " ".join(name.strip().split())
    # Capitalize first letter of each word
    return cleaned.title()


def check_time_overlap(s1: dt_time, e1: dt_time, s2: dt_time, e2: dt_time) -> bool:
    """Thuật toán kiểm tra giao nhau giữa 2 khoảng thời gian [S1, E1] và [S2, E2]:
    max(S1, S2) < min(E1, E2)
    """
    return max(s1, s2) < min(e1, e2)


SYSTEM_PROMPT = """Bạn là AI Quản trị Thời khóa biểu thông minh và cẩn trọng.
Nhiệm vụ của bạn là phân tích câu lệnh tiếng Việt của người dùng để xác định đúng Action và trích xuất thông tin lịch học.

Quy tắc phân loại Action:
- "ADD": Khi người dùng muốn thêm môn học/lịch học mới (VD: "thêm môn Toán thứ 2 từ 7h-9h").
- "UPDATE": Khi người dùng muốn đổi giờ, đổi phòng, cập nhật môn (VD: "đổi lịch môn Triết sang 9h sáng thứ 3", "dời môn Lý thứ 4 sang phòng B102").
- "DELETE": Khi người dùng muốn xóa hoặc hủy lịch học, bao gồm:
  + Xóa một môn cụ thể (VD: "xóa môn Thể dục thứ 6", "hủy môn Triết"): draft.subject_name="Tên môn", draft.day_of_week=thứ nếu có.
  + Xóa tất cả môn trong một ngày (VD: "xóa hết các môn trong ngày thứ 2", "xóa các môn thứ hai", "xóa toàn bộ lịch thứ 3"): draft.subject_name="ALL_IN_DAY", draft.day_of_week=số thứ (1..8).
  + Xóa toàn bộ thời khóa biểu (VD: "xóa hết lịch học trong thời khóa biểu", "xóa toàn bộ thời khóa biểu", "xóa hết thời khóa biểu", "clear tkb"): draft.subject_name="ALL", draft.day_of_week=null.
- "VIEW": Khi người dùng hỏi hoặc tra cứu (VD: "hôm nay có môn gì không", "thứ 3 học mấy giờ", "lịch tuần này").

Quy tắc chuẩn hóa dữ liệu:
- day_of_week: Luôn chuyển thành số: Thứ 2 -> 2, Thứ 3 -> 3, ..., Chủ nhật -> 8 hoặc 1.
- start_time, end_time: Định dạng chuẩn 24h "HH:MM" (VD: "7h" -> "07:00", "9 rưỡi tối" -> "21:30").
- Đối với hành động ADD: Bắt buộc phải có tên môn, thứ trong tuần và khung giờ. Nếu thiếu, điền câu hỏi vào clarification_needed.
- Đối với hành động UPDATE: Nếu người dùng chỉ đổi giờ hoặc phòng mà không nhắc đến thứ mới, hãy giữ nguyên day_of_week=null và để clarification_needed=null. Nếu thiếu cả giờ, thứ và phòng mới thì mới hỏi.
- Nếu có ảnh đính kèm (ảnh chụp màn hình thời khóa biểu, ảnh lịch học): Hãy đọc kỹ văn bản trong ảnh (OCR), nhận diện tên môn học, thứ trong tuần, giờ bắt đầu, giờ kết thúc, phòng học, giảng viên và tạo draft cho hành động ADD.

Trả về kết quả TUYỆT ĐỐI tuân thủ schema JSON sau:
{
  "action": "ADD" | "UPDATE" | "DELETE" | "VIEW" | "UNKNOWN",
  "confidence": 1.0,
  "draft": {
    "schedule_id": null,
    "subject_name": "Tên môn học nếu có, hoặc ALL, hoặc ALL_IN_DAY",
    "day_of_week": null hoặc số nguyên (1..8),
    "start_time": "HH:MM" hoặc null,
    "end_time": "HH:MM" hoặc null,
    "room": "Phòng học nếu có" hoặc null,
    "teacher": "Tên giảng viên nếu có" hoặc null,
    "note": "Ghi chú nếu có" hoặc null
  },
  "target_subject_name": "Tên môn học cũ cần sửa hoặc xóa nếu có",
  "clarification_needed": "Câu hỏi làm rõ nếu thiếu thông tin bắt buộc hoặc null"
}
"""


def clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def fallback_rule_parser(prompt: str) -> AIParseResult:
    """Bộ phân tích quy tắc dự phòng tiếng Việt khi không gọi được LLM."""
    text = prompt.strip()
    lower = text.lower()

    # 1. Xác định ActionType
    action = ActionType.UNKNOWN
    if any(k in lower for k in ["xóa", "xoa", "hủy", "huỷ", "huy", "bỏ lịch", "bo lich", "bỏ môn", "bo mon", "delete", "remove", "clear", "dọn", "don"]):
        action = ActionType.DELETE
    elif any(k in lower for k in ["đổi", "doi", "dời", "chuyển", "chuyen", "sửa", "sua", "thay đổi", "thay doi", "cập nhật", "cap nhat", "update"]):
        action = ActionType.UPDATE
    elif any(k in lower for k in ["thêm", "them", "tạo", "tao", "đặt", "dat", "xếp", "xep", "lên lịch", "len lich", "nhập", "nhap", "học môn", "hoc mon", "bổ sung", "bo sung", "add"]):
        action = ActionType.ADD
    elif any(k in lower for k in ["xem", "tra cứu", "tra cuu", "hỏi", "hoi", "có môn gì", "co mon gi", "mấy giờ", "may gio", "lịch hôm nay", "lich hom nay", "lịch ngày mai", "lich ngay mai", "lịch tuần", "lich tuan", "thời khóa biểu", "thoi khoa bieu", "tkb", "view"]):
        action = ActionType.VIEW
    else:
        # Nếu có thông tin thứ + giờ + môn -> mặc định là ADD
        has_day = bool(re.search(r"(?:(?:thứ|thu)\s*[2-7]|chủ\s*nhật|chu\s*nhat|cn|t[2-7]|hôm nay|hom nay|ngày mai|ngay mai)", lower))
        has_time = bool(re.search(r"\d{1,2}(?:h|:\d{2})", lower))
        if has_day and has_time:
            action = ActionType.ADD
        else:
            action = ActionType.VIEW

    # 2. Trích xuất thứ
    day_of_week = None
    day_match = re.search(r"(?:(?:thứ|thu)\s*([2-7]|hai|ba|tư|tu|bốn|bon|năm|nam|sáu|sau|bảy|bay)|chủ\s*nhật|chu\s*nhat|cn|t([2-7]))", lower)
    if day_match:
        matched_str = day_match.group(0).lower()
        if "chủ" in matched_str or "chu" in matched_str or "cn" in matched_str:
            day_of_week = 1
        elif "hai" in matched_str or matched_str.endswith("2"):
            day_of_week = 2
        elif "ba" in matched_str or matched_str.endswith("3"):
            day_of_week = 3
        elif "tư" in matched_str or "tu" in matched_str or "bốn" in matched_str or "bon" in matched_str or matched_str.endswith("4"):
            day_of_week = 4
        elif "năm" in matched_str or "nam" in matched_str or matched_str.endswith("5"):
            day_of_week = 5
        elif "sáu" in matched_str or "sau" in matched_str or matched_str.endswith("6"):
            day_of_week = 6
        elif "bảy" in matched_str or "bay" in matched_str or matched_str.endswith("7"):
            day_of_week = 7
    elif "hôm nay" in lower or "hom nay" in lower:
        py_w = datetime.today().weekday()
        day_of_week = 1 if py_w == 6 else py_w + 2
    elif "ngày mai" in lower or "ngay mai" in lower:
        py_w = (datetime.today().weekday() + 1) % 7
        day_of_week = 1 if py_w == 6 else py_w + 2

    # 3. Trích xuất giờ
    start_time = None
    end_time = None
    time_range_match = re.search(
        r"(?:(?:từ|tu)\s*)?(\d{1,2}(?:h\d{0,2}|:\d{2})?)\s*(?:đến|den|-|tới|toi)\s*(\d{1,2}(?:h\d{0,2}|:\d{2})?)",
        lower,
    )
    if time_range_match:
        start_time = normalize_time_str(time_range_match.group(1))
        end_time = normalize_time_str(time_range_match.group(2))
    else:
        single_time_match = re.search(r"(?:lúc|luc|vào|vao|từ|tu)\s*(\d{1,2}(?:h\d{0,2}|:\d{2})?)", lower)
        if single_time_match:
            start_time = normalize_time_str(single_time_match.group(1))
            st_parts = start_time.split(":")
            end_h = min(int(st_parts[0]) + 2, 23)
            end_time = f"{end_h:02d}:{st_parts[1]}"

    # 4. Trích xuất phòng học
    room = None
    room_match = re.search(r"(?:\bphòng\b|\bphong\b|\btại\b|\btai\b|\bp\.\s*)\s*([A-Za-z0-9\-_]+)", text, re.IGNORECASE)
    if room_match:
        room = room_match.group(1).upper()

    # 5. Trích xuất giảng viên
    teacher = None
    teacher_match = re.search(r"(?:thầy|thay|cô|co|gv|giảng viên|giang vien)\s+([A-Za-zÀ-ỹ\s]+?)(?:,|$|\.|\bở\b|\btại\b|\btai\b)", text, re.IGNORECASE)
    if teacher_match:
        teacher = teacher_match.group(1).strip().title()

    # 6. Trích xuất tên môn học
    subject_name = None
    is_bulk_delete = False

    if action == ActionType.DELETE:
        is_clear_all_keyword = bool(
            re.search(r"(?:xóa|xoa|hủy|huỷ|huy|bỏ|clear|dọn|don)\s+(?:hết|toàn bộ|tất cả|sạch|trắng|het|toan bo|tat ca)\s+(?:lịch\s+học\s+)?(?:trong\s+)?(?:thời khóa biểu|tkb|thoi khoa bieu)?", lower)
            or re.search(r"(?:xóa|xoa|hủy|huỷ|huy|bỏ|clear)\s+(?:thời khóa biểu|thoi khoa bieu|tkb|lịch học|lich hoc)", lower)
            or "xóa hết" in lower or "xoa het" in lower
            or "xóa tất cả" in lower or "xoa tat ca" in lower
            or "xóa toàn bộ" in lower or "xoa toan bo" in lower
        )
        is_all_day_keyword = bool(
            re.search(r"(?:xóa|xoa|hủy|huỷ|huy|bỏ)\s+(?:hết\s+|toàn bộ\s+|tất cả\s+|het\s+|toan bo\s+|tat ca\s+)?(?:các\s+môn|lịch|lịch học|cac mon|lich|lich hoc)?\s*(?:trong\s+|vào\s+|vao\s+)?(?:ngày\s+|ngay\s+)?(?:thứ|thu|chủ nhật|chu nhat|cn|t[2-7]|hôm nay|hom nay|ngày mai|ngay mai)", lower)
        )

        if is_clear_all_keyword and day_of_week is None:
            subject_name = "ALL"
            is_bulk_delete = True
        elif (is_all_day_keyword or is_clear_all_keyword) and day_of_week is not None:
            subject_name = "ALL_IN_DAY"
            is_bulk_delete = True

    if not is_bulk_delete:
        subj_match = re.search(
            r"(?:môn|mon|lịch môn|lich mon|bỏ môn|bo mon|xóa môn|xoa mon|hủy môn|huy mon)\s+([A-Za-zÀ-ỹ0-9\s\-_]+?)(?:\s+(?:vào|vao|lúc|luc|thứ|thu|t[2-7]|sáng|sang|chiều|chieu|tối|toi|ngày|ngay|tại|tai|phòng|phong|p\.|từ|tu|đến|den|tới|toi|sang)|$)",
            text,
            re.IGNORECASE,
        )
        if subj_match:
            candidate = subj_match.group(1).strip()
            candidate = re.sub(r"^(?:hết|toàn bộ|tất cả|các|trong)\s+", "", candidate, flags=re.IGNORECASE).strip()
            noise = ["học", "môn", "lịch", "tiết", "buổi", "thời khóa biểu", "tkb", "học trong thời khóa biểu", "trong thời khóa biểu"]
            if candidate.lower() not in noise and len(candidate) > 1:
                subject_name = normalize_subject_name(candidate)

        if not subject_name and action in (ActionType.ADD, ActionType.UPDATE):
            words = text.split()
            if len(words) >= 2:
                subject_name = normalize_subject_name(" ".join(words[:3]))

    # 7. Kiểm tra thiếu thông tin
    clarification_needed = None
    if action == ActionType.ADD:
        missing = []
        if not subject_name:
            missing.append("tên môn học")
        if day_of_week is None:
            missing.append("thứ trong tuần (ví dụ: Thứ Hai, Thứ Ba)")
        if not start_time or not end_time:
            missing.append("khung giờ học (ví dụ: từ 7h đến 9h)")
        if missing:
            clarification_needed = f"Vui lòng cung cấp thêm {', '.join(missing)} để lên lịch chính xác."
    elif action == ActionType.UPDATE:
        if not subject_name:
            clarification_needed = "Vui lòng cho biết tên môn học bạn muốn thay đổi lịch."
        elif not start_time and not day_of_week and not room:
            clarification_needed = f"Bạn muốn đổi môn {subject_name} sang thứ mấy, khung giờ nào hoặc phòng nào?"
    elif action == ActionType.DELETE:
        if not subject_name and day_of_week is None:
            clarification_needed = "Vui lòng cho biết tên môn học hoặc thứ trong tuần bạn muốn xóa lịch."

    draft = ScheduleDraft(
        subject_name=subject_name,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        room=room,
        teacher=teacher,
    )

    return AIParseResult(
        action=action,
        confidence=0.85,
        draft=draft,
        target_subject_name=subject_name,
        clarification_needed=clarification_needed,
    )


def parse_schedule_agent_prompt(
    prompt: str,
    api_key: str | None = None,
    model: str = "gemini-2.5-flash",
    image_base64: str | None = None,
    image_mime_type: str | None = "image/jpeg",
) -> AIParseResult:
    """Gọi Gemini LLM để phân tích Action và trích xuất dữ liệu, có fallback."""
    if not api_key:
        return fallback_rule_parser(prompt)

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        contents = [prompt]
        if image_base64:
            import base64
            img_clean = image_base64.strip()
            mime = image_mime_type or "image/jpeg"
            if img_clean.startswith("data:") and "," in img_clean:
                header, img_clean = img_clean.split(",", 1)
                if ";" in header:
                    mime = header[5:].split(";", 1)[0] or mime
            image_bytes = base64.b64decode(img_clean)
            contents = [
                prompt,
                types.Part.from_bytes(data=image_bytes, mime_type=mime),
            ]

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        raw_text = clean_json_text(response.text or "{}")
        data = json.loads(raw_text)
        if isinstance(data, list):
            data = data[0] if (len(data) > 0 and isinstance(data[0], dict)) else {}
        elif not isinstance(data, dict):
            data = {}

        action_str = str(data.get("action", "UNKNOWN")).upper()
        action = ActionType(action_str) if action_str in ActionType.__members__ else ActionType.UNKNOWN

        draft_data = data.get("draft") or {}
        day_val = draft_data.get("day_of_week")
        norm_day = normalize_day(day_val) if day_val is not None else None

        start_t = normalize_time_str(draft_data.get("start_time")) if draft_data.get("start_time") else None
        end_t = normalize_time_str(draft_data.get("end_time")) if draft_data.get("end_time") else None
        if start_t and not end_t:
            st_parts = start_t.split(":")
            end_t = f"{min(int(st_parts[0]) + 2, 23):02d}:{st_parts[1]}"

        subj = draft_data.get("subject_name")
        if subj:
            subj = normalize_subject_name(subj)

        draft = ScheduleDraft(
            schedule_id=draft_data.get("schedule_id"),
            subject_name=subj,
            day_of_week=norm_day,
            start_time=start_t,
            end_time=end_t,
            room=draft_data.get("room"),
            teacher=draft_data.get("teacher"),
            note=draft_data.get("note"),
        )

        return AIParseResult(
            action=action,
            confidence=float(data.get("confidence", 1.0)),
            draft=draft,
            target_subject_name=data.get("target_subject_name") or subj,
            clarification_needed=data.get("clarification_needed"),
        )
    except Exception as e:
        print(f"[schedule_agent] LLM parse error: {e}, falling back to rules")
        return fallback_rule_parser(prompt)


def find_conflicts(
    db: Session,
    draft: ScheduleDraft,
    exclude_schedule_id: int | None = None,
) -> list[ConflictItem]:
    """Kiểm tra xung đột trùng tên môn và chồng lấn khung giờ:
    max(S1, S2) < min(E1, E2)
    """
    conflicts: list[ConflictItem] = []
    if draft.day_of_week is None:
        return conflicts

    day_val = normalize_day(draft.day_of_week)
    existing_schedules = (
        db.query(Schedule)
        .filter(Schedule.day_of_week == day_val)
        .all()
    )

    draft_start = parse_time_obj(draft.start_time) if draft.start_time else None
    draft_end = parse_time_obj(draft.end_time) if draft.end_time else None
    draft_subj = (draft.subject_name or "").strip().lower()

    for sch in existing_schedules:
        if exclude_schedule_id and sch.id == exclude_schedule_id:
            continue

        sch_start_str = sch.start_time.strftime("%H:%M")
        sch_end_str = sch.end_time.strftime("%H:%M")
        day_text = day_to_text(sch.day_of_week)

        # 1. Trùng môn trong cùng thứ
        is_same_subject = sch.title.strip().lower() == draft_subj and bool(draft_subj)
        if is_same_subject:
            conflicts.append(
                ConflictItem(
                    type="SAME_SUBJECT",
                    existing_schedule_id=sch.id,
                    subject_name=sch.title,
                    day_of_week=sch.day_of_week,
                    start_time=sch_start_str,
                    end_time=sch_end_str,
                    room=sch.location,
                    detail=f"Môn '{sch.title}' đã có lịch vào {day_text} ({sch_start_str} - {sch_end_str}).",
                )
            )

        # 2. Trùng / chồng chéo khung giờ
        if draft_start and draft_end:
            if check_time_overlap(draft_start, draft_end, sch.start_time, sch.end_time):
                # Tránh lặp nếu đã thêm cùng schedule_id
                if not any(c.existing_schedule_id == sch.id for c in conflicts):
                    conflicts.append(
                        ConflictItem(
                            type="TIME_OVERLAP",
                            existing_schedule_id=sch.id,
                            subject_name=sch.title,
                            day_of_week=sch.day_of_week,
                            start_time=sch_start_str,
                            end_time=sch_end_str,
                            room=sch.location,
                            detail=f"Trùng khung giờ với môn '{sch.title}' ({sch_start_str} - {sch_end_str}).",
                        )
                    )

    # 3. Kiểm tra môn học đã có lịch ở ngày khác trong tuần (nhắc nhở thêm buổi học)
    if draft_subj:
        other_day_schedules = (
            db.query(Schedule)
            .filter(Schedule.day_of_week != day_val)
            .all()
        )
        for sch in other_day_schedules:
            if sch.title.strip().lower() == draft_subj:
                sch_start_str = sch.start_time.strftime("%H:%M")
                sch_end_str = sch.end_time.strftime("%H:%M")
                day_text = day_to_text(sch.day_of_week)
                if not any(c.existing_schedule_id == sch.id for c in conflicts):
                    conflicts.append(
                        ConflictItem(
                            type="ANOTHER_DAY_NOTICE",
                            existing_schedule_id=sch.id,
                            subject_name=sch.title,
                            day_of_week=sch.day_of_week,
                            start_time=sch_start_str,
                            end_time=sch_end_str,
                            room=sch.location,
                            detail=f"Lưu ý: Môn '{sch.title}' đã có 1 buổi học vào {day_text} ({sch_start_str} - {sch_end_str}).",
                        )
                    )

    return conflicts


def parse_multimodal_schedules(
    prompt: str,
    images: list[ImagePayload],
    api_key: str | None = None,
    model: str = "gemini-2.5-flash",
) -> BatchScheduleExtractionResult:
    """Gọi Gemini Multimodal API để quét toàn bộ thời khóa biểu từ danh sách ảnh (tối đa 7 ảnh)."""
    if not images:
        return BatchScheduleExtractionResult(
            summary="Không có ảnh nào được gửi lên.",
            schedules=[],
        )

    if not api_key:
        return BatchScheduleExtractionResult(
            summary="Chưa cấu hình Gemini API Key để quét ảnh thời khóa biểu.",
            schedules=[],
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        contents = []

        # 1. Đóng gói toàn bộ các ảnh đính kèm (tối đa 7 ảnh) vào content parts
        for idx, img in enumerate(images[:7]):
            raw_data = img.base64.strip()
            mime_type = img.mime_type or "image/jpeg"
            if raw_data.startswith("data:") and "," in raw_data:
                header, raw_data = raw_data.split(",", 1)
                if ";" in header:
                    mime_type = header[5:].split(";", 1)[0] or mime_type

            img_bytes = base64.b64decode(raw_data)
            contents.append(
                types.Part.from_bytes(data=img_bytes, mime_type=mime_type)
            )

        # 2. System prompt chuyên sâu OCR bảng biểu thời khóa biểu HSSV tiếng Việt
        instruction = """
Bạn là chuyên gia OCR và phân tích Thời Khóa Biểu đại học/cao đẳng/trung học từ hình ảnh tiếng Việt.
Nhiệm vụ của bạn:
- Quét toàn bộ các ảnh được tải lên (tối đa 7 ảnh). Nếu có nhiều ảnh, hãy tổng hợp dữ liệu từ TẤT CẢ các ảnh, loại bỏ các mục bị chụp trùng lặp hoặc lặp lại cùng môn/thứ/giờ.
- Phân tích các cột/hàng trong bảng: Thứ (Thứ 2 - Chủ Nhật), Tiết học hoặc Khung giờ bắt đầu - kết thúc, Tên môn học/học phần, Phòng học, Giảng viên, Mã lớp học phần (nếu có).
- Quy đổi thứ: Thứ 2 -> 2, Thứ 3 -> 3, Thứ 4 -> 4, Thứ 5 -> 5, Thứ 6 -> 6, Thứ 7 -> 7, Chủ nhật -> 8 hoặc 1.
- Quy đổi tiết học sang khung giờ 24h chuẩn (nếu ảnh chỉ ghi tiết 1-3, tiết 7-9):
  * Ca sáng: Tiết 1-3 (07:00 - 09:25), Tiết 4-6 (09:35 - 12:00)... (hoặc lấy chính xác theo giờ in trên ảnh nếu có).
  * Ca chiều: Tiết 7-9 (12:30 - 14:55), Tiết 10-12 (15:05 - 17:30)...
- Chuẩn hóa tên môn học viết hoa đầu mỗi từ (ví dụ: "Toán Rời Rạc", "Lập Trình Web").
- Trả về danh sách đầy đủ tất cả các buổi học trích xuất được theo đúng schema BatchScheduleExtractionResult.
"""
        user_text = prompt.strip() if prompt.strip() else "Hãy quét toàn bộ ảnh thời khóa biểu và trích xuất tất cả các môn học kèm thời gian vào danh sách."
        contents.append(f"{instruction}\n\nYêu cầu người dùng: {user_text}")

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=BatchScheduleExtractionResult,
                temperature=0.1,
            ),
        )

        raw_text = clean_json_text(response.text or "{}")
        try:
            result = BatchScheduleExtractionResult.model_validate_json(raw_text)
        except Exception:
            parsed_data = json.loads(raw_text)
            if isinstance(parsed_data, list):
                result = BatchScheduleExtractionResult(
                    summary=f"Đã trích xuất được {len(parsed_data)} buổi học từ ảnh.",
                    schedules=[ScheduleItemDraft.model_validate(it) for it in parsed_data if isinstance(it, dict)],
                )
            elif isinstance(parsed_data, dict) and "schedules" in parsed_data:
                result = BatchScheduleExtractionResult.model_validate(parsed_data)
            else:
                raise

        # Gán UUID ngẫu nhiên và chuẩn hóa từng item
        for item in result.schedules:
            if not item.id:
                item.id = str(uuid.uuid4())[:8]
            item.subject_name = normalize_subject_name(item.subject_name)
            item.day_of_week = normalize_day(item.day_of_week)
            item.start_time = normalize_time_str(item.start_time)
            item.end_time = normalize_time_str(item.end_time)

        return result


    except Exception as e:
        print(f"[schedule_agent] Multimodal batch OCR error: {e}")
        return BatchScheduleExtractionResult(
            summary=f"Lỗi khi phân tích ảnh: {str(e)[:160]}",
            schedules=[],
        )


def check_batch_conflicts(db: Session, items: list[ScheduleItemDraft]) -> list[ScheduleItemDraft]:
    """Quét cơ sở dữ liệu để kiểm tra xung đột trùng môn và chồng chéo giờ cho từng môn trong danh sách."""
    for item in items:
        day_val = normalize_day(item.day_of_week)
        item.day_of_week = day_val
        start_t = parse_time_obj(item.start_time)
        end_t = parse_time_obj(item.end_time)
        subj_name_lower = (item.subject_name or "").strip().lower()

        # 1. Quét lịch cùng ngày
        same_day_schedules = (
            db.query(Schedule)
            .filter(Schedule.day_of_week == day_val)
            .all()
        )

        matched_conflict = False
        for sch in same_day_schedules:
            sch_start_str = sch.start_time.strftime("%H:%M")
            sch_end_str = sch.end_time.strftime("%H:%M")
            day_text = day_to_text(sch.day_of_week)

            # Trùng tên môn cùng ngày
            if sch.title.strip().lower() == subj_name_lower and bool(subj_name_lower):
                item.status = "SAME_SUBJECT"
                item.conflict_detail = f"Môn '{sch.title}' đã có lịch vào {day_text} ({sch_start_str} - {sch_end_str})."
                item.existing_schedule_id = sch.id
                matched_conflict = True
                break

            # Chồng chéo khung giờ
            if check_time_overlap(start_t, end_t, sch.start_time, sch.end_time):
                item.status = "TIME_OVERLAP"
                item.conflict_detail = f"Trùng khung giờ với môn '{sch.title}' ({sch_start_str} - {sch_end_str})."
                item.existing_schedule_id = sch.id
                matched_conflict = True
                break

        if matched_conflict:
            continue

        # 2. Kiểm tra môn học đã có lịch vào ngày khác trong tuần
        other_day_schedules = (
            db.query(Schedule)
            .filter(Schedule.day_of_week != day_val)
            .all()
        )
        for sch in other_day_schedules:
            if sch.title.strip().lower() == subj_name_lower and bool(subj_name_lower):
                day_text = day_to_text(sch.day_of_week)
                sch_start_str = sch.start_time.strftime("%H:%M")
                sch_end_str = sch.end_time.strftime("%H:%M")
                item.status = "ANOTHER_DAY_NOTICE"
                item.conflict_detail = f"Lưu ý: Đã có 1 buổi học vào {day_text} ({sch_start_str} - {sch_end_str})."
                break

    return items


def propose_batch_schedule_action(
    prompt: str,
    images: list[ImagePayload],
    db: Session,
    api_key: str | None = None,
    model: str = "gemini-2.5-flash",
) -> ProposeActionResponse:
    """Xử lý trích xuất đa ảnh và tạo đề xuất hàng loạt (Batch Preview)."""
    extraction = parse_multimodal_schedules(prompt, images, api_key=api_key, model=model)

    if not extraction.schedules:
        error_msg = extraction.summary or "Không tìm thấy lịch học nào trong các ảnh đã gửi."
        return ProposeActionResponse(
            action=ActionType.ADD,
            status="NEED_INFO",
            message=f"⚠️ {error_msg}. Hãy thử gửi ảnh rõ nét hơn hoặc chụp gần bảng thời khóa biểu.",
            draft=ScheduleDraft(),
            conflicts=[],
            batch_drafts=[],
            summary=extraction.summary,
        )

    # Quét xung đột từng môn trong danh sách
    checked_items = check_batch_conflicts(db, extraction.schedules)

    has_conflict = any(item.status in ("TIME_OVERLAP", "SAME_SUBJECT") for item in checked_items)
    conflict_count = sum(1 for item in checked_items if item.status in ("TIME_OVERLAP", "SAME_SUBJECT"))

    summary_text = (
        f"🔍 Đã bóc tách thành công **{len(checked_items)}** buổi học từ {len(images)} ảnh thời khóa biểu."
    )
    if has_conflict:
        summary_text += f" (Phát hiện **{conflict_count}** môn có thể bị trùng lịch, vui lòng kiểm tra kỹ trước khi lưu)."

    confirmation_payload = {
        "action": "EXECUTE_BATCH",
        "total_count": len(checked_items),
        "items": [item.model_dump() for item in checked_items],
        "has_conflict": has_conflict,
    }

    return ProposeActionResponse(
        action=ActionType.ADD,
        status="BATCH_READY_TO_CONFIRM",
        message=summary_text,
        draft=ScheduleDraft(subject_name=f"{len(checked_items)} môn từ ảnh"),
        conflicts=[],
        batch_drafts=checked_items,
        summary=summary_text,
        confirmation_payload=confirmation_payload,
    )


def propose_schedule_action(
    prompt: str,
    db: Session,
    api_key: str | None = None,
    model: str = "gemini-2.5-flash",
    image_base64: str | None = None,
    image_mime_type: str | None = "image/jpeg",
    images: list[ImagePayload] | None = None,
) -> ProposeActionResponse:
    """Xử lý đề xuất hành động (Bước 1 của quy trình 2 bước)."""
    # 0. Nếu người dùng đính kèm ảnh (danh sách images hoặc đơn ảnh) -> kích hoạt Batch Multimodal Parser
    effective_images: list[ImagePayload] = []
    if images and len(images) > 0:
        effective_images = images
    elif image_base64:
        effective_images = [ImagePayload(base64=image_base64, mime_type=image_mime_type or "image/jpeg")]

    if effective_images:
        return propose_batch_schedule_action(
            prompt=prompt,
            images=effective_images,
            db=db,
            api_key=api_key,
            model=model,
        )

    lower = prompt.lower().strip()
    parsed = parse_schedule_agent_prompt(
        prompt,
        api_key=api_key,
        model=model,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
    )
    draft = parsed.draft


    # Nếu parser yêu cầu làm rõ thêm thông tin
    if parsed.clarification_needed and parsed.action != ActionType.VIEW:
        target_name = parsed.target_subject_name or draft.subject_name
        if parsed.action == ActionType.UPDATE and target_name and (draft.start_time or draft.room):
            # Người dùng muốn đổi giờ hoặc phòng môn này trên lịch hiện tại, cho phép tìm lịch cũ
            pass
        else:
            return ProposeActionResponse(
                action=parsed.action,
                status="NEED_INFO",
                message=parsed.clarification_needed,
                draft=draft,
                conflicts=[],
            )

    # 1. Xử lý VIEW
    if parsed.action == ActionType.VIEW:
        target_day = draft.day_of_week
        query = db.query(Schedule)
        if target_day:
            query = query.filter(Schedule.day_of_week == target_day)
        if draft.subject_name:
            query = query.filter(Schedule.title.ilike(f"%{draft.subject_name}%"))

        schedules = query.order_by(Schedule.day_of_week, Schedule.start_time).all()

        if not schedules:
            target_desc = f"vào {day_to_text(draft.day_of_week)}" if draft.day_of_week else "hiện tại"
            msg = f"📅 Bạn không có lịch học nào {target_desc}."
        else:
            lines = ["📅 **Thời khóa biểu của bạn:**\n"]
            for sch in schedules:
                room_txt = f", phòng {sch.location}" if sch.location else ""
                lines.append(
                    f"- **{sch.title}**: {day_to_text(sch.day_of_week)} ({sch.start_time.strftime('%H:%M')} - {sch.end_time.strftime('%H:%M')}{room_txt})"
                )
            msg = "\n".join(lines)

        return ProposeActionResponse(
            action=ActionType.VIEW,
            status="NO_ACTION",
            message=msg,
            draft=draft,
            conflicts=[],
        )

    # 2. Xử lý ADD
    if parsed.action == ActionType.ADD:
        if not draft.subject_name or draft.day_of_week is None or not draft.start_time or not draft.end_time:
            return ProposeActionResponse(
                action=ActionType.ADD,
                status="NEED_INFO",
                message="Vui lòng cung cấp đầy đủ tên môn, thứ trong tuần và khung giờ học (ví dụ: Thứ 2 từ 7h đến 9h).",
                draft=draft,
                conflicts=[],
            )

        draft.day_of_week = normalize_day(draft.day_of_week)
        conflicts = find_conflicts(db, draft)

        blocking_conflicts = [c for c in conflicts if c.type in ("SAME_SUBJECT", "TIME_OVERLAP")]
        notices = [c for c in conflicts if c.type == "ANOTHER_DAY_NOTICE"]

        if blocking_conflicts:
            conflict_descs = [c.detail for c in blocking_conflicts]
            conflict_msg = "\n".join([f"- ⚠️ {d}" for d in conflict_descs])
            msg = (
                f"Phát hiện xung đột lịch học khi thêm môn **{draft.subject_name}** vào **{day_to_text(draft.day_of_week)}**:\n"
                f"{conflict_msg}\n\n"
                f"Bạn có muốn **Xóa lịch cũ để ghi đè**, **Đổi giờ khác**, hay **Hủy bỏ**?"
            )
            payload = {
                "action": "ADD",
                "draft": draft.model_dump(),
                "conflict_schedule_ids": [c.existing_schedule_id for c in blocking_conflicts],
                "conflicts": [c.model_dump() for c in blocking_conflicts],
            }
            return ProposeActionResponse(
                action=ActionType.ADD,
                status="CONFLICT_DETECTED",
                message=msg,
                draft=draft,
                conflicts=blocking_conflicts,
                confirmation_payload=payload,
            )

        # Không có xung đột chặn -> Sẵn sàng xác nhận
        room_txt = f", phòng {draft.room}" if draft.room else ""
        teacher_txt = f", GV: {draft.teacher}" if draft.teacher else ""
        notice_txt = ""
        if notices:
            notice_txt = "\n\n" + "\n".join([f"ℹ️ {n.detail}" for n in notices])
        msg = (
            f"Bạn có muốn thêm môn **{draft.subject_name}** vào **{day_to_text(draft.day_of_week)}** "
            f"({draft.start_time} - {draft.end_time}{room_txt}{teacher_txt}) không?{notice_txt}"
        )
        payload = {
            "action": "ADD",
            "draft": draft.model_dump(),
            "conflict_schedule_ids": [],
        }
        return ProposeActionResponse(
            action=ActionType.ADD,
            status="READY_TO_CONFIRM",
            message=msg,
            draft=draft,
            conflicts=notices,
            confirmation_payload=payload,
        )

    # 3. Xử lý UPDATE
    if parsed.action == ActionType.UPDATE:
        target_name = parsed.target_subject_name or draft.subject_name
        if not target_name:
            return ProposeActionResponse(
                action=ActionType.UPDATE,
                status="NEED_INFO",
                message="Vui lòng cho biết tên môn học bạn cần sửa hoặc dời lịch.",
                draft=draft,
                conflicts=[],
            )

        # Tìm lịch học cần sửa
        query = db.query(Schedule).filter(Schedule.title.ilike(f"%{target_name}%"))
        if draft.day_of_week is not None:
            query = query.filter(Schedule.day_of_week == normalize_day(draft.day_of_week))
        target_schedule = query.first()

        if not target_schedule:
            return ProposeActionResponse(
                action=ActionType.UPDATE,
                status="NEED_INFO",
                message=f"Không tìm thấy lịch học nào cho môn '{target_name}'. Vui lòng kiểm tra lại.",
                draft=draft,
                conflicts=[],
            )

        # Chuẩn bị dữ liệu cập nhật
        new_day = normalize_day(draft.day_of_week) if draft.day_of_week is not None else target_schedule.day_of_week
        new_start = draft.start_time if draft.start_time else target_schedule.start_time.strftime("%H:%M")
        new_end = draft.end_time if draft.end_time else target_schedule.end_time.strftime("%H:%M")
        new_room = draft.room if draft.room else target_schedule.location

        updated_draft = ScheduleDraft(
            schedule_id=target_schedule.id,
            subject_name=target_schedule.title,
            day_of_week=new_day,
            start_time=new_start,
            end_time=new_end,
            room=new_room,
            teacher=draft.teacher,
            note=draft.note or target_schedule.note,
        )

        conflicts = find_conflicts(db, updated_draft, exclude_schedule_id=target_schedule.id)
        if conflicts:
            conflict_descs = "\n".join([f"- ⚠️ {c.detail}" for c in conflicts])
            msg = (
                f"Phát hiện xung đột khi cập nhật môn **{target_schedule.title}** sang **{day_to_text(new_day)}** ({new_start} - {new_end}):\n"
                f"{conflict_descs}\n\n"
                f"Bạn có muốn ghi đè lên lịch cũ bị trùng không?"
            )
            payload = {
                "action": "UPDATE",
                "target_schedule_id": target_schedule.id,
                "draft": updated_draft.model_dump(),
                "conflict_schedule_ids": [c.existing_schedule_id for c in conflicts],
                "conflicts": [c.model_dump() for c in conflicts],
            }
            return ProposeActionResponse(
                action=ActionType.UPDATE,
                status="CONFLICT_DETECTED",
                message=msg,
                draft=updated_draft,
                conflicts=conflicts,
                confirmation_payload=payload,
            )

        # Không có xung đột -> Sẵn sàng xác nhận
        old_day_txt = day_to_text(target_schedule.day_of_week)
        old_time_txt = f"{target_schedule.start_time.strftime('%H:%M')} - {target_schedule.end_time.strftime('%H:%M')}"
        new_day_txt = day_to_text(new_day)
        new_time_txt = f"{new_start} - {new_end}"

        msg = (
            f"Bạn có muốn cập nhật môn **{target_schedule.title}**:\n"
            f"- Cũ: {old_day_txt} ({old_time_txt})\n"
            f"- Mới: **{new_day_txt} ({new_time_txt})**"
            f"{f', phòng: {new_room}' if new_room else ''} không?"
        )
        payload = {
            "action": "UPDATE",
            "target_schedule_id": target_schedule.id,
            "draft": updated_draft.model_dump(),
            "old_info": {
                "day_label": old_day_txt,
                "time": old_time_txt,
                "room": target_schedule.location,
            },
            "new_info": {
                "day_label": new_day_txt,
                "time": new_time_txt,
                "room": new_room,
            },
            "conflict_schedule_ids": [],
        }
        return ProposeActionResponse(
            action=ActionType.UPDATE,
            status="READY_TO_CONFIRM",
            message=msg,
            draft=updated_draft,
            conflicts=[],
            confirmation_payload=payload,
        )

    # 4. Xử lý DELETE
    if parsed.action == ActionType.DELETE:
        target_name = (parsed.target_subject_name or draft.subject_name or "").strip()
        
        is_all_schedule = (
            target_name.upper() == "ALL"
            or ("thời khóa biểu" in lower and any(k in lower for k in ["hết", "tất cả", "toàn bộ", "sạch", "xóa"]))
            or (any(k in lower for k in ["xóa hết", "xóa tất cả", "xóa toàn bộ", "clear tkb"]) and draft.day_of_week is None)
        )
        
        is_all_day = (
            target_name.upper() in ["ALL_IN_DAY", "ALL"]
            or any(k in lower for k in ["hết các môn", "tất cả các môn", "các môn", "xóa hết", "xóa tất cả"])
        ) and draft.day_of_week is not None

        # 4a. Xóa toàn bộ thời khóa biểu
        if is_all_schedule:
            all_schedules = db.query(Schedule).all()
            if not all_schedules:
                return ProposeActionResponse(
                    action=ActionType.DELETE,
                    status="NEED_INFO",
                    message="Thời khóa biểu của bạn hiện đang trống, không có lịch học nào để xóa.",
                    draft=draft,
                    conflicts=[],
                )
            
            count = len(all_schedules)
            msg = (
                f"⚠️ Bạn có chắc chắn muốn **xóa toàn bộ {count} tiết học** trong thời khóa biểu không?\n"
                f"*(Lưu ý: Hành động này sẽ làm trống hoàn toàn thời khóa biểu và không thể hoàn tác)*."
            )
            payload = {
                "action": "DELETE",
                "delete_mode": "ALL",
                "count": count,
                "subject_name": "Toàn bộ thời khóa biểu",
            }
            draft.subject_name = "Toàn bộ thời khóa biểu"
            draft.day_of_week = None
            return ProposeActionResponse(
                action=ActionType.DELETE,
                status="READY_TO_CONFIRM",
                message=msg,
                draft=draft,
                conflicts=[],
                confirmation_payload=payload,
            )

        # 4b. Xóa tất cả các môn trong một ngày
        if is_all_day:
            target_day = normalize_day(draft.day_of_week)
            day_schedules = (
                db.query(Schedule)
                .filter(Schedule.day_of_week == target_day)
                .order_by(Schedule.start_time.asc())
                .all()
            )
            day_txt = day_to_text(target_day)
            if not day_schedules:
                return ProposeActionResponse(
                    action=ActionType.DELETE,
                    status="NEED_INFO",
                    message=f"Không tìm thấy lịch học nào vào **{day_txt}** để xóa.",
                    draft=draft,
                    conflicts=[],
                )
            
            count = len(day_schedules)
            items_str = ", ".join(
                [f"**{s.title}** ({s.start_time.strftime('%H:%M')}-{s.end_time.strftime('%H:%M')})" for s in day_schedules]
            )
            msg = (
                f"⚠️ Bạn có chắc chắn muốn **xóa tất cả {count} môn học** vào **{day_txt}** không?\n"
                f"- Các môn sẽ bị xóa: {items_str}\n"
                f"*(Hành động này không thể hoàn tác)*."
            )
            payload = {
                "action": "DELETE",
                "delete_mode": "DAY",
                "day_of_week": target_day,
                "day_label": day_txt,
                "count": count,
                "subject_name": f"Tất cả môn {day_txt}",
                "target_schedule_ids": [s.id for s in day_schedules],
            }
            draft.subject_name = f"Tất cả môn {day_txt}"
            draft.day_of_week = target_day
            return ProposeActionResponse(
                action=ActionType.DELETE,
                status="READY_TO_CONFIRM",
                message=msg,
                draft=draft,
                conflicts=[],
                confirmation_payload=payload,
            )

        # 4c. Xóa một môn học cụ thể
        query = db.query(Schedule)
        if target_name and target_name.upper() not in ["ALL", "ALL_IN_DAY"]:
            query = query.filter(Schedule.title.ilike(f"%{target_name}%"))
        if draft.day_of_week is not None:
            query = query.filter(Schedule.day_of_week == normalize_day(draft.day_of_week))

        target_schedule = query.first()
        if not target_schedule:
            if draft.day_of_week is not None:
                day_txt = day_to_text(normalize_day(draft.day_of_week))
                return ProposeActionResponse(
                    action=ActionType.DELETE,
                    status="NEED_INFO",
                    message=f"Không tìm thấy môn học nào phù hợp vào **{day_txt}** để xóa.",
                    draft=draft,
                    conflicts=[],
                )
            return ProposeActionResponse(
                action=ActionType.DELETE,
                status="NEED_INFO",
                message="Không tìm thấy lịch học cần xóa. Vui lòng kiểm tra lại tên môn hoặc thứ trong tuần.",
                draft=draft,
                conflicts=[],
            )

        day_txt = day_to_text(target_schedule.day_of_week)
        time_txt = f"{target_schedule.start_time.strftime('%H:%M')} - {target_schedule.end_time.strftime('%H:%M')}"
        msg = (
            f"⚠️ Bạn có chắc chắn muốn **xóa** lịch môn **{target_schedule.title}** "
            f"vào **{day_txt}** ({time_txt}) không? (Hành động này không thể hoàn tác)."
        )
        payload = {
            "action": "DELETE",
            "delete_mode": "SINGLE",
            "target_schedule_id": target_schedule.id,
            "subject_name": target_schedule.title,
            "day_label": day_txt,
            "time": time_txt,
        }
        draft.schedule_id = target_schedule.id
        draft.subject_name = target_schedule.title
        draft.day_of_week = target_schedule.day_of_week

        return ProposeActionResponse(
            action=ActionType.DELETE,
            status="READY_TO_CONFIRM",
            message=msg,
            draft=draft,
            conflicts=[],
            confirmation_payload=payload,
        )

    # Trường hợp không xác định được hành động
    return ProposeActionResponse(
        action=ActionType.UNKNOWN,
        status="NEED_INFO",
        message="Tôi chưa hiểu rõ yêu cầu. Bạn có thể nói rõ hơn bạn muốn Thêm, Sửa, Xóa hay Xem thời khóa biểu không?",
        draft=draft,
        conflicts=[],
    )


def execute_schedule_action(
    request: ExecuteActionRequest,
    db: Session,
    current_user: User,
) -> ExecuteActionResponse:
    """Thực thi hành động sau khi người dùng xác nhận (Bước 2 của quy trình 2 bước)."""
    payload = request.confirmation_payload or {}
    action = request.action

    try:
        # Nếu người dùng đồng ý ghi đè -> xóa các lịch cũ bị xung đột
        if request.override_conflict:
            conflict_ids = payload.get("conflict_schedule_ids", [])
            if conflict_ids:
                db.query(Schedule).filter(Schedule.id.in_(conflict_ids)).delete(synchronize_session=False)
                db.flush()

        if action == ActionType.ADD:
            draft_dict = payload.get("draft") or {}
            subj_name = normalize_subject_name(draft_dict.get("subject_name"))
            day_val = normalize_day(draft_dict.get("day_of_week"))
            start_t = parse_time_obj(draft_dict.get("start_time", "07:00"))
            end_t = parse_time_obj(draft_dict.get("end_time", "09:00"))
            room = draft_dict.get("room")
            teacher = draft_dict.get("teacher")
            note = draft_dict.get("note")

            # Tìm hoặc tạo mới Subject
            subject = db.query(Subject).filter(Subject.name.ilike(subj_name)).first()
            created_new_subject = False
            if not subject:
                subject = Subject(
                    name=subj_name,
                    room=room,
                    lecturer=teacher,
                    note=note,
                    progress_status="studying",
                )
                db.add(subject)
                db.flush()
                created_new_subject = True
            else:
                if room and not subject.room:
                    subject.room = room
                if teacher and not subject.lecturer:
                    subject.lecturer = teacher
                if subject.progress_status != "studying":
                    subject.progress_status = "studying"

            new_schedule = Schedule(
                day_of_week=day_val,
                start_time=start_t,
                end_time=end_t,
                title=subject.name,
                category="study",
                location=room,
                note=note,
            )
            db.add(new_schedule)
            db.flush()

            day_txt = day_to_text(day_val)
            time_txt = f"{start_t.strftime('%H:%M')} - {end_t.strftime('%H:%M')}"
            room_txt = f", phòng {room}" if room else ""
            msg = f"✅ Đã thêm môn **{subject.name}** vào **{day_txt}** ({time_txt}{room_txt})."
            if created_new_subject:
                msg += f"\n*(Đã tạo mới môn học '{subject.name}')*"

            result_data = {
                "action": "ADD",
                "schedule_id": new_schedule.id,
                "subject_name": subject.name,
                "day_of_week": day_val,
                "day_label": day_txt,
                "start_time": start_t.strftime("%H:%M"),
                "end_time": end_t.strftime("%H:%M"),
                "room": room,
                "teacher": teacher,
            }

        elif action == ActionType.UPDATE:
            target_id = payload.get("target_schedule_id")
            draft_dict = payload.get("draft") or {}
            target_sch = db.query(Schedule).filter(Schedule.id == target_id).first()
            if not target_sch:
                return ExecuteActionResponse(
                    success=False,
                    message="Không tìm thấy lịch học cần cập nhật.",
                    action=action,
                )

            if draft_dict.get("day_of_week") is not None:
                target_sch.day_of_week = normalize_day(draft_dict["day_of_week"])
            if draft_dict.get("start_time"):
                target_sch.start_time = parse_time_obj(draft_dict["start_time"])
            if draft_dict.get("end_time"):
                target_sch.end_time = parse_time_obj(draft_dict["end_time"])
            if draft_dict.get("room"):
                target_sch.location = draft_dict["room"]
            if draft_dict.get("note"):
                target_sch.note = draft_dict["note"]

            day_txt = day_to_text(target_sch.day_of_week)
            time_txt = f"{target_sch.start_time.strftime('%H:%M')} - {target_sch.end_time.strftime('%H:%M')}"
            msg = f"✅ Đã cập nhật thành công lịch môn **{target_sch.title}** ({day_txt} {time_txt})."

            result_data = {
                "action": "UPDATE",
                "schedule_id": target_sch.id,
                "subject_name": target_sch.title,
                "day_of_week": target_sch.day_of_week,
                "day_label": day_txt,
                "start_time": target_sch.start_time.strftime("%H:%M"),
                "end_time": target_sch.end_time.strftime("%H:%M"),
                "room": target_sch.location,
            }

        elif action == ActionType.DELETE:
            delete_mode = payload.get("delete_mode", "SINGLE")

            if delete_mode == "ALL":
                deleted_count = db.query(Schedule).delete()
                msg = f"🗑️ Đã xóa thành công toàn bộ {deleted_count} tiết học trong thời khóa biểu."
                result_data = {
                    "action": "DELETE",
                    "mode": "ALL",
                    "deleted_count": deleted_count,
                    "subject_name": "Toàn bộ thời khóa biểu",
                }

            elif delete_mode == "DAY":
                target_ids = payload.get("target_schedule_ids", [])
                target_day = payload.get("day_of_week")
                day_lbl = payload.get("day_label") or (day_to_text(target_day) if target_day else "")

                if target_ids:
                    deleted_count = db.query(Schedule).filter(Schedule.id.in_(target_ids)).delete(synchronize_session=False)
                elif target_day is not None:
                    deleted_count = db.query(Schedule).filter(Schedule.day_of_week == target_day).delete(synchronize_session=False)
                else:
                    deleted_count = 0

                msg = f"🗑️ Đã xóa thành công tất cả {deleted_count} môn học vào **{day_lbl}**."
                result_data = {
                    "action": "DELETE",
                    "mode": "DAY",
                    "day_of_week": target_day,
                    "day_label": day_lbl,
                    "deleted_count": deleted_count,
                }

            else:  # SINGLE
                target_id = payload.get("target_schedule_id")
                target_sch = db.query(Schedule).filter(Schedule.id == target_id).first()
                if not target_sch:
                    return ExecuteActionResponse(
                        success=False,
                        message="Không tìm thấy lịch học cần xóa.",
                        action=action,
                    )

                sch_title = target_sch.title
                day_txt = day_to_text(target_sch.day_of_week)
                db.delete(target_sch)
                msg = f"🗑️ Đã xóa thành công lịch môn **{sch_title}** ({day_txt})."

                result_data = {
                    "action": "DELETE",
                    "mode": "SINGLE",
                    "schedule_id": target_id,
                    "subject_name": sch_title,
                    "day_label": day_txt,
                }

        else:
            return ExecuteActionResponse(
                success=False,
                message=f"Hành động '{action}' không hợp lệ để thực thi.",
                action=action,
            )

        # Lưu lịch sử chat AI
        ai_msg = AIChatHistory(
            user_id=current_user.id,
            role="model",
            content=msg,
            suggested_action=json.dumps(result_data, ensure_ascii=False),
        )
        db.add(ai_msg)
        db.commit()

        return ExecuteActionResponse(
            success=True,
            message=msg,
            action=action,
            data=result_data,
        )

    except Exception as e:
        db.rollback()
        return ExecuteActionResponse(
            success=False,
            message=f"Lỗi khi thực thi: {str(e)}",
            action=action,
        )


def execute_batch_schedule_action(
    request: ExecuteBatchScheduleRequest,
    db: Session,
    current_user: User,
) -> ExecuteBatchScheduleResponse:
    """Lưu hàng loạt các môn học được chọn từ thẻ Batch Preview vào Database."""
    items_to_save = request.items
    if not items_to_save:
        return ExecuteBatchScheduleResponse(
            success=False,
            message="Không có môn học nào được chọn để lưu.",
            saved_count=0,
        )

    saved_count = 0
    created_subjects: list[str] = []

    try:
        for item in items_to_save:
            # 1. Ghi đè xung đột nếu người dùng bật override_conflicts
            if request.override_conflicts and item.existing_schedule_id:
                db.query(Schedule).filter(Schedule.id == item.existing_schedule_id).delete(synchronize_session=False)
                db.flush()

            # 2. Tìm hoặc tự động tạo mới Môn học (Subject)
            subj_name = normalize_subject_name(item.subject_name)
            subject = db.query(Subject).filter(Subject.name.ilike(subj_name)).first()
            if not subject:
                subject = Subject(
                    name=subj_name,
                    room=item.room,
                    lecturer=item.teacher,
                    note=item.note,
                    progress_status="studying",
                )
                db.add(subject)
                db.flush()
                if subj_name not in created_subjects:
                    created_subjects.append(subj_name)
            else:
                if item.room and not subject.room:
                    subject.room = item.room
                if item.teacher and not subject.lecturer:
                    subject.lecturer = item.teacher
                if subject.progress_status != "studying":
                    subject.progress_status = "studying"

            # 3. Tạo bản ghi Thời khóa biểu (Schedule)
            day_val = normalize_day(item.day_of_week)
            start_t = parse_time_obj(item.start_time)
            end_t = parse_time_obj(item.end_time)

            note_parts = []
            if item.teacher:
                note_parts.append(f"GV: {item.teacher}")
            if item.class_code:
                note_parts.append(f"Lớp: {item.class_code}")
            if item.note:
                note_parts.append(item.note)
            schedule_note = " · ".join(note_parts) if note_parts else None

            new_schedule = Schedule(
                day_of_week=day_val,
                start_time=start_t,
                end_time=end_t,
                title=subject.name,
                category="study",
                location=item.room,
                note=schedule_note,
            )
            db.add(new_schedule)
            saved_count += 1

        db.commit()

        # Tạo thông điệp xác nhận
        msg = f"🎉 Đã lưu thành công **{saved_count}** buổi học vào Thời khóa biểu!"
        if created_subjects:
            msg += f"\n*(Tự động tạo mới **{len(created_subjects)}** môn học: {', '.join(created_subjects)})*"

        # Lưu lịch sử chat AI
        ai_msg = AIChatHistory(
            user_id=current_user.id,
            role="model",
            content=msg,
            suggested_action=json.dumps(
                {
                    "action": "EXECUTE_BATCH",
                    "saved_count": saved_count,
                    "created_subjects": created_subjects,
                },
                ensure_ascii=False,
            ),
        )
        db.add(ai_msg)
        db.commit()

        return ExecuteBatchScheduleResponse(
            success=True,
            message=msg,
            saved_count=saved_count,
            created_subjects=created_subjects,
            data={
                "saved_count": saved_count,
                "created_subjects": created_subjects,
            },
        )

    except Exception as e:
        db.rollback()
        return ExecuteBatchScheduleResponse(
            success=False,
            message=f"Lỗi khi lưu hàng loạt: {str(e)}",
            saved_count=0,
        )

