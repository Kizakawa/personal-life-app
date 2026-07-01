import json
import re
from datetime import date, datetime, timedelta

from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.models.attendance_record import AttendanceRecord
from app.models.deadline import Deadline
from app.models.expense import Expense
from app.models.grade_item import GradeItem
from app.models.person import Person
from app.models.schedule import Schedule
from app.models.subject import Subject
from app.models.task import Task
from app.models.workspace_item import WorkspaceItem


AI_DEFAULT_SETTINGS = {
    "ai_model": "gemini-2.0-flash",
    "ai_allow_tasks": "1",
    "ai_allow_deadlines": "1",
    "ai_allow_schedule": "1",
    "ai_allow_study": "1",
    "ai_allow_grades": "1",
    "ai_allow_finance": "0",
    "ai_allow_journal": "0",
    "ai_allow_people": "0",
    "ai_allow_class_notes": "0",
}


def setting_to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default

    return str(value).strip().lower() in {"1", "true", "on", "yes", "y"}


def get_setting_map(db: Session) -> dict[str, str | None]:
    rows = db.query(AppSetting).all()
    values = {row.key: row.value for row in rows}

    for key, value in AI_DEFAULT_SETTINGS.items():
        values.setdefault(key, value)

    return values


def get_setting_value(db: Session, key: str, default: str | None = None) -> str | None:
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()

    if setting and setting.value is not None:
        return setting.value

    return default


def upsert_setting(db: Session, key: str, value: str | None, note: str | None = None):
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()

    if setting:
        setting.value = value
        if note is not None:
            setting.note = note
    else:
        setting = AppSetting(key=key, value=value, note=note)
        db.add(setting)

    return setting


def ensure_ai_default_settings(db: Session):
    notes = {
        "ai_model": "Model Gemini dùng cho Trợ lý AI",
        "ai_allow_tasks": "Cho phép AI đọc task/kế hoạch ngày",
        "ai_allow_deadlines": "Cho phép AI đọc deadline",
        "ai_allow_schedule": "Cho phép AI đọc thời khóa biểu",
        "ai_allow_study": "Cho phép AI đọc tổng quan môn học",
        "ai_allow_grades": "Cho phép AI đọc điểm/chuyên cần",
        "ai_allow_finance": "Cho phép AI đọc dữ liệu chi tiêu",
        "ai_allow_journal": "Cho phép AI đọc nhật ký",
        "ai_allow_people": "Cho phép AI đọc dữ liệu người quan trọng",
        "ai_allow_class_notes": "Cho phép AI đọc ghi chú/kho tri thức học tập",
    }

    for key, value in AI_DEFAULT_SETTINGS.items():
        if not db.query(AppSetting).filter(AppSetting.key == key).first():
            db.add(AppSetting(key=key, value=value, note=notes.get(key)))


def plain_excerpt(value: str | None, limit: int = 900) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def extract_keywords(message: str | None, limit: int = 8) -> list[str]:
    if not message:
        return []

    words = re.findall(r"[\wÀ-ỹ]+", message.lower())
    stop_words = {
        "toi",
        "tôi",
        "ban",
        "bạn",
        "hay",
        "hãy",
        "cho",
        "minh",
        "mình",
        "cua",
        "của",
        "nhung",
        "những",
        "cac",
        "các",
        "mot",
        "một",
        "nay",
        "này",
        "the",
        "thế",
        "nao",
        "nào",
        "la",
        "là",
        "gi",
        "gì",
    }
    keywords = []

    for word in words:
        if len(word) < 3 or word in stop_words:
            continue

        if word not in keywords:
            keywords.append(word)

    return keywords[:limit]


def get_relevant_class_notes(db: Session, message: str | None, limit: int = 2):
    keywords = extract_keywords(message)

    query = (
        db.query(WorkspaceItem)
        .filter(WorkspaceItem.module.in_(["study", "knowledge", "documents"]))
        .filter(WorkspaceItem.content.isnot(None))
    )

    if keywords:
        conditions = []

        for keyword in keywords[:6]:
            pattern = f"%{keyword}%"
            conditions.extend(
                [
                    WorkspaceItem.title.ilike(pattern),
                    WorkspaceItem.subject.ilike(pattern),
                    WorkspaceItem.tags.ilike(pattern),
                    WorkspaceItem.content.ilike(pattern),
                ]
            )

        query = query.filter(or_(*conditions))

    candidates = query.order_by(WorkspaceItem.updated_at.desc()).limit(18).all()

    if not keywords:
        return candidates[:limit]

    def score(item: WorkspaceItem) -> int:
        haystack = " ".join(
            [
                item.title or "",
                item.subject or "",
                item.tags or "",
                plain_excerpt(item.content, 1600),
            ]
        ).lower()
        return sum(haystack.count(keyword) for keyword in keywords)

    return sorted(candidates, key=score, reverse=True)[:limit]


def search_knowledge(db: Session, query_text: str | None, limit: int = 2) -> list[dict]:
    keywords = extract_keywords(query_text, limit=6)

    if keywords:
        fts_query = " OR ".join(f'"{keyword}"' for keyword in keywords)

        try:
            rows = (
                db.execute(
                    text(
                        """
                        SELECT
                            wi.id,
                            wi.module,
                            wi.title,
                            wi.subject,
                            wi.content,
                            bm25(workspace_fts) AS score
                        FROM workspace_fts
                        JOIN workspace_items wi ON wi.id = CAST(workspace_fts.id AS INTEGER)
                        WHERE workspace_fts MATCH :query
                          AND wi.module IN ('study', 'knowledge', 'documents')
                          AND wi.content IS NOT NULL
                        ORDER BY score ASC
                        LIMIT :limit
                        """
                    ),
                    {"query": fts_query, "limit": limit},
                )
                .mappings()
                .all()
            )

            if rows:
                return [
                    {
                        "id": row["id"],
                        "module": row["module"],
                        "title": row["title"],
                        "subject": row["subject"],
                        "content": row["content"],
                    }
                    for row in rows
                ]
        except Exception:
            pass

    return [
        {
            "id": item.id,
            "module": item.module,
            "title": item.title,
            "subject": item.subject,
            "content": item.content,
        }
        for item in get_relevant_class_notes(db, query_text, limit=limit)
    ]


def build_ai_context(db: Session, user_message: str | None = None):
    settings = get_setting_map(db)
    today = date.today()
    task_window_end = today + timedelta(days=7)
    week_later = today + timedelta(days=7)
    grade_window_start = datetime.combine(today - timedelta(days=180), datetime.min.time())
    attendance_window_start = today - timedelta(days=120)
    safe_summary = {}
    raw_context = []

    def allowed(key: str, default: bool = False) -> bool:
        return setting_to_bool(settings.get(key), default)

    if allowed("ai_allow_tasks", True):
        tasks = (
            db.query(Task)
            .filter(Task.task_date >= today)
            .filter(Task.task_date <= task_window_end)
            .filter(Task.status != "done")
            .order_by(Task.task_date.asc(), Task.priority.desc(), Task.start_time.asc().nulls_last())
            .limit(12)
            .all()
        )
        safe_summary["tasks_next_7_days"] = [
            {
                "title": task.title,
                "task_date": str(task.task_date),
                "priority": task.priority,
                "status": task.status,
                "time": str(task.start_time) if task.start_time else None,
            }
            for task in tasks
        ]
        raw_context.append(
            "TASK CHUA XONG TRONG 7 NGAY TOI:\n"
            + json.dumps(safe_summary["tasks_next_7_days"], ensure_ascii=False)
        )

    if allowed("ai_allow_deadlines", True):
        deadlines = (
            db.query(Deadline)
            .filter(Deadline.due_date >= today)
            .filter(Deadline.due_date <= week_later)
            .filter(Deadline.status != "done")
            .order_by(Deadline.due_date.asc(), Deadline.priority.desc())
            .limit(10)
            .all()
        )
        safe_summary["deadlines_7_days"] = [
            {
                "title": item.title,
                "subject": item.subject,
                "due_date": str(item.due_date),
                "priority": item.priority,
                "status": item.status,
            }
            for item in deadlines
        ]
        raw_context.append(
            "DEADLINE 7 NGAY TOI:\n"
            + json.dumps(safe_summary["deadlines_7_days"], ensure_ascii=False)
        )

    if allowed("ai_allow_schedule", True):
        schedules = (
            db.query(Schedule)
            .filter(Schedule.day_of_week == today.weekday())
            .order_by(Schedule.start_time.asc())
            .limit(10)
            .all()
        )
        safe_summary["schedule_today"] = [
            {
                "title": item.title,
                "category": item.category,
                "start_time": str(item.start_time),
                "end_time": str(item.end_time),
                "location": item.location,
            }
            for item in schedules
        ]
        raw_context.append(
            "LICH HOM NAY:\n" + json.dumps(safe_summary["schedule_today"], ensure_ascii=False)
        )

    if allowed("ai_allow_study", True):
        subjects = db.query(Subject).order_by(Subject.updated_at.desc()).limit(8).all()
        safe_summary["study_overview"] = [
            {
                "name": item.name,
                "semester": item.semester,
                "progress_status": item.progress_status,
                "target_score": item.target_score,
            }
            for item in subjects
        ]
        raw_context.append(
            "TONG QUAN MON HOC:\n" + json.dumps(safe_summary["study_overview"], ensure_ascii=False)
        )

    if allowed("ai_allow_grades", True):
        grades = (
            db.query(GradeItem)
            .filter(GradeItem.recorded_at >= grade_window_start)
            .order_by(GradeItem.recorded_at.desc())
            .limit(12)
            .all()
        )
        attendance_risks = (
            db.query(AttendanceRecord.subject_name, func.count(AttendanceRecord.id))
            .filter(AttendanceRecord.session_date >= attendance_window_start)
            .filter(AttendanceRecord.status.in_(["absent", "late"]))
            .group_by(AttendanceRecord.subject_name)
            .limit(8)
            .all()
        )
        safe_summary["recent_grades"] = [
            {
                "subject": item.subject_name,
                "title": item.title,
                "score": item.score,
                "max_score": item.max_score,
                "weight_percent": item.weight_percent,
            }
            for item in grades
        ]
        safe_summary["attendance_risks"] = [
            {"subject": subject_name or "Không rõ", "risk_count": count}
            for subject_name, count in attendance_risks
        ]
        raw_context.append(
            "DIEM VA CHUYEN CAN:\n"
            + json.dumps(
                {
                    "recent_grades": safe_summary["recent_grades"],
                    "attendance_risks": safe_summary["attendance_risks"],
                },
                ensure_ascii=False,
            )
        )

    if allowed("ai_allow_finance", False):
        month_start = today.replace(day=1)
        rows = (
            db.query(Expense.transaction_type, Expense.category, func.sum(Expense.amount))
            .filter(Expense.transaction_date >= month_start)
            .filter(Expense.transaction_date <= today)
            .group_by(Expense.transaction_type, Expense.category)
            .all()
        )
        safe_summary["finance_this_month"] = [
            {"type": item_type, "category": category, "amount": int(amount or 0)}
            for item_type, category, amount in rows
        ]
        raw_context.append(
            "TAI CHINH THANG NAY:\n"
            + json.dumps(safe_summary["finance_this_month"], ensure_ascii=False)
        )

    if allowed("ai_allow_people", False):
        people = (
            db.query(Person)
            .order_by(Person.priority_level.asc(), Person.last_contact_date.asc().nulls_last())
            .limit(8)
            .all()
        )
        safe_summary["people_context"] = [
            {
                "name": item.full_name,
                "relationship": item.relationship,
                "priority_level": item.priority_level,
                "next_action": item.next_action,
            }
            for item in people
        ]
        raw_context.append(
            "NGUOI QUAN TRONG:\n"
            + json.dumps(safe_summary["people_context"], ensure_ascii=False)
        )

    if allowed("ai_allow_journal", False):
        notes = (
            db.query(WorkspaceItem)
            .filter(WorkspaceItem.module == "journal")
            .filter(WorkspaceItem.target_date >= today - timedelta(days=30))
            .order_by(WorkspaceItem.target_date.desc().nulls_last(), WorkspaceItem.updated_at.desc())
            .limit(5)
            .all()
        )
        safe_summary["journal_entries"] = [
            {
                "date": str(item.target_date) if item.target_date else None,
                "title": item.title,
                "category": item.category,
                "tags": item.tags,
            }
            for item in notes
        ]
        raw_context.append(
            "NHAT KY:\n"
            + json.dumps(
                [
                    {
                        "date": str(item.target_date) if item.target_date else None,
                        "title": item.title,
                        "category": item.category,
                        "tags": item.tags,
                        "content_excerpt": plain_excerpt(item.content, 700),
                    }
                    for item in notes
                ],
                ensure_ascii=False,
            )
        )

    if allowed("ai_allow_class_notes", False):
        notes = search_knowledge(db, user_message, limit=2)
        safe_summary["rag_keywords"] = extract_keywords(user_message, limit=6)
        safe_summary["class_notes"] = [
            {"module": item["module"], "title": item["title"], "subject": item["subject"]}
            for item in notes
        ]
        raw_context.append(
            "TAI LIEU GHI CHEP CUA NGUOI DUNG, DA TRUY XUAT BANG MINI-RAG:\n"
            + json.dumps(
                [
                    {
                        "module": item["module"],
                        "title": item["title"],
                        "subject": item["subject"],
                        "content_excerpt": plain_excerpt(item["content"], 1200),
                    }
                    for item in notes
                ],
                ensure_ascii=False,
            )
        )

    safe_summary["privacy"] = {
        key: allowed(key, key in {
            "ai_allow_tasks",
            "ai_allow_deadlines",
            "ai_allow_schedule",
            "ai_allow_study",
            "ai_allow_grades",
        })
        for key in AI_DEFAULT_SETTINGS
        if key.startswith("ai_allow_")
    }

    system_instruction = (
        "Ban la Tro ly AI co van ca nhan cho ung dung Personal Life App. "
        "Chi duoc dua tren du lieu ngu canh duoc cap ben duoi. "
        "Neu khong co du lieu, hay noi ro la ban chua du thong tin. "
        "Khong yeu cau hoac tiet lo API key, mat khau, token. "
        "Khong tu nhan rang da sua/xoa/tao du lieu vi ban chi co quyen doc. "
        "Tra loi bang tieng Viet, ngan gon, co thu tu uu tien neu phu hop.\n\n"
        "DU LIEU DUOC CAP:\n"
        + "\n\n".join(raw_context)
    )

    return {
        "safe_summary": safe_summary,
        "raw_context": system_instruction,
    }
