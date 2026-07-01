import json
import shutil
import zipfile
from datetime import date, datetime, time
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import Date, DateTime, Integer, Time
from sqlalchemy.orm import Session

from app.database import get_db
from app.storage import UPLOAD_DIR, ensure_storage_dirs

router = APIRouter(
    prefix="/backup",
    tags=["Backup"],
)

ensure_storage_dirs()

SENSITIVE_SETTING_KEYS = {"gemini_api_key"}


def serialize_value(value):
    if isinstance(value, (date, datetime, time)):
        return str(value)

    return value


def serialize_model(obj):
    result = {}

    for key, value in obj.__dict__.items():
        if key.startswith("_"):
            continue

        result[key] = serialize_value(value)

    return result


def export_table(db: Session, model):
    try:
        rows = [serialize_model(item) for item in db.query(model).all()]

        if getattr(model, "__tablename__", None) == "app_settings":
            rows = [
                row
                for row in rows
                if row.get("key") not in SENSITIVE_SETTING_KEYS
            ]

        return rows
    except Exception:
        return []


def parse_value(column, value):
    if value == "" or value is None:
        return None

    column_type = column.type

    try:
        if isinstance(column_type, DateTime):
            return datetime.fromisoformat(str(value))

        if isinstance(column_type, Date):
            return date.fromisoformat(str(value))

        if isinstance(column_type, Time):
            return time.fromisoformat(str(value))

        if isinstance(column_type, Integer):
            return int(value)
    except Exception:
        return value

    return value


def restore_table(db: Session, model, rows):
    if not isinstance(rows, list):
        return 0

    preserved_sensitive_rows = []

    if getattr(model, "__tablename__", None) == "app_settings":
        preserved_sensitive_rows = [
            serialize_model(item)
            for item in db.query(model).all()
            if getattr(item, "key", None) in SENSITIVE_SETTING_KEYS
        ]
        rows = [
            row
            for row in rows
            if isinstance(row, dict) and row.get("key") not in SENSITIVE_SETTING_KEYS
        ]

    columns = {column.name: column for column in model.__table__.columns}

    db.query(model).delete()

    restored_count = 0

    for row in rows:
        if not isinstance(row, dict):
            continue

        data = {}

        for key, value in row.items():
            if key not in columns:
                continue

            data[key] = parse_value(columns[key], value)

        item = model(**data)
        db.add(item)
        restored_count += 1

    for row in preserved_sensitive_rows:
        data = {}

        for key, value in row.items():
            if key not in columns:
                continue

            data[key] = parse_value(columns[key], value)

        db.add(model(**data))

    return restored_count


def build_backup_data(db: Session):
    backup_data = {
        "events": [],
        "schedules": [],
        "expenses": [],
        "people": [],
        "deadlines": [],
        "tasks": [],
        "subjects": [],
        "gradeItems": [],
        "attendanceRecords": [],
        "focusSessions": [],
        "gamificationEvents": [],
        "projects": [],
        "workspaceItems": [],
        "fileItems": [],
        "settings": [],
        "metadata": [],
        "exportedAt": datetime.now().isoformat(timespec="seconds"),
        "app": "personal-life-app",
        "backupType": "zip-with-uploads",
    }

    try:
        from app.models.event import Event
        backup_data["events"] = export_table(db, Event)
    except Exception:
        pass

    try:
        from app.models.schedule import Schedule
        backup_data["schedules"] = export_table(db, Schedule)
    except Exception:
        pass

    try:
        from app.models.expense import Expense
        backup_data["expenses"] = export_table(db, Expense)
    except Exception:
        pass

    try:
        from app.models.person import Person
        backup_data["people"] = export_table(db, Person)
    except Exception:
        pass

    try:
        from app.models.deadline import Deadline
        backup_data["deadlines"] = export_table(db, Deadline)
    except Exception:
        pass

    try:
        from app.models.task import Task
        backup_data["tasks"] = export_table(db, Task)
    except Exception:
        pass

    try:
        from app.models.subject import Subject
        backup_data["subjects"] = export_table(db, Subject)
    except Exception:
        pass

    try:
        from app.models.grade_item import GradeItem
        backup_data["gradeItems"] = export_table(db, GradeItem)
    except Exception:
        pass

    try:
        from app.models.attendance_record import AttendanceRecord
        backup_data["attendanceRecords"] = export_table(db, AttendanceRecord)
    except Exception:
        pass

    try:
        from app.models.focus_session import FocusSession
        backup_data["focusSessions"] = export_table(db, FocusSession)
    except Exception:
        pass

    try:
        from app.models.gamification_event import GamificationEvent
        backup_data["gamificationEvents"] = export_table(db, GamificationEvent)
    except Exception:
        pass

    try:
        from app.models.project import Project
        backup_data["projects"] = export_table(db, Project)
    except Exception:
        pass

    try:
        from app.models.workspace_item import WorkspaceItem
        backup_data["workspaceItems"] = export_table(db, WorkspaceItem)
    except Exception:
        pass

    try:
        from app.models.file_item import FileItem
        backup_data["fileItems"] = export_table(db, FileItem)
    except Exception:
        pass

    try:
        from app.models.app_setting import AppSetting
        backup_data["settings"] = export_table(db, AppSetting)
    except Exception:
        pass

    try:
        from app.models.app_metadata import AppMetadata
        backup_data["metadata"] = export_table(db, AppMetadata)
    except Exception:
        pass

    return backup_data


def normalize_file_item_rows(rows):
    if not isinstance(rows, list):
        return []

    normalized_rows = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        new_row = dict(row)
        stored_name = new_row.get("stored_name")

        if stored_name:
            safe_name = Path(str(stored_name)).name
            new_row["stored_name"] = safe_name
            new_row["file_path"] = str(UPLOAD_DIR / safe_name)

        normalized_rows.append(new_row)

    return normalized_rows


def restore_backup_data(db: Session, backup_data: dict):
    restored = {
        "events": 0,
        "schedules": 0,
        "expenses": 0,
        "people": 0,
        "deadlines": 0,
        "tasks": 0,
        "subjects": 0,
        "gradeItems": 0,
        "attendanceRecords": 0,
        "focusSessions": 0,
        "gamificationEvents": 0,
        "projects": 0,
        "workspaceItems": 0,
        "fileItems": 0,
        "settings": 0,
        "metadata": 0,
    }

    try:
        from app.models.event import Event
        restored["events"] = restore_table(db, Event, backup_data.get("events", []))
    except Exception:
        pass

    try:
        from app.models.schedule import Schedule
        restored["schedules"] = restore_table(db, Schedule, backup_data.get("schedules", []))
    except Exception:
        pass

    try:
        from app.models.expense import Expense
        restored["expenses"] = restore_table(db, Expense, backup_data.get("expenses", []))
    except Exception:
        pass

    try:
        from app.models.person import Person
        restored["people"] = restore_table(db, Person, backup_data.get("people", []))
    except Exception:
        pass

    try:
        from app.models.deadline import Deadline
        restored["deadlines"] = restore_table(db, Deadline, backup_data.get("deadlines", []))
    except Exception:
        pass

    try:
        from app.models.task import Task
        restored["tasks"] = restore_table(db, Task, backup_data.get("tasks", []))
    except Exception:
        pass

    try:
        from app.models.subject import Subject
        restored["subjects"] = restore_table(db, Subject, backup_data.get("subjects", []))
    except Exception:
        pass

    try:
        from app.models.grade_item import GradeItem
        restored["gradeItems"] = restore_table(db, GradeItem, backup_data.get("gradeItems", []))
    except Exception:
        pass

    try:
        from app.models.attendance_record import AttendanceRecord
        restored["attendanceRecords"] = restore_table(db, AttendanceRecord, backup_data.get("attendanceRecords", []))
    except Exception:
        pass

    try:
        from app.models.focus_session import FocusSession
        restored["focusSessions"] = restore_table(db, FocusSession, backup_data.get("focusSessions", []))
    except Exception:
        pass

    try:
        from app.models.gamification_event import GamificationEvent
        restored["gamificationEvents"] = restore_table(db, GamificationEvent, backup_data.get("gamificationEvents", []))
    except Exception:
        pass

    try:
        from app.models.project import Project
        restored["projects"] = restore_table(db, Project, backup_data.get("projects", []))
    except Exception:
        pass

    try:
        from app.models.workspace_item import WorkspaceItem
        restored["workspaceItems"] = restore_table(
            db,
            WorkspaceItem,
            backup_data.get("workspaceItems", []),
        )
    except Exception:
        pass

    try:
        from app.models.file_item import FileItem
        restored["fileItems"] = restore_table(
            db,
            FileItem,
            normalize_file_item_rows(backup_data.get("fileItems", [])),
        )
    except Exception:
        pass

    try:
        from app.models.app_setting import AppSetting
        restored["settings"] = restore_table(db, AppSetting, backup_data.get("settings", []))
    except Exception:
        pass

    try:
        from app.models.app_metadata import AppMetadata
        restored["metadata"] = restore_table(db, AppMetadata, backup_data.get("metadata", []))
    except Exception:
        pass

    db.commit()

    return restored


def build_preview(backup_data: dict):
    return {
        "events": len(backup_data.get("events", [])),
        "schedules": len(backup_data.get("schedules", [])),
        "expenses": len(backup_data.get("expenses", [])),
        "people": len(backup_data.get("people", [])),
        "deadlines": len(backup_data.get("deadlines", [])),
        "tasks": len(backup_data.get("tasks", [])),
        "subjects": len(backup_data.get("subjects", [])),
        "gradeItems": len(backup_data.get("gradeItems", [])),
        "attendanceRecords": len(backup_data.get("attendanceRecords", [])),
        "focusSessions": len(backup_data.get("focusSessions", [])),
        "gamificationEvents": len(backup_data.get("gamificationEvents", [])),
        "projects": len(backup_data.get("projects", [])),
        "workspaceItems": len(backup_data.get("workspaceItems", [])),
        "fileItems": len(backup_data.get("fileItems", [])),
        "settings": len(backup_data.get("settings", [])),
        "metadata": len(backup_data.get("metadata", [])),
        "exportedAt": backup_data.get("exportedAt"),
        "app": backup_data.get("app"),
        "backupType": backup_data.get("backupType"),
    }


def read_backup_json_from_zip(file_bytes: bytes):
    try:
        with zipfile.ZipFile(BytesIO(file_bytes), "r") as zip_file:
            if "backup.json" not in zip_file.namelist():
                raise HTTPException(status_code=400, detail="File ZIP thiếu backup.json.")

            with zip_file.open("backup.json") as backup_file:
                return json.loads(backup_file.read().decode("utf-8"))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="File ZIP backup không hợp lệ.")


def restore_uploads_from_zip(file_bytes: bytes):
    if UPLOAD_DIR.exists():
        shutil.rmtree(UPLOAD_DIR)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(BytesIO(file_bytes), "r") as zip_file:
        for member in zip_file.infolist():
            name = member.filename

            if not name.startswith("uploads/"):
                continue

            if name.endswith("/"):
                continue

            relative_name = name.replace("uploads/", "", 1)
            safe_parts = [
                part
                for part in Path(relative_name).parts
                if part not in ["..", ".", "", "/", "\\"]
            ]

            if not safe_parts:
                continue

            target_path = UPLOAD_DIR.joinpath(*safe_parts)
            target_path.parent.mkdir(parents=True, exist_ok=True)

            with zip_file.open(member) as source, target_path.open("wb") as target:
                shutil.copyfileobj(source, target)


@router.get("/export")
def export_backup(db: Session = Depends(get_db)):
    return build_backup_data(db)


@router.get("/export/zip")
def export_backup_zip(db: Session = Depends(get_db)):
    backup_data = build_backup_data(db)
    backup_json = json.dumps(backup_data, ensure_ascii=False, indent=2)

    memory_file = BytesIO()

    with zipfile.ZipFile(memory_file, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("backup.json", backup_json)

        if UPLOAD_DIR.exists():
            for path in UPLOAD_DIR.rglob("*"):
                if path.is_file():
                    zip_file.write(path, arcname=f"uploads/{path.relative_to(UPLOAD_DIR)}")

    memory_file.seek(0)

    today = datetime.now().strftime("%Y-%m-%d")
    file_name = f"personal-life-app-backup-{today}.zip"

    return StreamingResponse(
        memory_file,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
        },
    )


@router.post("/import/preview")
def preview_backup(backup_data: dict):
    return build_preview(backup_data)


@router.post("/import")
def import_backup(
    backup_data: dict,
    confirm: bool = False,
    db: Session = Depends(get_db),
):
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Cần confirm=true để khôi phục dữ liệu.",
        )

    restored = restore_backup_data(db, backup_data)

    return {
        "message": "Khôi phục dữ liệu thành công.",
        "restored": restored,
    }


@router.post("/import/zip/preview")
async def preview_backup_zip(backup_file: UploadFile = File(...)):
    file_bytes = await backup_file.read()
    backup_data = read_backup_json_from_zip(file_bytes)
    preview = build_preview(backup_data)

    with zipfile.ZipFile(BytesIO(file_bytes), "r") as zip_file:
        upload_count = len(
            [
                name
                for name in zip_file.namelist()
                if name.startswith("uploads/") and not name.endswith("/")
            ]
        )

    preview["uploadFiles"] = upload_count

    return preview


@router.post("/import/zip")
async def import_backup_zip(
    confirm: bool = False,
    backup_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Cần confirm=true để khôi phục dữ liệu.",
        )

    file_bytes = await backup_file.read()
    backup_data = read_backup_json_from_zip(file_bytes)

    restored = restore_backup_data(db, backup_data)
    restore_uploads_from_zip(file_bytes)

    return {
        "message": "Khôi phục dữ liệu và uploads thành công.",
        "restored": restored,
    }
