import json
import re
from typing import Any

from app.schemas.ai import ScheduleExtractionResult

SYSTEM_INSTRUCTION = """Bạn là chuyên gia trích xuất thông tin lịch học và môn học từ câu lệnh tiếng Việt của học sinh, sinh viên.
Nhiệm vụ của bạn là phân tích câu lệnh của người dùng và trả về DUY NHẤT một JSON hợp lệ theo schema sau:
{
  "subject_name": "Tên môn học (chuẩn hóa viết hoa chữ cái đầu từng từ, ví dụ: 'Học Máy Tính', 'Triết Học Mác - Lênin', 'Lập Trình Web')",
  "day_of_week": <Số nguyên đại diện cho thứ trong tuần: 2=Thứ Hai, 3=Thứ Ba, 4=Thứ Tư, 5=Thứ Năm, 6=Thứ Sáu, 7=Thứ Bảy, 1=Chủ Nhật>,
  "start_time": "Giờ bắt đầu dạng HH:MM (chuẩn 24 giờ, ví dụ: '07:00', '13:30', '18:00')",
  "end_time": "Giờ kết thúc dạng HH:MM (chuẩn 24 giờ, ví dụ: '09:00', '15:15', '20:30')",
  "room": "Phòng học nếu có (ví dụ: 'A2-301', 'B102', 'Zoom Online'), nếu không có thì null",
  "teacher": "Tên giảng viên nếu có (ví dụ: 'Thầy Nam', 'Cô Hương'), nếu không có thì null",
  "note": "Ghi chú thêm nếu có, nếu không có thì null",
  "missing_info": "Nếu câu lệnh thiếu thông tin bắt buộc (ví dụ thiếu tên môn, thiếu thứ trong tuần, hoặc thiếu giờ học), hãy mô tả rõ ràng bằng tiếng Việt yêu cầu người dùng bổ sung (ví dụ: 'Vui lòng cho biết thứ trong tuần và khung giờ học (ví dụ: sáng thứ 2 từ 7h đến 9h)'). Nếu thông tin đã đủ thì để null."
}

Quy tắc chuẩn hóa:
1. day_of_week:
   - "thứ 2", "thứ hai", "t2", "thứ hai tuần sau" -> 2
   - "thứ 3", "thứ ba", "t3" -> 3
   - "thứ 4", "thứ tư", "t4" -> 4
   - "thứ 5", "thứ năm", "t5" -> 5
   - "thứ 6", "thứ sáu", "t6" -> 6
   - "thứ 7", "thứ bảy", "t7" -> 7
   - "chủ nhật", "cn" -> 1
2. start_time và end_time:
   - Chuyển tất cả về 24h định dạng HH:MM (2 chữ số giờ, 2 chữ số phút).
   - "7h", "7 giờ", "7h sáng" -> "07:00"
   - "7h30", "7 rưỡi" -> "07:30"
   - "1h chiều", "13h" -> "13:00"
   - "2h30 chiều", "14h30" -> "14:30"
   - "9h tối", "21h" -> "21:00"
   - Nếu người dùng chỉ nói "học lúc 8h sáng" mà không nêu giờ kết thúc, hãy tự động cộng thêm 2 tiếng -> start_time="08:00", end_time="10:00".
3. Chỉ trả về chuỗi JSON thuần, không kèm markdown, không có bất kỳ văn bản nào khác ngoài JSON.
"""


def clean_json_response(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def normalize_time_str(time_str: str | None) -> str:
    if not time_str:
        return "07:00"
    time_str = time_str.strip().lower().replace("h", ":")
    if ":" not in time_str:
        time_str += ":00"
    parts = time_str.split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    return f"{hours:02d}:{minutes:02d}"


def normalize_day_of_week(day_val: Any) -> int:
    try:
        val = int(day_val)
        if val == 8:
            return 1  # Chủ nhật
        if 1 <= val <= 7:
            return val
        return 2
    except (ValueError, TypeError):
        return 2


def fallback_rule_parser(prompt: str) -> ScheduleExtractionResult | None:
    """Fallback parser nếu không kết nối được LLM."""
    text = prompt.strip()
    lower = text.lower()

    # Nhận diện thứ
    day_of_week = None
    day_match = re.search(r"(?:thứ\s*([2-7])|chủ\s*nhật|cn)", lower)
    if day_match:
        if "chủ" in day_match.group(0) or "cn" in day_match.group(0):
            day_of_week = 1
        else:
            day_of_week = int(day_match.group(1))

    # Nhận diện giờ bắt đầu và kết thúc: ví dụ "từ 7h đến 9h", "7h - 9h", "13h30 đến 15h30"
    start_time = None
    end_time = None
    time_range_match = re.search(
        r"(?:từ\s*)?(\d{1,2}(?:h\d{0,2}|:\d{2})?)\s*(?:đến|-|tới)\s*(\d{1,2}(?:h\d{0,2}|:\d{2})?)",
        lower,
    )
    if time_range_match:
        raw_start = time_range_match.group(1)
        raw_end = time_range_match.group(2)
        start_time = normalize_time_str(raw_start)
        end_time = normalize_time_str(raw_end)
    else:
        single_time_match = re.search(r"(?:lúc|vào)\s*(\d{1,2}(?:h\d{0,2}|:\d{2})?)", lower)
        if single_time_match:
            start_time = normalize_time_str(single_time_match.group(1))
            start_hour = int(start_time.split(":")[0])
            end_time = f"{(start_hour + 2) % 24:02d}:{start_time.split(':')[1]}"

    # Nhận diện phòng học
    room = None
    room_match = re.search(r"(?:phòng|tại|room)\s*([a-zA-Z0-9\-_]+)", text, re.IGNORECASE)
    if room_match:
        room = room_match.group(1).upper()

    # Nhận diện giảng viên
    teacher = None
    teacher_match = re.search(r"(?:thầy|cô|giảng viên|gv)\s*([A-Za-zÀ-ỹ\s]+?)(?:(?=phòng|vào|lúc|từ|$))", text, re.IGNORECASE)
    if teacher_match:
        teacher = teacher_match.group(0).strip()

    # Nhận diện tên môn học
    subject_match = re.search(
        r"(?:thêm\s*(?:môn|lịch\s*môn|lịch\s*học\s*môn)?\s*)([A-Za-zÀ-ỹ0-9\s\-_]+?)(?=(?:\s+vào|\s+sáng|\s+chiều|\s+tối|\s+thứ|\s+từ|\s+lúc|\s+phòng|$))",
        text,
        re.IGNORECASE,
    )
    subject_name = subject_match.group(1).strip() if subject_match else ""

    if not subject_name:
        # Thử lấy sau chữ "môn"
        m = re.search(r"môn\s*([A-Za-zÀ-ỹ0-9\s\-_]+?)(?=(?:\s+vào|\s+sáng|\s+chiều|\s+tối|\s+thứ|\s+từ|\s+lúc|\s+phòng|$))", text, re.IGNORECASE)
        if m:
            subject_name = m.group(1).strip()

    missing = []
    if not subject_name:
        missing.append("tên môn học")
    if not day_of_week:
        missing.append("thứ trong tuần")
    if not start_time or not end_time:
        missing.append("khung giờ học")

    if missing:
        missing_msg = f"Vui lòng cung cấp thêm {', '.join(missing)} (ví dụ: sáng thứ 2 từ 7h đến 9h phòng A2-301)."
        return ScheduleExtractionResult(
            subject_name=subject_name or "Môn học",
            day_of_week=day_of_week or 2,
            start_time=start_time or "07:00",
            end_time=end_time or "09:00",
            room=room,
            teacher=teacher,
            missing_info=missing_msg,
        )

    # Chuẩn hóa tên môn
    words = [w.capitalize() for w in subject_name.split()]
    normalized_subject = " ".join(words)

    return ScheduleExtractionResult(
        subject_name=normalized_subject,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        room=room,
        teacher=teacher,
    )


def parse_schedule_prompt(
    prompt: str,
    api_key: str | None = None,
    model: str = "gemini-1.5-flash",
) -> ScheduleExtractionResult:
    """
    Sử dụng Gemini AI để trích xuất môn học & thời khóa biểu.
    Nếu không có API key hoặc gặp lỗi kết nối, chuyển sang fallback parser.
    """
    if not api_key:
        fallback = fallback_rule_parser(prompt)
        if fallback:
            return fallback
        return ScheduleExtractionResult(
            subject_name="Môn học",
            day_of_week=2,
            start_time="07:00",
            end_time="09:00",
            missing_info="Chưa có Gemini API Key và không thể tự động nhận diện câu lệnh. Vui lòng cài đặt API Key trong Cài đặt -> Trợ lý AI.",
        )

    try:
        from app.routers.ai import call_gemini_json

        response = call_gemini_json(
            api_key=api_key,
            model=model,
            system_instruction=SYSTEM_INSTRUCTION,
            message=prompt,
        )

        raw_content = getattr(response, "text", "") or str(response)
        cleaned = clean_json_response(raw_content)
        data = json.loads(cleaned)

        subject_name = (data.get("subject_name") or "").strip()
        day_of_week = normalize_day_of_week(data.get("day_of_week"))
        start_time = normalize_time_str(data.get("start_time"))
        end_time = normalize_time_str(data.get("end_time"))
        room = data.get("room")
        teacher = data.get("teacher")
        note = data.get("note")
        missing_info = data.get("missing_info")

        if not subject_name:
            missing_info = "Vui lòng cho biết tên môn học cần thêm."

        return ScheduleExtractionResult(
            subject_name=subject_name or "Môn học",
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            room=room.strip() if room else None,
            teacher=teacher.strip() if teacher else None,
            note=note.strip() if note else None,
            missing_info=missing_info.strip() if missing_info else None,
        )
    except Exception as exc:
        print(f"[ScheduleParser] Lỗi khi gọi Gemini: {exc}. Chuyển sang fallback rule parser.")
        fallback = fallback_rule_parser(prompt)
        if fallback:
            return fallback
        raise exc
