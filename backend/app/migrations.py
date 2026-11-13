import secrets
import sqlite3
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.app_metadata import AppMetadata
from app.ai_context import ensure_ai_default_settings
from app.security import generate_recovery_key, hash_recovery_key
from app.storage import (
    DATABASE_PATH,
    create_upgrade_backup,
    ensure_storage_dirs,
    save_recovery_key_file,
)

CURRENT_DATABASE_VERSION = 10


def read_existing_database_version() -> int | None:
    if not DATABASE_PATH.exists():
        return None

    try:
        connection = sqlite3.connect(DATABASE_PATH)
        cursor = connection.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='app_metadata'"
        )

        if not cursor.fetchone():
            return 0

        cursor.execute(
            "SELECT value FROM app_metadata WHERE key='database_version'"
        )
        row = cursor.fetchone()

        if not row or row[0] is None:
            return 0

        return int(row[0])
    except Exception:
        return 0
    finally:
        try:
            connection.close()
        except Exception:
            pass


def prepare_database_upgrade_backup():
    ensure_storage_dirs()
    existing_version = read_existing_database_version()

    if existing_version is None:
        return None

    if existing_version >= CURRENT_DATABASE_VERSION:
        return None

    return create_upgrade_backup(
        f"before-upgrade-v{existing_version}-to-v{CURRENT_DATABASE_VERSION}"
    )



def get_existing_columns(db: Session, table_name: str) -> set[str]:
    try:
        rows = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
        return {row[1] for row in rows}
    except Exception:
        return set()


def ensure_subject_student_columns(db: Session):
    existing_columns = get_existing_columns(db, "subjects")

    migrations = {
        "attendance_limit": "ALTER TABLE subjects ADD COLUMN attendance_limit INTEGER DEFAULT 3",
        "target_score": "ALTER TABLE subjects ADD COLUMN target_score FLOAT",
    }

    for column_name, statement in migrations.items():
        if column_name not in existing_columns:
            db.execute(text(statement))




def ensure_user_security_columns(db: Session):
    existing_columns = get_existing_columns(db, "users")
    if not existing_columns:
        return

    if "calendar_token" not in existing_columns:
        db.execute(text("ALTER TABLE users ADD COLUMN calendar_token VARCHAR"))

    if "security_question" not in existing_columns:
        db.execute(text("ALTER TABLE users ADD COLUMN security_question VARCHAR"))

    if "security_answer_hash" not in existing_columns:
        db.execute(text("ALTER TABLE users ADD COLUMN security_answer_hash VARCHAR"))

    if "recovery_key_hash" not in existing_columns:
        db.execute(text("ALTER TABLE users ADD COLUMN recovery_key_hash VARCHAR"))

    if "recovery_key" not in existing_columns:
        db.execute(text("ALTER TABLE users ADD COLUMN recovery_key VARCHAR"))

    # Đảm bảo tất cả user hiện có đều có recovery_key
    try:
        rows = db.execute(
            text("SELECT id, username, recovery_key FROM users")
        ).fetchall()

        for row in rows:
            user_id = row[0]
            username = row[1]
            existing_key = row[2]

            if not existing_key:
                rec_key = generate_recovery_key()
                rec_hash = hash_recovery_key(rec_key)
                db.execute(
                    text("UPDATE users SET recovery_key = :key, recovery_key_hash = :hash WHERE id = :id"),
                    {"key": rec_key, "hash": rec_hash, "id": user_id},
                )
                save_recovery_key_file(username, rec_key)
    except Exception:
        pass



def ensure_file_security_columns(db: Session):
    existing_columns = get_existing_columns(db, "file_items")

    if "public_token" not in existing_columns:
        db.execute(text("ALTER TABLE file_items ADD COLUMN public_token VARCHAR"))

    rows = db.execute(
        text("SELECT id FROM file_items WHERE file_path IS NOT NULL AND (public_token IS NULL OR public_token = '')")
    ).fetchall()

    for row in rows:
        token = secrets.token_urlsafe(32)
        db.execute(
            text("UPDATE file_items SET public_token = :token WHERE id = :id"),
            {"token": token, "id": row[0]},
        )


def ensure_ai_chat_columns(db: Session):
    existing_columns = get_existing_columns(db, "ai_chat_history")

    if "suggested_action" not in existing_columns:
        db.execute(text("ALTER TABLE ai_chat_history ADD COLUMN suggested_action TEXT"))


def ensure_workspace_fts(db: Session):
    try:
        db.execute(
            text(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS workspace_fts
                USING fts5(id UNINDEXED, title, content, tokenize='unicode61')
                """
            )
        )
        db.execute(text("DELETE FROM workspace_fts"))
        db.execute(
            text(
                """
                INSERT INTO workspace_fts(rowid, id, title, content)
                SELECT id, id, COALESCE(title, ''), COALESCE(content, '')
                FROM workspace_items
                WHERE content IS NOT NULL AND TRIM(content) != ''
                """
            )
        )
        db.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS workspace_fts_insert
                AFTER INSERT ON workspace_items
                WHEN NEW.content IS NOT NULL AND TRIM(NEW.content) != ''
                BEGIN
                    INSERT OR REPLACE INTO workspace_fts(rowid, id, title, content)
                    VALUES (NEW.id, NEW.id, COALESCE(NEW.title, ''), COALESCE(NEW.content, ''));
                END
                """
            )
        )
        db.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS workspace_fts_update
                AFTER UPDATE ON workspace_items
                BEGIN
                    DELETE FROM workspace_fts WHERE rowid = OLD.id;
                    INSERT OR REPLACE INTO workspace_fts(rowid, id, title, content)
                    SELECT NEW.id, NEW.id, COALESCE(NEW.title, ''), COALESCE(NEW.content, '')
                    WHERE NEW.content IS NOT NULL AND TRIM(NEW.content) != '';
                END
                """
            )
        )
        db.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS workspace_fts_delete
                AFTER DELETE ON workspace_items
                BEGIN
                    DELETE FROM workspace_fts WHERE rowid = OLD.id;
                END
                """
            )
        )
    except Exception:
        pass


def ensure_performance_indexes(db: Session):
    statements = [
        "CREATE INDEX IF NOT EXISTS idx_tasks_date_status ON tasks(task_date, status)",
        "CREATE INDEX IF NOT EXISTS idx_deadlines_due_status ON deadlines(due_date, status)",
        "CREATE INDEX IF NOT EXISTS idx_expenses_date_type ON expenses(transaction_date, transaction_type)",
        "CREATE INDEX IF NOT EXISTS idx_workspace_module_category ON workspace_items(module, category)",
        "CREATE INDEX IF NOT EXISTS idx_workspace_subject_category ON workspace_items(subject, category)",
        "CREATE INDEX IF NOT EXISTS idx_grade_subject_id ON grade_items(subject_id)",
        "CREATE INDEX IF NOT EXISTS idx_attendance_subject_date ON attendance_records(subject_id, session_date)",
        "CREATE INDEX IF NOT EXISTS idx_focus_created_status ON focus_sessions(created_at, status)",
        "CREATE INDEX IF NOT EXISTS idx_gamification_event_date ON gamification_events(event_date, action)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_calendar_token ON users(calendar_token)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_file_items_public_token ON file_items(public_token)",
        "CREATE INDEX IF NOT EXISTS idx_ai_chat_user_created ON ai_chat_history(user_id, created_at)",
    ]

    for statement in statements:
        try:
            db.execute(text(statement))
        except Exception:
            pass

def upsert_metadata(db: Session, key: str, value: str):
    item = db.query(AppMetadata).filter(AppMetadata.key == key).first()

    if item:
        item.value = value
        item.updated_at = datetime.utcnow()
    else:
        item = AppMetadata(
            key=key,
            value=value,
        )
        db.add(item)

    return item


def sync_subject_schedule_statuses(db: Session):
    """Đảm bảo mọi môn học đã có lịch trong bảng schedules luôn có progress_status = 'studying'."""
    try:
        db.execute(
            text(
                """
                UPDATE subjects
                SET progress_status = 'studying'
                WHERE LOWER(TRIM(name)) IN (
                    SELECT LOWER(TRIM(title)) FROM schedules 
                    WHERE category = 'study' OR category IS NULL OR category = ''
                )
                AND (progress_status IS NULL OR progress_status = 'not_started')
                """
            )
        )
    except Exception as e:
        print(f"[migrations] sync_subject_schedule_statuses notice: {e}")


def run_startup_migrations(db: Session):
    ensure_subject_student_columns(db)
    ensure_user_security_columns(db)
    ensure_file_security_columns(db)
    ensure_ai_chat_columns(db)
    ensure_workspace_fts(db)
    ensure_performance_indexes(db)
    ensure_ai_default_settings(db)
    sync_subject_schedule_statuses(db)

    upsert_metadata(db, "database_version", str(CURRENT_DATABASE_VERSION))
    upsert_metadata(db, "last_startup_at", datetime.utcnow().isoformat(timespec="seconds"))

    db.commit()
