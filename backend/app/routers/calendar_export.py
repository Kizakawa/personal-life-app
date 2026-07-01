from datetime import date, datetime, time, timedelta
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.deadline import Deadline
from app.models.event import Event
from app.models.schedule import Schedule
from app.models.task import Task
from app.models.user import User
from app.security import ensure_calendar_token, get_user_by_calendar_token, regenerate_calendar_token

router = APIRouter(prefix="/calendar", tags=["Calendar Export"])

DAY_LABEL_TO_WEEKDAY = {
    1: 6,  # CN
    2: 0,  # T2
    3: 1,
    4: 2,
    5: 3,
    6: 4,
    7: 5,
}


def escape_ics(value) -> str:
    text = str(value or "")
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def dtstamp() -> str:
    return datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")


def format_datetime(value: datetime) -> str:
    return value.strftime("%Y%m%dT%H%M%S")


def format_date(value: date) -> str:
    return value.strftime("%Y%m%d")


def combine_date_time(day: date, value: time | None, fallback_hour: int = 8) -> datetime:
    return datetime.combine(day, value or time(hour=min(max(fallback_hour, 0), 23), minute=0))


def add_event(buffer: StringIO, *, uid: str, title: str, start, end=None, description: str = "", location: str = ""):
    buffer.write("BEGIN:VEVENT\r\n")
    buffer.write(f"UID:{escape_ics(uid)}\r\n")
    buffer.write(f"DTSTAMP:{dtstamp()}\r\n")
    buffer.write(f"SUMMARY:{escape_ics(title)}\r\n")

    if isinstance(start, datetime):
        buffer.write(f"DTSTART:{format_datetime(start)}\r\n")
        buffer.write(f"DTEND:{format_datetime(end or (start + timedelta(hours=1)))}\r\n")
    else:
        buffer.write(f"DTSTART;VALUE=DATE:{format_date(start)}\r\n")
        buffer.write(f"DTEND;VALUE=DATE:{format_date(end or (start + timedelta(days=1)))}\r\n")

    if description:
        buffer.write(f"DESCRIPTION:{escape_ics(description)}\r\n")
    if location:
        buffer.write(f"LOCATION:{escape_ics(location)}\r\n")

    buffer.write("END:VEVENT\r\n")


def iter_schedule_dates(start_day: date, end_day: date, app_day_of_week: int):
    target_weekday = DAY_LABEL_TO_WEEKDAY.get(app_day_of_week)
    if target_weekday is None:
        return

    current = start_day
    while current <= end_day:
        if current.weekday() == target_weekday:
            yield current
        current += timedelta(days=1)


def build_export_url(request: Request, token: str, days: int = 90) -> str:
    url = request.url_for("export_calendar_ics")
    return f"{url}?days={days}&token={token}"


@router.get("/link")
def get_calendar_export_link(
    request: Request,
    days: int = Query(default=90, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = ensure_calendar_token(db, current_user)
    return {
        "token": token,
        "days": days,
        "url": build_export_url(request, token, days),
    }


@router.post("/token/regenerate")
def regenerate_export_token(
    request: Request,
    days: int = Query(default=90, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = regenerate_calendar_token(db, current_user)
    return {
        "message": "Đã tạo lại link lịch mới. Link cũ không còn dùng được.",
        "token": token,
        "days": days,
        "url": build_export_url(request, token, days),
    }


@router.get("/export", name="export_calendar_ics")
def export_calendar_ics(
    token: str = Query(..., min_length=16),
    days: int = Query(default=90, ge=7, le=365),
    include_schedules: bool = True,
    include_deadlines: bool = True,
    include_events: bool = True,
    include_tasks: bool = True,
    db: Session = Depends(get_db),
):
    user = get_user_by_calendar_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Link xuất lịch không hợp lệ hoặc đã bị thu hồi")

    today = date.today()
    end_day = today + timedelta(days=days)
    buffer = StringIO()

    buffer.write("BEGIN:VCALENDAR\r\n")
    buffer.write("VERSION:2.0\r\n")
    buffer.write("PRODID:-//Personal Life App//Student Calendar//VI\r\n")
    buffer.write("CALSCALE:GREGORIAN\r\n")
    buffer.write("METHOD:PUBLISH\r\n")

    if include_schedules:
        for item in db.query(Schedule).all():
            for current_day in iter_schedule_dates(today, end_day, item.day_of_week):
                start = combine_date_time(current_day, item.start_time)
                end = combine_date_time(current_day, item.end_time, fallback_hour=start.hour + 1)
                add_event(
                    buffer,
                    uid=f"schedule-{item.id}-{format_date(current_day)}@personal-life-app",
                    title=f"[Lịch học] {item.title}",
                    start=start,
                    end=end,
                    description=item.note or item.category or "Thời khóa biểu",
                    location=item.location or "",
                )

    if include_events:
        for item in db.query(Event).filter(Event.event_date >= today, Event.event_date <= end_day).all():
            start = combine_date_time(item.event_date, item.event_time) if item.event_time else item.event_date
            add_event(
                buffer,
                uid=f"event-{item.id}@personal-life-app",
                title=f"[Sự kiện] {item.title}",
                start=start,
                description=item.note or item.event_type or "Sự kiện",
                location=item.location or "",
            )

    if include_deadlines:
        for item in db.query(Deadline).filter(Deadline.due_date >= today, Deadline.due_date <= end_day).all():
            add_event(
                buffer,
                uid=f"deadline-{item.id}@personal-life-app",
                title=f"[Deadline] {item.title}",
                start=item.due_date,
                description=" · ".join([part for part in [item.subject, item.type, item.priority, item.note] if part]),
            )

    if include_tasks:
        for item in db.query(Task).filter(Task.task_date >= today, Task.task_date <= end_day, Task.status != "done").all():
            start = combine_date_time(item.task_date, item.start_time) if item.start_time else item.task_date
            end = combine_date_time(item.task_date, item.end_time) if item.start_time and item.end_time else None
            add_event(
                buffer,
                uid=f"task-{item.id}@personal-life-app",
                title=f"[Việc cần làm] {item.title}",
                start=start,
                end=end,
                description=item.note or item.priority or "Kế hoạch ngày",
            )

    buffer.write("END:VCALENDAR\r\n")

    file_name = f"personal-life-calendar-{today.isoformat()}.ics"
    return Response(
        content=buffer.getvalue(),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )
