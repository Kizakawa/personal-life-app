from datetime import date, datetime, time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(
    prefix="/search",
    tags=["Search"],
)


def to_text(value):
    if value is None:
        return ""

    if isinstance(value, (date, datetime, time)):
        return str(value)

    return str(value)


def get_value(obj, names, default=""):
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)
            if value is not None:
                return value

    return default


def contains_keyword(keyword, values):
    keyword = keyword.lower().strip()

    for value in values:
        if keyword in to_text(value).lower():
            return True

    return False


def make_result(
    source,
    source_label,
    item_id,
    title,
    subtitle="",
    detail="",
    tags="",
    url="",
    file_download_path="",
):
    return {
        "source": source,
        "sourceLabel": source_label,
        "id": item_id,
        "title": to_text(title) or "Không có tiêu đề",
        "subtitle": to_text(subtitle),
        "detail": to_text(detail),
        "tags": to_text(tags),
        "url": to_text(url),
        "fileDownloadPath": to_text(file_download_path),
    }


def search_workspace_items(db: Session, keyword: str):
    try:
        from app.models.workspace_item import WorkspaceItem
    except Exception:
        return []

    try:
        items = db.query(WorkspaceItem).all()
    except Exception:
        return []

    results = []

    module_labels = {
        "study": "Học tập",
        "class_notes": "Hỗ trợ ghi bài",
        "knowledge": "Kho tri thức",
        "exam": "Ôn thi",
        "documents": "Tài liệu",
        "journal": "Nhật ký",
        "commands": "Lệnh thường dùng",
    }

    for item in items:
        values = [
            get_value(item, ["title"]),
            get_value(item, ["category"]),
            get_value(item, ["status"]),
            get_value(item, ["priority"]),
            get_value(item, ["subject"]),
            get_value(item, ["project_name"]),
            get_value(item, ["target_date"]),
            get_value(item, ["file_path"]),
            get_value(item, ["url"]),
            get_value(item, ["tags"]),
            get_value(item, ["content"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        module = get_value(item, ["module"], "workspace")

        results.append(
            make_result(
                source=module,
                source_label=module_labels.get(module, "Dữ liệu mở rộng"),
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["title"], "Dữ liệu"),
                subtitle=f"{get_value(item, ['category'])} - {get_value(item, ['status'])}",
                detail=get_value(item, ["content"]),
                tags=get_value(item, ["tags"]),
                url=get_value(item, ["url"]),
            )
        )

    return results


def search_subjects(db: Session, keyword: str):
    try:
        from app.models.subject import Subject
    except Exception:
        return []

    try:
        items = db.query(Subject).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["name"]),
            get_value(item, ["lecturer"]),
            get_value(item, ["credits"]),
            get_value(item, ["room"]),
            get_value(item, ["semester"]),
            get_value(item, ["progress_status"]),
            get_value(item, ["note"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        results.append(
            make_result(
                source="subjects",
                source_label="Môn học",
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["name"], "Môn học"),
                subtitle=f"{get_value(item, ['lecturer'])} - {get_value(item, ['progress_status'])}",
                detail=get_value(item, ["note"]),
            )
        )

    return results


def search_projects(db: Session, keyword: str):
    try:
        from app.models.project import Project
    except Exception:
        return []

    try:
        items = db.query(Project).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["name"]),
            get_value(item, ["goal"]),
            get_value(item, ["status"]),
            get_value(item, ["priority"]),
            get_value(item, ["deadline_date"]),
            get_value(item, ["todo"]),
            get_value(item, ["current_bug"]),
            get_value(item, ["solution"]),
            get_value(item, ["related_files"]),
            get_value(item, ["note"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        results.append(
            make_result(
                source="projects",
                source_label="Dự án",
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["name"], "Dự án"),
                subtitle=f"{get_value(item, ['status'])} - {get_value(item, ['priority'])}",
                detail=get_value(item, ["goal"]) or get_value(item, ["current_bug"]),
                tags=get_value(item, ["related_files"]),
            )
        )

    return results


def search_file_items(db: Session, keyword: str):
    try:
        from app.models.file_item import FileItem
    except Exception:
        return []

    try:
        items = db.query(FileItem).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["original_name"]),
            get_value(item, ["stored_name"]),
            get_value(item, ["file_path"]),
            get_value(item, ["file_type"]),
            get_value(item, ["module"]),
            get_value(item, ["subject"]),
            get_value(item, ["project_name"]),
            get_value(item, ["url"]),
            get_value(item, ["tags"]),
            get_value(item, ["note"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        file_id = get_value(item, ["id"])

        results.append(
            make_result(
                source="files",
                source_label="File upload",
                item_id=file_id,
                title=get_value(item, ["original_name"], "File"),
                subtitle=f"{get_value(item, ['file_type'])} - {get_value(item, ['subject']) or get_value(item, ['project_name'])}",
                detail=get_value(item, ["note"]),
                tags=get_value(item, ["tags"]),
                url=get_value(item, ["url"]),
                file_download_path=f"/files/{file_id}/download"
                if get_value(item, ["file_path"])
                else "",
            )
        )

    return results


def search_deadlines(db: Session, keyword: str):
    try:
        from app.models.deadline import Deadline
    except Exception:
        return []

    try:
        items = db.query(Deadline).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["title"]),
            get_value(item, ["subject"]),
            get_value(item, ["type"]),
            get_value(item, ["due_date"]),
            get_value(item, ["priority"]),
            get_value(item, ["status"]),
            get_value(item, ["note"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        results.append(
            make_result(
                source="deadlines",
                source_label="Deadline",
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["title"], "Deadline"),
                subtitle=f"{get_value(item, ['subject'])} - {get_value(item, ['due_date'])}",
                detail=get_value(item, ["note"]),
            )
        )

    return results


def search_tasks(db: Session, keyword: str):
    try:
        from app.models.task import Task
    except Exception:
        return []

    try:
        items = db.query(Task).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["title"]),
            get_value(item, ["task_date"]),
            get_value(item, ["start_time"]),
            get_value(item, ["end_time"]),
            get_value(item, ["priority"]),
            get_value(item, ["status"]),
            get_value(item, ["note"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        results.append(
            make_result(
                source="tasks",
                source_label="Kế hoạch ngày",
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["title"], "Task"),
                subtitle=f"{get_value(item, ['task_date'])} - {get_value(item, ['status'])}",
                detail=get_value(item, ["note"]),
            )
        )

    return results


def search_people(db: Session, keyword: str):
    try:
        from app.models.person import Person
    except Exception:
        return []

    try:
        items = db.query(Person).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["full_name"]),
            get_value(item, ["relationship"]),
            get_value(item, ["birthday"]),
            get_value(item, ["phone"]),
            get_value(item, ["priority_level"]),
            get_value(item, ["likes"]),
            get_value(item, ["dislikes"]),
            get_value(item, ["personality_notes"]),
            get_value(item, ["conversation_notes"]),
            get_value(item, ["gift_ideas"]),
            get_value(item, ["important_notes"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        results.append(
            make_result(
                source="people",
                source_label="Người quan trọng",
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["full_name"], "Người quan trọng"),
                subtitle=get_value(item, ["relationship"]),
                detail=get_value(item, ["important_notes"])
                or get_value(item, ["conversation_notes"]),
                tags=get_value(item, ["likes"]),
            )
        )

    return results


def search_events(db: Session, keyword: str):
    try:
        from app.models.event import Event
    except Exception:
        return []

    try:
        items = db.query(Event).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["title"]),
            get_value(item, ["event_date"]),
            get_value(item, ["event_time"]),
            get_value(item, ["note"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        results.append(
            make_result(
                source="events",
                source_label="Sự kiện",
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["title"], "Sự kiện"),
                subtitle=f"{get_value(item, ['event_date'])} {get_value(item, ['event_time'])}",
                detail=get_value(item, ["note"]),
            )
        )

    return results


def search_schedules(db: Session, keyword: str):
    try:
        from app.models.schedule import Schedule
    except Exception:
        return []

    try:
        items = db.query(Schedule).all()
    except Exception:
        return []

    results = []

    for item in items:
        values = [
            get_value(item, ["day_of_week"]),
            get_value(item, ["start_time"]),
            get_value(item, ["end_time"]),
            get_value(item, ["title"]),
            get_value(item, ["category"]),
            get_value(item, ["location"]),
            get_value(item, ["note"]),
        ]

        if not contains_keyword(keyword, values):
            continue

        results.append(
            make_result(
                source="schedules",
                source_label="Thời khóa biểu",
                item_id=get_value(item, ["id"]),
                title=get_value(item, ["title"], "Lịch"),
                subtitle=f"{get_value(item, ['day_of_week'])} - {get_value(item, ['start_time'])}",
                detail=get_value(item, ["note"]),
            )
        )

    return results


@router.get("/")
def global_search(keyword: str, db: Session = Depends(get_db)):
    keyword = keyword.strip()

    if not keyword:
        return []

    results = []

    results.extend(search_file_items(db, keyword))
    results.extend(search_projects(db, keyword))
    results.extend(search_subjects(db, keyword))
    results.extend(search_deadlines(db, keyword))
    results.extend(search_tasks(db, keyword))
    results.extend(search_workspace_items(db, keyword))
    results.extend(search_people(db, keyword))
    results.extend(search_events(db, keyword))
    results.extend(search_schedules(db, keyword))

    return results[:100]
