import base64
import binascii
import json
import os
import re
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.ai_context import (
    AI_DEFAULT_SETTINGS,
    build_ai_context,
    ensure_ai_default_settings,
    get_setting_map,
    get_setting_value,
    setting_to_bool,
    upsert_setting,
)
from app.database import SessionLocal, get_db
from app.dependencies import get_current_user
from app.models.ai_chat_history import AIChatHistory
from app.models.user import User
from app.schemas.ai import (
    AIChatMessage,
    AIChatRequest,
    AIChatResponse,
    AISettingsResponse,
    AISettingsUpdate,
    ExecuteActionRequest,
    ExecuteActionResponse,
    ExecuteBatchScheduleRequest,
    ExecuteBatchScheduleResponse,
    ProposeActionResponse,
    QuickScheduleRequest,
    QuickScheduleResponse,
)

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Assistant"],
)

AI_RATE_LIMIT_PER_MINUTE = 15
AI_MAX_IMAGE_BYTES = 5 * 1024 * 1024
AI_VISION_MODEL = "gemini-1.5-flash"
AI_RATE_LIMIT_MESSAGE = (
    "Trợ lý AI đang suy nghĩ hơi nhiều, bạn nạp năng lượng đợi 1 phút rồi thử lại nhé!"
)
AI_GENERIC_ERROR_MESSAGE = "Không gọi được Gemini lúc này."


def get_ai_settings_payload(db: Session) -> AISettingsResponse:
    ensure_ai_default_settings(db)
    db.commit()
    settings = get_setting_map(db)
    api_key = os.getenv("GEMINI_API_KEY") or get_setting_value(db, "gemini_api_key")

    return AISettingsResponse(
        ai_model=settings.get("ai_model") or AI_DEFAULT_SETTINGS["ai_model"],
        has_api_key=bool(api_key),
        ai_allow_tasks=setting_to_bool(settings.get("ai_allow_tasks"), True),
        ai_allow_deadlines=setting_to_bool(settings.get("ai_allow_deadlines"), True),
        ai_allow_schedule=setting_to_bool(settings.get("ai_allow_schedule"), True),
        ai_allow_study=setting_to_bool(settings.get("ai_allow_study"), True),
        ai_allow_grades=setting_to_bool(settings.get("ai_allow_grades"), True),
        ai_allow_finance=setting_to_bool(settings.get("ai_allow_finance"), False),
        ai_allow_journal=setting_to_bool(settings.get("ai_allow_journal"), False),
        ai_allow_people=setting_to_bool(settings.get("ai_allow_people"), False),
        ai_allow_class_notes=setting_to_bool(settings.get("ai_allow_class_notes"), False),
    )


def extract_usage(response) -> tuple[int | None, int | None]:
    usage = getattr(response, "usage_metadata", None)

    if not usage:
        return None, None

    input_tokens = getattr(usage, "prompt_token_count", None)
    output_tokens = getattr(usage, "candidates_token_count", None)

    return input_tokens, output_tokens


def is_rate_limit_error(error: Exception | str) -> bool:
    text = str(error).lower()
    return (
        "429" in text
        or "too many requests" in text
        or "rate limit" in text
        or "resource_exhausted" in text
    )


def build_gemini_error_message(error: Exception | str) -> str:
    text = str(error)
    normalized = text.lower()

    if is_rate_limit_error(text):
        return AI_RATE_LIMIT_MESSAGE

    if any(keyword in normalized for keyword in ["api key not valid", "api_key_invalid", "invalid api key"]):
        return "Gemini API Key không hợp lệ. Hãy kiểm tra lại key trong Cài đặt -> Trợ lý AI."

    if any(keyword in normalized for keyword in ["permission denied", "forbidden", "403"]):
        return "Gemini từ chối quyền truy cập. Key có thể chưa bật API, bị giới hạn dự án hoặc bị chặn quyền."

    if any(keyword in normalized for keyword in ["not found", "404", "models/", "model"]):
        return "Model Gemini không dùng được với key hiện tại. Hãy thử đổi model sang gemini-3.5-flash, gemini-2.0-flash hoặc gemini-1.5-flash."

    if any(keyword in normalized for keyword in ["quota", "billing", "exceeded"]):
        return "Gemini đang hết quota hoặc tài khoản/API key chưa đủ điều kiện sử dụng model này."

    if any(keyword in normalized for keyword in ["ssl", "connection", "connect", "timeout", "network", "dns", "proxy"]):
        return "Máy hiện không kết nối được tới Gemini. Hãy kiểm tra mạng, proxy/VPN, tường lửa hoặc phần mềm chặn kết nối."

    compact = re.sub(r"\s+", " ", text).strip()
    if compact:
        return f"{AI_GENERIC_ERROR_MESSAGE} Lỗi gốc: {compact[:220]}"

    return f"{AI_GENERIC_ERROR_MESSAGE} Hãy kiểm tra API key, model hoặc kết nối mạng."


def ensure_ai_rate_limit(db: Session, user_id: int):
    one_minute_ago = datetime.utcnow() - timedelta(seconds=60)
    request_count = (
        db.query(AIChatHistory)
        .filter(AIChatHistory.user_id == user_id)
        .filter(AIChatHistory.role == "user")
        .filter(AIChatHistory.created_at >= one_minute_ago)
        .count()
    )

    if request_count >= AI_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail=AI_RATE_LIMIT_MESSAGE)


def get_genai_modules():
    try:
        from google import genai
        from google.genai import types
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Chưa cài SDK google-genai. Hãy chạy: python -m pip install -r requirements.txt",
        ) from exc

    return genai, types


def build_recent_history_prompt(db: Session, user_id: int, message: str) -> str:
    recent_messages = (
        db.query(AIChatHistory)
        .filter(AIChatHistory.user_id == user_id)
        .order_by(AIChatHistory.created_at.desc(), AIChatHistory.id.desc())
        .limit(8)
        .all()
    )
    recent_messages = list(reversed(recent_messages))

    if not recent_messages:
        return message

    history_lines = []

    for item in recent_messages:
        role = "User" if item.role == "user" else "Assistant"
        history_lines.append(f"{role}: {item.content[:800]}")

    return (
        "LICH SU CHAT GAN DAY, CHI DUNG DE HIEU NGU CANH:\n"
        + "\n".join(history_lines)
        + "\n\nCAU HOI MOI CUA USER:\n"
        + message
    )


def build_generation_config(types, system_instruction: str, json_mode: bool = False):
    config = {"system_instruction": system_instruction}

    if json_mode:
        config["response_mime_type"] = "application/json"

    return types.GenerateContentConfig(**config)


def call_gemini(
    api_key: str,
    model: str,
    system_instruction: str,
    message: str,
    json_mode: bool = False,
):
    genai, types = get_genai_modules()
    client = genai.Client(api_key=api_key)
    config = build_generation_config(types, system_instruction, json_mode=json_mode)

    return client.models.generate_content(
        model=model,
        contents=message,
        config=config,
    )


def call_gemini_json(api_key: str, model: str, system_instruction: str, message: str):
    return call_gemini(
        api_key=api_key,
        model=model,
        system_instruction=system_instruction,
        message=message,
        json_mode=True,
    )


def parse_image_base64(image_base64: str | None, image_mime_type: str | None = None):
    if not image_base64:
        return None, None

    data = image_base64.strip()
    mime_type = image_mime_type or "image/jpeg"

    if data.startswith("data:") and "," in data:
        header, data = data.split(",", 1)
        if ";" in header:
            mime_type = header[5:].split(";", 1)[0] or mime_type

    if mime_type == "image/jpg":
        mime_type = "image/jpeg"

    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="AI chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.")

    try:
        image_bytes = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Ảnh gửi lên không đúng định dạng base64.") from exc

    if len(image_bytes) > AI_MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh quá lớn. Hãy chọn ảnh dưới 5MB.")

    return image_bytes, mime_type


def call_gemini_with_image(
    api_key: str,
    model: str,
    system_instruction: str,
    message: str,
    image_bytes: bytes,
    mime_type: str,
    json_mode: bool = False,
):
    genai, types = get_genai_modules()
    client = genai.Client(api_key=api_key)
    config = build_generation_config(types, system_instruction, json_mode=json_mode)

    return client.models.generate_content(
        model=model,
        contents=[
            message,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
        config=config,
    )


def stream_gemini(
    api_key: str,
    model: str,
    system_instruction: str,
    message: str,
    json_mode: bool = False,
):
    genai, types = get_genai_modules()
    client = genai.Client(api_key=api_key)
    config = build_generation_config(types, system_instruction, json_mode=json_mode)

    for chunk in client.models.generate_content_stream(
        model=model,
        contents=message,
        config=config,
    ):
        yield chunk


def extract_json_payload(value: str | None) -> dict | None:
    if not value:
        return None

    text_value = value.strip()
    if text_value.startswith("```"):
        text_value = re.sub(r"^```(?:json)?", "", text_value, flags=re.IGNORECASE).strip()
        text_value = re.sub(r"```$", "", text_value).strip()

    try:
        return json.loads(text_value)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text_value, re.DOTALL)
        if not match:
            return None

        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def build_receipt_system_instruction(base_context: str) -> str:
    return (
        base_context
        + "\n\nNGUOI DUNG VUA GUI MOT BUC ANH. "
        "Neu day la hoa don/chung tu chi tieu, hay trich xuat va chi tra ve JSON hop le, "
        "khong boc trong markdown, khong them giai thich ben ngoai JSON. "
        "Schema bat buoc: "
        '{"action":"create_expense","amount":100000,"category":"food","transaction_date":"YYYY-MM-DD",'
        '"payment_method":"cash","note":"mo ta ngan"} '
        "category chi duoc la mot trong: food, study, transport, entertainment, health, other. "
        "payment_method chi duoc la mot trong: cash, bank, ewallet. "
        "Neu khong phai hoa don, tra ve: "
        '{"action":"none","reply":"noi dung mo ta ngan bang tieng Viet"}'
    )


def normalize_receipt_action(payload: dict | None) -> dict | None:
    if not payload or payload.get("action") != "create_expense":
        return None

    try:
        amount = int(float(str(payload.get("amount", "0")).replace(",", "").strip()))
    except ValueError:
        amount = 0

    if amount <= 0:
        return None

    category = payload.get("category") or "other"
    if category not in {"food", "study", "transport", "entertainment", "health", "other"}:
        category = "other"

    payment_method = payload.get("payment_method") or "cash"
    if payment_method not in {"cash", "bank", "ewallet"}:
        payment_method = "cash"

    transaction_date = payload.get("transaction_date") or date.today().isoformat()

    return {
        "action": "create_expense",
        "type": "create_expense",
        "transaction_type": "expense",
        "amount": amount,
        "category": category,
        "transaction_date": transaction_date,
        "payment_method": payment_method,
        "note": (payload.get("note") or "Trích xuất từ ảnh hóa đơn bằng Trợ lý AI.")[:240],
    }


def build_receipt_answer(payload: dict | None, action: dict | None) -> str:
    if action:
        amount_text = f"{action['amount']:,}".replace(",", ".")
        return (
            "Mình đã đọc ảnh hóa đơn và trích xuất được một khoản chi: "
            f"{amount_text} đ, danh mục {action['category']}, ngày {action['transaction_date']}. "
            "Bạn kiểm tra lại rồi bấm nút tạo khoản chi nếu thông tin đúng."
        )

    if payload and payload.get("reply"):
        return str(payload["reply"])

    return "Mình chưa nhận diện được hóa đơn rõ ràng từ ảnh này. Bạn thử chụp rõ phần tổng tiền hơn nhé."


def next_weekday(target_weekday: int, force_next_week: bool = False) -> date:
    today = date.today()
    days_ahead = target_weekday - today.weekday()

    if days_ahead <= 0:
        days_ahead += 7

    if force_next_week and days_ahead < 7:
        days_ahead += 7

    return today + timedelta(days=days_ahead)


def build_suggested_action(user_message: str) -> str | None:
    normalized = user_message.strip().lower()

    if not any(keyword in normalized for keyword in ["nhắc", "nhac", "task", "việc", "viec", "làm bài", "lam bai"]):
        return None

    action_date = date.today()

    if "ngày mai" in normalized or "ngay mai" in normalized:
        action_date = date.today() + timedelta(days=1)
    elif "hôm nay" in normalized or "hom nay" in normalized:
        action_date = date.today()
    else:
        weekday_map = {
            "thứ 2": 0,
            "thu 2": 0,
            "thứ hai": 0,
            "thu hai": 0,
            "thứ 3": 1,
            "thu 3": 1,
            "thứ ba": 1,
            "thu ba": 1,
            "thứ 4": 2,
            "thu 4": 2,
            "thứ tư": 2,
            "thu tu": 2,
            "thứ 5": 3,
            "thu 5": 3,
            "thứ năm": 3,
            "thu nam": 3,
            "thứ 6": 4,
            "thu 6": 4,
            "thứ sáu": 4,
            "thu sau": 4,
            "thứ 7": 5,
            "thu 7": 5,
            "thứ bảy": 5,
            "thu bay": 5,
            "chủ nhật": 6,
            "chu nhat": 6,
        }

        for label, weekday in weekday_map.items():
            if label in normalized:
                action_date = next_weekday(weekday, "tuần sau" in normalized or "tuan sau" in normalized)
                break

    title = re.sub(
        r"(?i)\b(nhắc mình|nhac minh|nhắc tôi|nhac toi|tạo task|tao task|thêm task|them task|tạo việc|tao viec|nhớ|nho)\b",
        "",
        user_message,
    )
    title = re.sub(
        r"(?i)\b(hôm nay|hom nay|ngày mai|ngay mai|tuần sau|tuan sau|thứ\s*\d|thu\s*\d|thứ hai|thu hai|thứ ba|thu ba|thứ tư|thu tu|thứ năm|thu nam|thứ sáu|thu sau|thứ bảy|thu bay|chủ nhật|chu nhat)\b",
        "",
        title,
    )
    title = re.sub(r"\s+", " ", title).strip(" ,.-")

    if len(title) < 3:
        title = user_message.strip()[:80]

    return json.dumps(
        {
            "action": "create_task",
            "type": "create_task",
            "title": title[:120],
            "task_date": action_date.isoformat(),
            "priority": "medium",
            "note": "Đề xuất bởi Trợ lý AI. Người dùng cần bấm duyệt trước khi ghi vào DB.",
        },
        ensure_ascii=False,
    )


def serialize_ai_message(message: AIChatHistory) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "model": message.model,
        "token_input": message.token_input,
        "token_output": message.token_output,
        "latency_ms": message.latency_ms,
        "error_message": message.error_message,
        "suggested_action": message.suggested_action,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.get("/settings", response_model=AISettingsResponse)
def get_ai_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_ai_settings_payload(db)


@router.put("/settings", response_model=AISettingsResponse)
def update_ai_settings(
    payload: AISettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_unset=True)

    if "gemini_api_key" in data:
        value = (data.pop("gemini_api_key") or "").strip()
        if value:
            upsert_setting(
                db,
                "gemini_api_key",
                value,
                "Gemini API key luu cuc bo. Khong dua vao backup/export.",
            )

    for key, value in data.items():
        if key not in AI_DEFAULT_SETTINGS:
            continue

        stored_value = "1" if isinstance(value, bool) and value else "0" if isinstance(value, bool) else str(value)
        upsert_setting(db, key, stored_value)

    db.commit()
    return get_ai_settings_payload(db)


@router.get("/context-preview")
def get_context_preview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_ai_context(db)["safe_summary"]


@router.get("/history", response_model=list[AIChatMessage])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AIChatHistory)
        .filter(AIChatHistory.user_id == current_user.id)
        .order_by(AIChatHistory.created_at.asc(), AIChatHistory.id.asc())
        .limit(120)
        .all()
    )


@router.delete("/history")
def delete_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(AIChatHistory).filter(AIChatHistory.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Đã xóa lịch sử Trợ lý AI."}


@router.post("/chat", response_model=AIChatResponse)
def chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = payload.message.strip()
    image_bytes, image_mime_type = parse_image_base64(payload.image_base64, payload.image_mime_type)

    if not message and not image_bytes:
        raise HTTPException(status_code=400, detail="Vui lòng nhập câu hỏi.")

    if not message:
        message = "Hãy đọc ảnh này và cho tôi biết nội dung chính."

    settings = get_setting_map(db)
    model = settings.get("ai_model") or AI_DEFAULT_SETTINGS["ai_model"]
    model_used = AI_VISION_MODEL if image_bytes else model
    api_key = os.getenv("GEMINI_API_KEY") or get_setting_value(db, "gemini_api_key")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Chưa cấu hình Gemini API Key trong .env hoặc Cài đặt -> Trợ lý AI.",
        )

    ensure_ai_rate_limit(db, current_user.id)
    context = build_ai_context(db, message)
    context_snapshot = json.dumps(context["safe_summary"], ensure_ascii=False)
    prompt = build_recent_history_prompt(db, current_user.id, message)
    start = time.perf_counter()
    token_input = None
    token_output = None
    error_message = None
    suggested_action = build_suggested_action(message)

    user_message = AIChatHistory(
        user_id=current_user.id,
        role="user",
        content=message,
        context_snapshot=context_snapshot,
        model=model_used,
    )
    db.add(user_message)
    db.commit()

    try:
        if image_bytes:
            response = call_gemini_with_image(
                api_key,
                model_used,
                build_receipt_system_instruction(context["raw_context"]),
                message,
                image_bytes,
                image_mime_type,
                json_mode=True,
            )
            payload_json = extract_json_payload(getattr(response, "text", None))
            receipt_action = normalize_receipt_action(payload_json)
            answer = build_receipt_answer(payload_json, receipt_action)
            suggested_action = json.dumps(receipt_action, ensure_ascii=False) if receipt_action else None
        else:
            response = call_gemini(api_key, model_used, context["raw_context"], prompt)
            answer = getattr(response, "text", None) or "AI chưa trả về nội dung."

        token_input, token_output = extract_usage(response)
    except HTTPException:
        raise
    except Exception as exc:
        if is_rate_limit_error(exc):
            raise HTTPException(status_code=429, detail=AI_RATE_LIMIT_MESSAGE) from exc

        answer = build_gemini_error_message(exc)
        error_message = str(exc)[:1000]

    latency_ms = int((time.perf_counter() - start) * 1000)
    ai_message = AIChatHistory(
        user_id=current_user.id,
        role="model",
        content=answer,
        context_snapshot=context_snapshot,
        model=model_used,
        token_input=token_input,
        token_output=token_output,
        latency_ms=latency_ms,
        error_message=error_message,
        suggested_action=suggested_action,
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)

    return AIChatResponse(message=ai_message)


@router.post("/chat/stream")
def chat_stream(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = payload.message.strip()
    image_bytes, image_mime_type = parse_image_base64(payload.image_base64, payload.image_mime_type)

    if not message and not image_bytes:
        raise HTTPException(status_code=400, detail="Vui lòng nhập câu hỏi.")

    if not message:
        message = "Hãy đọc ảnh này và cho tôi biết nội dung chính."

    settings = get_setting_map(db)
    model = settings.get("ai_model") or AI_DEFAULT_SETTINGS["ai_model"]
    model_used = AI_VISION_MODEL if image_bytes else model
    api_key = os.getenv("GEMINI_API_KEY") or get_setting_value(db, "gemini_api_key")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Chưa cấu hình Gemini API Key trong .env hoặc Cài đặt -> Trợ lý AI.",
        )

    ensure_ai_rate_limit(db, current_user.id)
    get_genai_modules()
    context = build_ai_context(db, message)
    context_snapshot = json.dumps(context["safe_summary"], ensure_ascii=False)
    prompt = build_recent_history_prompt(db, current_user.id, message)

    user_message = AIChatHistory(
        user_id=current_user.id,
        role="user",
        content=message,
        context_snapshot=context_snapshot,
        model=model_used,
    )
    db.add(user_message)
    db.commit()

    def event_stream():
        start = time.perf_counter()
        answer_parts = []
        error_message = None
        token_input = None
        token_output = None
        error_code = None
        suggested_action = build_suggested_action(message)

        try:
            if image_bytes:
                response = call_gemini_with_image(
                    api_key,
                    model_used,
                    build_receipt_system_instruction(context["raw_context"]),
                    message,
                    image_bytes,
                    image_mime_type,
                    json_mode=True,
                )
                payload_json = extract_json_payload(getattr(response, "text", None))
                receipt_action = normalize_receipt_action(payload_json)
                answer = build_receipt_answer(payload_json, receipt_action)
                suggested_action = json.dumps(receipt_action, ensure_ascii=False) if receipt_action else None
                token_input, token_output = extract_usage(response)
                answer_parts.append(answer)
                yield sse_event({"type": "delta", "content": answer})
            else:
                for chunk in stream_gemini(api_key, model_used, context["raw_context"], prompt):
                    text = getattr(chunk, "text", None)

                    if not text:
                        continue

                    answer_parts.append(text)
                    yield sse_event({"type": "delta", "content": text})
        except Exception as exc:
            error_message = str(exc)[:1000]
            error_code = "rate_limit" if is_rate_limit_error(exc) else "gemini_error"

            if not answer_parts:
                answer_parts.append(
                    AI_RATE_LIMIT_MESSAGE if error_code == "rate_limit" else build_gemini_error_message(exc)
                )
                yield sse_event(
                    {
                        "type": "error",
                        "code": error_code,
                        "message": answer_parts[-1],
                    }
                )
                yield sse_event({"type": "delta", "content": answer_parts[-1]})

        answer = "".join(answer_parts).strip() or "AI chưa trả về nội dung."
        latency_ms = int((time.perf_counter() - start) * 1000)
        stream_db = SessionLocal()

        try:
            ai_message = AIChatHistory(
                user_id=current_user.id,
                role="model",
                content=answer,
                context_snapshot=context_snapshot,
                model=model_used,
                token_input=token_input,
                token_output=token_output,
                latency_ms=latency_ms,
                error_message=error_message,
                suggested_action=suggested_action,
            )
            stream_db.add(ai_message)
            stream_db.commit()
            stream_db.refresh(ai_message)

            yield sse_event(
                {
                    "type": "final",
                    "message": serialize_ai_message(ai_message),
                }
            )
        finally:
            stream_db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/quick-schedule", response_model=QuickScheduleResponse)
def quick_schedule(
    request: QuickScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prompt = request.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Vui lòng nhập câu lệnh thêm lịch học.")

    # Lấy api_key và model
    settings = get_setting_map(db)
    api_key = os.getenv("GEMINI_API_KEY") or get_setting_value(db, "gemini_api_key")
    model = settings.get("ai_model") or AI_DEFAULT_SETTINGS["ai_model"]

    from datetime import time as dt_time
    from app.models.schedule import Schedule
    from app.models.subject import Subject
    from app.services.ai_schedule_parser import parse_schedule_prompt

    # Trích xuất thông tin lịch học
    extraction = parse_schedule_prompt(prompt, api_key=api_key, model=model)

    if extraction.missing_info:
        return QuickScheduleResponse(
            success=False,
            message=extraction.missing_info,
            data={"extraction": extraction.model_dump()},
        )

    # 1. Tìm hoặc tạo mới môn học
    subject_name = extraction.subject_name.strip()
    subject = (
        db.query(Subject)
        .filter(Subject.name.ilike(subject_name))
        .first()
    )

    created_new_subject = False
    if not subject:
        subject = Subject(
            name=subject_name,
            room=extraction.room,
            lecturer=extraction.teacher,
            note=extraction.note,
            progress_status="studying",
        )
        db.add(subject)
        db.commit()
        db.refresh(subject)
        created_new_subject = True
    else:
        # Cập nhật thêm phòng / giảng viên nếu chưa có và đảm bảo trạng thái là studying
        updated = False
        if extraction.room and not subject.room:
            subject.room = extraction.room
            updated = True
        if extraction.teacher and not subject.lecturer:
            subject.lecturer = extraction.teacher
            updated = True
        if subject.progress_status != "studying":
            subject.progress_status = "studying"
            updated = True
        if updated:
            db.commit()
            db.refresh(subject)

    # 2. Parse giờ bắt đầu và kết thúc
    start_parts = extraction.start_time.split(":")
    end_parts = extraction.end_time.split(":")
    start_t = dt_time(int(start_parts[0]), int(start_parts[1]))
    end_t = dt_time(int(end_parts[0]), int(end_parts[1]))

    # 3. Kiểm tra trùng/xung đột giờ học
    day_val = extraction.day_of_week
    existing_schedules = (
        db.query(Schedule)
        .filter(Schedule.day_of_week == day_val)
        .all()
    )

    conflict_warning = None
    for sch in existing_schedules:
        if start_t < sch.end_time and end_t > sch.start_time:
            conflict_warning = (
                f"Lưu ý: Đang trùng khung giờ với lịch '{sch.title}' "
                f"({sch.start_time.strftime('%H:%M')} - {sch.end_time.strftime('%H:%M')})."
            )
            break

    # 4. Tạo bản ghi Schedule
    note_parts = []
    if extraction.teacher:
        note_parts.append(f"GV: {extraction.teacher}")
    if extraction.note:
        note_parts.append(extraction.note)
    schedule_note = " · ".join(note_parts) if note_parts else None

    new_schedule = Schedule(
        day_of_week=day_val,
        start_time=start_t,
        end_time=end_t,
        title=subject.name,
        category="study",
        location=extraction.room,
        note=schedule_note,
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)

    # 5. Định dạng văn bản xác nhận
    day_labels = {
        1: "Chủ nhật",
        2: "Thứ 2",
        3: "Thứ 3",
        4: "Thứ 4",
        5: "Thứ 5",
        6: "Thứ 6",
        7: "Thứ 7",
    }
    day_text = day_labels.get(day_val, f"Thứ {day_val}")
    time_text = f"{extraction.start_time} - {extraction.end_time}"
    room_text = f", phòng {extraction.room}" if extraction.room else ""
    teacher_text = f", {extraction.teacher}" if extraction.teacher else ""

    confirm_msg = (
        f"✅ Đã thêm môn **{subject.name}** vào **{day_text}** ({time_text}{room_text}{teacher_text})."
    )
    if created_new_subject:
        confirm_msg += f"\n*(Đã tạo mới môn học '{subject.name}' trong danh sách môn)*"
    if conflict_warning:
        confirm_msg += f"\n⚠️ *{conflict_warning}*"

    # 6. Lưu vào AIChatHistory
    user_msg = AIChatHistory(
        user_id=current_user.id,
        role="user",
        content=prompt,
    )
    db.add(user_msg)

    action_payload = {
        "type": "create_schedule",
        "action": "create_schedule",
        "subject_name": subject.name,
        "subject_id": subject.id,
        "schedule_id": new_schedule.id,
        "day_of_week": day_val,
        "day_label": day_text,
        "start_time": extraction.start_time,
        "end_time": extraction.end_time,
        "room": extraction.room,
        "teacher": extraction.teacher,
        "created_new_subject": created_new_subject,
        "conflict_warning": conflict_warning,
    }

    ai_msg = AIChatHistory(
        user_id=current_user.id,
        role="model",
        content=confirm_msg,
        suggested_action=json.dumps(action_payload, ensure_ascii=False),
    )
    db.add(ai_msg)
    db.commit()

    return QuickScheduleResponse(
        success=True,
        message=confirm_msg,
        data=action_payload,
    )


@router.post("/schedule/propose", response_model=ProposeActionResponse)
def propose_schedule(
    request: QuickScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prompt = (request.prompt or "").strip()
    image_base64 = request.image_base64.strip() if request.image_base64 else None
    image_mime_type = request.image_mime_type or "image/jpeg"
    images = request.images or []

    if not prompt and not image_base64 and not images:
        raise HTTPException(status_code=400, detail="Vui lòng nhập câu lệnh hoặc đính kèm ảnh thời khóa biểu.")

    if not prompt and (image_base64 or images):
        prompt = "Trích xuất lịch học từ ảnh thời khóa biểu và tạo đề xuất thêm vào thời khóa biểu."

    settings = get_setting_map(db)
    api_key = os.getenv("GEMINI_API_KEY") or get_setting_value(db, "gemini_api_key")
    model = settings.get("ai_model") or AI_DEFAULT_SETTINGS["ai_model"]

    from app.services.schedule_agent import propose_schedule_action

    return propose_schedule_action(
        prompt=prompt,
        db=db,
        api_key=api_key,
        model=model,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
        images=images,
    )


@router.post("/schedule/execute", response_model=ExecuteActionResponse)
def execute_schedule(
    request: ExecuteActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.schedule_agent import execute_schedule_action

    return execute_schedule_action(
        request=request,
        db=db,
        current_user=current_user,
    )


@router.post("/schedule/execute-batch", response_model=ExecuteBatchScheduleResponse)
def execute_batch_schedule(
    request: ExecuteBatchScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.schedule_agent import execute_batch_schedule_action

    return execute_batch_schedule_action(
        request=request,
        db=db,
        current_user=current_user,
    )


