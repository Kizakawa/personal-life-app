from datetime import date, datetime, time, timedelta
from typing import Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.gamification_service import build_gamification_summary
from app.html_sanitizer import sanitize_rich_html
from app.models.attendance_record import AttendanceRecord
from app.models.deadline import Deadline
from app.models.event import Event
from app.models.file_item import FileItem
from app.models.grade_item import GradeItem
from app.models.schedule import Schedule
from app.models.subject import Subject
from app.models.task import Task
from app.models.workspace_item import WorkspaceItem
from app.schemas.attendance_record import (
    AttendanceRecordCreate,
    AttendanceRecordResponse,
    AttendanceRecordUpdate,
)
from app.schemas.grade_item import GradeItemCreate, GradeItemResponse, GradeItemUpdate

router = APIRouter(prefix="/student-hub", tags=["Student Hub"])

DAY_LABELS = {
    1: "CN",
    2: "T2",
    3: "T3",
    4: "T4",
    5: "T5",
    6: "T6",
    7: "T7",
}

STATUS_LABELS = {
    "present": "Có mặt",
    "absent": "Vắng",
    "late": "Muộn",
    "excused": "Có phép",
}

GRADE_CATEGORY_LABELS = {
    "attendance": "Chuyên cần",
    "process": "Quá trình",
    "assignment": "Bài tập",
    "midterm": "Giữa kỳ",
    "project": "Dự án",
    "final": "Cuối kỳ",
    "other": "Khác",
}

class ClassNotePayload(BaseModel):
    title: str
    content: Optional[str] = None
    target_date: Optional[date] = None
    tags: Optional[str] = None
    priority: Optional[str] = "medium"



def app_day_from_date(value: date) -> int:
    # Python: Monday=0, Sunday=6. App: Monday=2, Sunday=1.
    return 1 if value.weekday() == 6 else value.weekday() + 2


def normalize_text(value) -> str:
    return str(value or "").strip().lower()


def normalize_score(score, max_score) -> float | None:
    if score is None:
        return None

    try:
        score_value = float(score)
        max_value = float(max_score or 10)
    except Exception:
        return None

    if max_value <= 0:
        return None

    return max(0, min((score_value / max_value) * 10, 10))


def grade_to_four_point(score_10: float | None) -> float | None:
    if score_10 is None:
        return None

    if score_10 >= 8.5:
        return 4.0
    if score_10 >= 8.0:
        return 3.5
    if score_10 >= 7.0:
        return 3.0
    if score_10 >= 6.5:
        return 2.5
    if score_10 >= 5.5:
        return 2.0
    if score_10 >= 5.0:
        return 1.5
    if score_10 >= 4.0:
        return 1.0
    return 0.0


def letter_grade(score_10: float | None) -> str:
    if score_10 is None:
        return "--"

    if score_10 >= 8.5:
        return "A"
    if score_10 >= 8.0:
        return "B+"
    if score_10 >= 7.0:
        return "B"
    if score_10 >= 6.5:
        return "C+"
    if score_10 >= 5.5:
        return "C"
    if score_10 >= 5.0:
        return "D+"
    if score_10 >= 4.0:
        return "D"
    return "F"


def calculate_subject_grade(grades: Iterable[GradeItem]):
    valid_items = []

    for item in grades:
        score_10 = normalize_score(item.score, item.max_score)
        if score_10 is None:
            continue

        weight = item.weight_percent
        try:
            weight = float(weight) if weight is not None else None
        except Exception:
            weight = None

        valid_items.append({"score": score_10, "weight": weight})

    if not valid_items:
        return {
            "score10": None,
            "score4": None,
            "letter": "--",
            "completedWeight": 0,
            "method": "none",
        }

    weighted_items = [item for item in valid_items if item["weight"] is not None and item["weight"] > 0]
    total_weight = sum(item["weight"] for item in weighted_items)

    if weighted_items and total_weight > 0:
        score_10 = sum(item["score"] * item["weight"] for item in weighted_items) / total_weight
        completed_weight = min(total_weight, 100)
        method = "weighted"
    else:
        score_10 = sum(item["score"] for item in valid_items) / len(valid_items)
        completed_weight = 0
        method = "average"

    score_10 = round(score_10, 2)

    return {
        "score10": score_10,
        "score4": grade_to_four_point(score_10),
        "letter": letter_grade(score_10),
        "completedWeight": round(completed_weight, 1),
        "method": method,
    }


def serialize_grade(item: GradeItem):
    return {
        "id": item.id,
        "subjectId": item.subject_id,
        "subjectName": item.subject_name,
        "title": item.title,
        "category": item.category,
        "categoryLabel": GRADE_CATEGORY_LABELS.get(item.category, item.category),
        "score": item.score,
        "maxScore": item.max_score,
        "score10": normalize_score(item.score, item.max_score),
        "weightPercent": item.weight_percent,
        "note": item.note,
        "recordedAt": item.recorded_at.isoformat() if item.recorded_at else None,
    }


def serialize_attendance(item: AttendanceRecord):
    return {
        "id": item.id,
        "subjectId": item.subject_id,
        "subjectName": item.subject_name,
        "sessionDate": str(item.session_date),
        "status": item.status,
        "statusLabel": STATUS_LABELS.get(item.status, item.status),
        "lessonTitle": item.lesson_title,
        "note": item.note,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
    }


def serialize_class_note(item: WorkspaceItem):
    return {
        "id": item.id,
        "title": item.title,
        "content": item.content,
        "targetDate": str(item.target_date) if item.target_date else None,
        "tags": item.tags,
        "priority": item.priority,
        "status": item.status,
        "subject": item.subject,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
    }


def get_subject_class_notes(db: Session, subject: Subject, limit: int | None = None, offset: int = 0):
    query = (
        db.query(WorkspaceItem)
        .filter(
            WorkspaceItem.category == "class_note",
            WorkspaceItem.subject == subject.name,
        )
        .order_by(WorkspaceItem.target_date.desc(), WorkspaceItem.updated_at.desc(), WorkspaceItem.id.desc())
    )

    total = query.count()
    query = query.offset(offset)

    if limit is not None:
        query = query.limit(limit)

    return query.all(), total


def get_class_note_or_404(db: Session, note_id: int):
    item = (
        db.query(WorkspaceItem)
        .filter(WorkspaceItem.id == note_id, WorkspaceItem.category == "class_note")
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy ghi chép bài giảng")

    return item


def subject_match(subject: Subject, value) -> bool:
    subject_name = normalize_text(subject.name)
    text = normalize_text(value)

    if not subject_name or not text:
        return False

    return subject_name == text or subject_name in text or text in subject_name


def get_subject_grade_items(db: Session, subject: Subject):
    return (
        db.query(GradeItem)
        .filter(
            (GradeItem.subject_id == subject.id)
            | (GradeItem.subject_name == subject.name)
        )
        .order_by(GradeItem.recorded_at.desc(), GradeItem.id.desc())
        .all()
    )


def get_subject_attendance_records(db: Session, subject: Subject):
    return (
        db.query(AttendanceRecord)
        .filter(
            (AttendanceRecord.subject_id == subject.id)
            | (AttendanceRecord.subject_name == subject.name)
        )
        .order_by(AttendanceRecord.session_date.desc(), AttendanceRecord.id.desc())
        .all()
    )


def build_attendance_summary(records: list[AttendanceRecord], attendance_limit: int | None):
    absent_count = sum(1 for item in records if item.status == "absent")
    late_count = sum(1 for item in records if item.status == "late")
    excused_count = sum(1 for item in records if item.status == "excused")
    present_count = sum(1 for item in records if item.status == "present")
    limit = attendance_limit if attendance_limit is not None else 3
    remaining = limit - absent_count

    if remaining < 0:
        risk = "danger"
        message = "Đã vượt giới hạn vắng, cần xử lý ngay với môn học này."
    elif remaining == 0:
        risk = "warning"
        message = "Đã dùng hết số buổi vắng cho phép."
    elif remaining == 1:
        risk = "warning"
        message = "Chỉ còn 1 buổi vắng an toàn."
    else:
        risk = "stable"
        message = "Chuyên cần đang trong vùng an toàn."

    return {
        "total": len(records),
        "present": present_count,
        "absent": absent_count,
        "late": late_count,
        "excused": excused_count,
        "limit": limit,
        "remaining": remaining,
        "risk": risk,
        "message": message,
    }


def load_student_hub_resources(db: Session, subjects: list[Subject]):
    subject_ids = [item.id for item in subjects]
    subject_names = [item.name for item in subjects if item.name]

    if not subjects:
        return {
            "grades": {},
            "attendance": {},
            "deadlines": {},
            "schedules": [],
            "files": [],
            "class_note_counts": {},
        }

    grades_query = db.query(GradeItem)
    attendance_query = db.query(AttendanceRecord)
    deadlines_query = db.query(Deadline).filter(Deadline.status != "done")
    notes_query = db.query(WorkspaceItem).filter(WorkspaceItem.category == "class_note")

    if subject_ids and subject_names:
        grades_query = grades_query.filter((GradeItem.subject_id.in_(subject_ids)) | (GradeItem.subject_name.in_(subject_names)))
        attendance_query = attendance_query.filter((AttendanceRecord.subject_id.in_(subject_ids)) | (AttendanceRecord.subject_name.in_(subject_names)))
    elif subject_ids:
        grades_query = grades_query.filter(GradeItem.subject_id.in_(subject_ids))
        attendance_query = attendance_query.filter(AttendanceRecord.subject_id.in_(subject_ids))
    elif subject_names:
        grades_query = grades_query.filter(GradeItem.subject_name.in_(subject_names))
        attendance_query = attendance_query.filter(AttendanceRecord.subject_name.in_(subject_names))

    if subject_names:
        deadlines_query = deadlines_query.filter(Deadline.subject.in_(subject_names))
        notes_query = notes_query.filter(WorkspaceItem.subject.in_(subject_names))

    resource_map = {
        "grades": {subject.id: [] for subject in subjects},
        "attendance": {subject.id: [] for subject in subjects},
        "deadlines": {subject.id: [] for subject in subjects},
        "schedules": db.query(Schedule).order_by(Schedule.day_of_week.asc(), Schedule.start_time.asc()).all(),
        "files": db.query(FileItem).order_by(FileItem.created_at.desc()).all(),
        "class_note_counts": {subject.id: 0 for subject in subjects},
    }

    subject_by_id = {subject.id: subject for subject in subjects}
    subject_by_name = {subject.name: subject for subject in subjects}

    for grade in grades_query.order_by(GradeItem.recorded_at.desc(), GradeItem.id.desc()).all():
        subject = subject_by_id.get(grade.subject_id) or subject_by_name.get(grade.subject_name)
        if subject:
            resource_map["grades"].setdefault(subject.id, []).append(grade)

    for record in attendance_query.order_by(AttendanceRecord.session_date.desc(), AttendanceRecord.id.desc()).all():
        subject = subject_by_id.get(record.subject_id) or subject_by_name.get(record.subject_name)
        if subject:
            resource_map["attendance"].setdefault(subject.id, []).append(record)

    for deadline in deadlines_query.order_by(Deadline.due_date.asc()).all():
        subject = subject_by_name.get(deadline.subject)
        if subject:
            resource_map["deadlines"].setdefault(subject.id, []).append(deadline)

    for note in notes_query.all():
        subject = subject_by_name.get(note.subject)
        if subject:
            resource_map["class_note_counts"][subject.id] = resource_map["class_note_counts"].get(subject.id, 0) + 1

    return resource_map


def build_subject_card_from_resources(subject: Subject, resources: dict):
    grades = resources["grades"].get(subject.id, [])
    attendance_records = resources["attendance"].get(subject.id, [])
    pending_deadlines = resources["deadlines"].get(subject.id, [])
    grade_summary = calculate_subject_grade(grades)
    attendance_summary = build_attendance_summary(attendance_records, subject.attendance_limit)
    linked_schedules = [item for item in resources["schedules"] if subject_match(subject, item.title)]
    linked_files = [item for item in resources["files"] if subject_match(subject, item.subject)]
    class_note_count = resources["class_note_counts"].get(subject.id, 0)

    risk_points = 0
    reasons = []

    if attendance_summary["risk"] == "danger":
        risk_points += 4
        reasons.append("chuyên cần nguy hiểm")
    elif attendance_summary["risk"] == "warning":
        risk_points += 2
        reasons.append("chuyên cần cần chú ý")

    urgent_deadline_count = 0
    today = date.today()
    for item in pending_deadlines:
        days_left = (item.due_date - today).days if item.due_date else None
        if days_left is not None and days_left <= 3:
            urgent_deadline_count += 1

    if urgent_deadline_count:
        risk_points += urgent_deadline_count * 2
        reasons.append(f"{urgent_deadline_count} deadline gần")

    if subject.progress_status == "needs_review":
        risk_points += 2
        reasons.append("cần xem lại")

    if grade_summary["score10"] is not None and subject.target_score is not None:
        if grade_summary["score10"] < subject.target_score:
            risk_points += 2
            reasons.append("điểm dưới mục tiêu")

    if risk_points >= 5:
        risk = "danger"
    elif risk_points >= 2:
        risk = "warning"
    else:
        risk = "stable"

    return {
        "id": subject.id,
        "name": subject.name,
        "lecturer": subject.lecturer,
        "credits": subject.credits or 0,
        "room": subject.room,
        "semester": subject.semester,
        "progressStatus": subject.progress_status,
        "attendanceLimit": subject.attendance_limit if subject.attendance_limit is not None else 3,
        "targetScore": subject.target_score,
        "note": subject.note,
        "gradeSummary": grade_summary,
        "attendanceSummary": attendance_summary,
        "pendingDeadlineCount": len(pending_deadlines),
        "urgentDeadlineCount": urgent_deadline_count,
        "scheduleCount": len(linked_schedules),
        "fileCount": len(linked_files),
        "classNoteCount": class_note_count,
        "risk": risk,
        "riskPoints": risk_points,
        "riskReasons": reasons,
    }


def build_subject_card(db: Session, subject: Subject):
    resources = load_student_hub_resources(db, [subject])
    return build_subject_card_from_resources(subject, resources)

def build_gpa_summary(subject_cards):
    total_credits = 0
    weighted_score10 = 0
    weighted_score4 = 0
    graded_subjects = 0

    for subject in subject_cards:
        credits = int(subject.get("credits") or 0)
        score10 = subject["gradeSummary"].get("score10")
        score4 = subject["gradeSummary"].get("score4")

        if credits <= 0 or score10 is None or score4 is None:
            continue

        total_credits += credits
        weighted_score10 += score10 * credits
        weighted_score4 += score4 * credits
        graded_subjects += 1

    if total_credits == 0:
        return {
            "gpa10": None,
            "gpa4": None,
            "totalCredits": 0,
            "gradedSubjects": 0,
            "letter": "--",
        }

    gpa10 = round(weighted_score10 / total_credits, 2)
    gpa4 = round(weighted_score4 / total_credits, 2)

    return {
        "gpa10": gpa10,
        "gpa4": gpa4,
        "totalCredits": total_credits,
        "gradedSubjects": graded_subjects,
        "letter": letter_grade(gpa10),
    }


def calendar_item(date_value: date, type_name: str, title: str, tone: str, **extra):
    return {
        "date": str(date_value),
        "type": type_name,
        "title": title,
        "tone": tone,
        **extra,
    }


def build_calendar_days(db: Session, days: int):
    today = date.today()
    day_count = max(7, min(days, 42))
    day_map = {}

    for index in range(day_count):
        current = today + timedelta(days=index)
        day_map[str(current)] = {
            "date": str(current),
            "dayLabel": DAY_LABELS[app_day_from_date(current)],
            "dayOfMonth": current.day,
            "isToday": index == 0,
            "items": [],
        }

    schedules = db.query(Schedule).all()
    events = db.query(Event).all()
    deadlines = db.query(Deadline).all()
    tasks = db.query(Task).all()

    for current_text, day in day_map.items():
        current = date.fromisoformat(current_text)
        app_day = app_day_from_date(current)

        for item in schedules:
            if item.day_of_week == app_day:
                day["items"].append(
                    calendar_item(
                        current,
                        "schedule",
                        item.title,
                        "blue" if item.category == "study" else "slate",
                        time=str(item.start_time)[:5] if item.start_time else None,
                        endTime=str(item.end_time)[:5] if item.end_time else None,
                        location=item.location,
                        sourceId=item.id,
                    )
                )

    for item in events:
        key = str(item.event_date)
        if key in day_map:
            day_map[key]["items"].append(
                calendar_item(
                    item.event_date,
                    "event",
                    item.title,
                    "violet" if item.priority != "high" else "red",
                    time=str(item.event_time)[:5] if item.event_time else None,
                    location=item.location,
                    sourceId=item.id,
                )
            )

    for item in tasks:
        key = str(item.task_date)
        if key in day_map and item.status != "done":
            day_map[key]["items"].append(
                calendar_item(
                    item.task_date,
                    "task",
                    item.title,
                    "green" if item.priority != "high" else "red",
                    time=str(item.start_time)[:5] if item.start_time else None,
                    endTime=str(item.end_time)[:5] if item.end_time else None,
                    priority=item.priority,
                    sourceId=item.id,
                )
            )

    for item in deadlines:
        key = str(item.due_date)
        if key in day_map and item.status != "done":
            days_left = (item.due_date - today).days
            day_map[key]["items"].append(
                calendar_item(
                    item.due_date,
                    "deadline",
                    item.title,
                    "red" if days_left <= 1 or item.priority == "high" else "orange",
                    subject=item.subject,
                    daysLeft=days_left,
                    priority=item.priority,
                    sourceId=item.id,
                )
            )

    result = list(day_map.values())
    for day in result:
        day["items"].sort(key=lambda item: (item.get("time") or "99:99", item["type"]))
        day["load"] = len(day["items"])
        day["dangerCount"] = len([item for item in day["items"] if item.get("tone") == "red"])

    return result


def build_today_actions(calendar_days, subject_cards, gpa_summary):
    today_items = calendar_days[0]["items"] if calendar_days else []
    actions = []

    urgent_items = [item for item in today_items if item["type"] == "deadline" or item.get("tone") == "red"]
    for item in urgent_items[:3]:
        actions.append({
            "tone": "danger",
            "label": "Việc bắt buộc",
            "title": item["title"],
            "detail": item.get("subject") or "Hạn trong hôm nay hoặc rất gần.",
        })

    schedule_items = [item for item in today_items if item["type"] == "schedule"]
    if schedule_items:
        item = schedule_items[0]
        actions.append({
            "tone": "blue",
            "label": "Lịch đầu tiên",
            "title": item["title"],
            "detail": f"{item.get('time') or '--:--'} - {item.get('endTime') or '--:--'}{(' · ' + item.get('location')) if item.get('location') else ''}",
        })

    task_items = [item for item in today_items if item["type"] == "task"]
    if task_items:
        item = task_items[0]
        actions.append({
            "tone": "green",
            "label": "Việc nên xử lý",
            "title": item["title"],
            "detail": "Hoàn thành sớm để giảm tải cho cuối ngày.",
        })

    risky_subjects = [item for item in subject_cards if item["risk"] in ["danger", "warning"]]
    risky_subjects.sort(key=lambda item: item["riskPoints"], reverse=True)
    if risky_subjects:
        item = risky_subjects[0]
        actions.append({
            "tone": item["risk"],
            "label": "Môn cần chú ý",
            "title": item["name"],
            "detail": ", ".join(item["riskReasons"]) or item["attendanceSummary"]["message"],
        })

    if gpa_summary.get("gpa10") is not None:
        actions.append({
            "tone": "slate",
            "label": "Điểm học kỳ",
            "title": f"GPA tạm tính {gpa_summary['gpa10']}/10 · {gpa_summary['gpa4']}/4",
            "detail": f"Đã có điểm của {gpa_summary['gradedSubjects']} môn, {gpa_summary['totalCredits']} tín chỉ.",
        })

    if not actions:
        actions.append({
            "tone": "stable",
            "label": "Trạng thái ổn",
            "title": "Hôm nay chưa có áp lực lớn",
            "detail": "Nên dùng thời gian để ôn một môn khó hoặc dọn lại tài liệu.",
        })

    return actions[:6]


def build_workload_summary(calendar_days):
    total_items = sum(day["load"] for day in calendar_days)
    danger_items = sum(day["dangerCount"] for day in calendar_days)
    busiest_day = max(calendar_days, key=lambda day: day["load"], default=None)

    return {
        "totalItems": total_items,
        "dangerItems": danger_items,
        "busiestDay": busiest_day,
    }


def attach_subject_name(db: Session, payload: dict):
    subject_id = payload.get("subject_id")

    if subject_id:
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if subject:
            payload["subject_name"] = subject.name

    if payload.get("subject_name"):
        payload["subject_name"] = str(payload["subject_name"]).strip()

    return payload


@router.get("/summary")
def get_student_hub_summary(
    days: int = Query(default=14, ge=7, le=42),
    db: Session = Depends(get_db),
):
    subjects = db.query(Subject).order_by(Subject.name.asc()).all()
    resources = load_student_hub_resources(db, subjects)
    subject_cards = [build_subject_card_from_resources(subject, resources) for subject in subjects]
    subject_cards.sort(key=lambda item: (item["risk"] != "danger", item["risk"] != "warning", -item["riskPoints"], item["name"]))

    gpa_summary = build_gpa_summary(subject_cards)
    calendar_days = build_calendar_days(db, days)
    today_actions = build_today_actions(calendar_days, subject_cards, gpa_summary)
    workload_summary = build_workload_summary(calendar_days)
    gamification_summary = build_gamification_summary(db)

    attendance_warning_count = len([
        item for item in subject_cards if item["attendanceSummary"]["risk"] in ["danger", "warning"]
    ])

    return {
        "todayActions": today_actions,
        "calendarDays": calendar_days,
        "subjects": subject_cards,
        "gpaSummary": gpa_summary,
        "workloadSummary": workload_summary,
        "gamificationSummary": gamification_summary,
        "overview": {
            "subjectCount": len(subject_cards),
            "attendanceWarningCount": attendance_warning_count,
            "riskySubjectCount": len([item for item in subject_cards if item["risk"] != "stable"]),
            "calendarItemCount": workload_summary["totalItems"],
            "dangerCalendarItemCount": workload_summary["dangerItems"],
        },
    }


@router.get("/subjects/{subject_id}")
def get_subject_center(
    subject_id: int,
    notes_limit: int = Query(default=30, ge=1, le=200),
    notes_offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")

    card = build_subject_card(db, subject)

    schedules = [
        item
        for item in db.query(Schedule).order_by(Schedule.day_of_week.asc(), Schedule.start_time.asc()).all()
        if subject_match(subject, item.title)
    ]

    deadlines = (
        db.query(Deadline)
        .filter(Deadline.subject == subject.name)
        .order_by(Deadline.due_date.asc())
        .all()
    )

    files = [item for item in db.query(FileItem).order_by(FileItem.created_at.desc()).all() if subject_match(subject, item.subject)]
    grades = get_subject_grade_items(db, subject)
    attendance_records = get_subject_attendance_records(db, subject)
    class_notes, class_notes_total = get_subject_class_notes(db, subject, limit=notes_limit, offset=notes_offset)

    return {
        "subject": card,
        "schedules": [
            {
                "id": item.id,
                "dayOfWeek": item.day_of_week,
                "dayLabel": DAY_LABELS.get(item.day_of_week, "--"),
                "startTime": str(item.start_time)[:5] if item.start_time else None,
                "endTime": str(item.end_time)[:5] if item.end_time else None,
                "title": item.title,
                "category": item.category,
                "location": item.location,
                "note": item.note,
            }
            for item in schedules
        ],
        "deadlines": [
            {
                "id": item.id,
                "title": item.title,
                "type": item.type,
                "dueDate": str(item.due_date),
                "daysLeft": (item.due_date - date.today()).days if item.due_date else None,
                "priority": item.priority,
                "status": item.status,
                "note": item.note,
            }
            for item in deadlines
        ],
        "files": [
            {
                "id": item.id,
                "name": item.original_name,
                "fileType": item.file_type,
                "module": item.module,
                "url": item.url,
                "tags": item.tags,
                "note": item.note,
                "createdAt": item.created_at.isoformat() if item.created_at else None,
            }
            for item in files[:12]
        ],
        "grades": [serialize_grade(item) for item in grades],
        "attendanceRecords": [serialize_attendance(item) for item in attendance_records],
        "classNotes": [serialize_class_note(item) for item in class_notes],
        "classNotesTotal": class_notes_total,
        "classNotesLimit": notes_limit,
        "classNotesOffset": notes_offset,
        "classNotesHasMore": notes_offset + len(class_notes) < class_notes_total,
    }


@router.post("/subjects/{subject_id}/class-notes")
def create_subject_class_note(subject_id: int, payload: ClassNotePayload, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Không tìm thấy môn học")

    target_date = payload.target_date or date.today()
    title = payload.title.strip() if payload.title and payload.title.strip() else f"Ghi chép {target_date.strftime('%d/%m')}: {subject.name}"

    item = WorkspaceItem(
        module="study",
        category="class_note",
        status="active",
        priority=payload.priority or "medium",
        subject=subject.name,
        target_date=target_date,
        title=title,
        content=sanitize_rich_html(payload.content),
        tags=payload.tags or "#ghi-chep-bai-giang",
    )

    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_class_note(item)


@router.put("/class-notes/{note_id}")
def update_subject_class_note(note_id: int, payload: ClassNotePayload, db: Session = Depends(get_db)):
    item = get_class_note_or_404(db, note_id)

    item.title = payload.title.strip() if payload.title and payload.title.strip() else item.title
    item.content = sanitize_rich_html(payload.content)
    item.target_date = payload.target_date or item.target_date
    item.tags = payload.tags
    item.priority = payload.priority or item.priority
    item.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)
    return serialize_class_note(item)


@router.delete("/class-notes/{note_id}")
def delete_subject_class_note(note_id: int, db: Session = Depends(get_db)):
    item = get_class_note_or_404(db, note_id)
    db.delete(item)
    db.commit()
    return {"message": "Đã xóa ghi chép bài giảng", "id": note_id}


@router.post("/grades", response_model=GradeItemResponse)
def create_grade_item(payload: GradeItemCreate, db: Session = Depends(get_db)):
    data = attach_subject_name(db, payload.model_dump())
    item = GradeItem(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/grades/{grade_id}", response_model=GradeItemResponse)
def update_grade_item(grade_id: int, payload: GradeItemUpdate, db: Session = Depends(get_db)):
    item = db.query(GradeItem).filter(GradeItem.id == grade_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy đầu điểm")

    data = attach_subject_name(db, payload.model_dump(exclude_unset=True))
    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/grades/{grade_id}")
def delete_grade_item(grade_id: int, db: Session = Depends(get_db)):
    item = db.query(GradeItem).filter(GradeItem.id == grade_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy đầu điểm")

    db.delete(item)
    db.commit()
    return {"message": "Đã xóa đầu điểm", "id": grade_id}


@router.post("/attendance", response_model=AttendanceRecordResponse)
def create_attendance_record(payload: AttendanceRecordCreate, db: Session = Depends(get_db)):
    data = attach_subject_name(db, payload.model_dump())
    item = AttendanceRecord(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/attendance/{record_id}", response_model=AttendanceRecordResponse)
def update_attendance_record(record_id: int, payload: AttendanceRecordUpdate, db: Session = Depends(get_db)):
    item = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi chuyên cần")

    data = attach_subject_name(db, payload.model_dump(exclude_unset=True))
    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/attendance/{record_id}")
def delete_attendance_record(record_id: int, db: Session = Depends(get_db)):
    item = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi chuyên cần")

    db.delete(item)
    db.commit()
    return {"message": "Đã xóa bản ghi chuyên cần", "id": record_id}
