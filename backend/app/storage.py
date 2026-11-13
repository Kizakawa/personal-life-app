import json
import os
import shutil
import sys
import zipfile
from datetime import datetime
from pathlib import Path

APP_NAME = "PersonalLifeApp"
DATABASE_FILE_NAME = "personal_life_app.db"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LEGACY_DATABASE_PATH = PROJECT_ROOT / "database" / DATABASE_FILE_NAME
LEGACY_UPLOAD_DIR = PROJECT_ROOT / "backend" / "uploads"


def resolve_data_dir() -> Path:
    custom_dir = os.getenv("PERSONAL_LIFE_APP_DATA_DIR")

    if custom_dir:
        return Path(custom_dir).expanduser()

    appdata = os.getenv("APPDATA")

    if appdata:
        return Path(appdata) / APP_NAME

    local_appdata = os.getenv("LOCALAPPDATA")

    if local_appdata:
        return Path(local_appdata) / APP_NAME

    return Path.home() / ".personal-life-app"


DATA_DIR = resolve_data_dir()
DATABASE_PATH = DATA_DIR / DATABASE_FILE_NAME
UPLOAD_DIR = DATA_DIR / "uploads"
BACKUP_DIR = DATA_DIR / "backups"
CONFIG_PATH = DATA_DIR / "app_config.json"
RECOVERY_KEY_PATH = DATA_DIR / "recovery_key.txt"


def save_recovery_key_file(username: str, recovery_key: str):
    ensure_storage_dirs()
    content = (
        "===========================================================\n"
        "PERSONAL LIFE APP - MÃ KHÔI PHỤC TÀI KHOẢN DỰ PHÒNG\n"
        "===========================================================\n"
        f"Tài khoản: {username}\n"
        f"Mã khôi phục: {recovery_key}\n"
        f"Ngày tạo: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        "LƯU Ý QUAN TRỌNG:\n"
        "- Dùng mã này để đặt lại mật khẩu khi bạn quên mật khẩu đăng nhập.\n"
        "- Hãy lưu giữ file này hoặc sao chép mã này vào nơi an toàn.\n"
        "- Trên màn hình đăng nhập, chọn 'Quên mật khẩu' -> Chọn tab 'Mã khôi phục'.\n"
        "===========================================================\n"
    )
    try:
        RECOVERY_KEY_PATH.write_text(content, encoding="utf-8")
    except Exception:
        pass


def read_recovery_key_file() -> str | None:
    if not RECOVERY_KEY_PATH.exists():
        return None
    try:
        return RECOVERY_KEY_PATH.read_text(encoding="utf-8")
    except Exception:
        return None


def ensure_storage_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def ensure_app_config():
    ensure_storage_dirs()

    config = {
        "app": "personal-life-app",
        "storage_version": 1,
        "data_dir": str(DATA_DIR),
        "database_path": str(DATABASE_PATH),
        "upload_dir": str(UPLOAD_DIR),
        "backup_dir": str(BACKUP_DIR),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }

    CONFIG_PATH.write_text(
        json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return config


def migrate_legacy_database_if_needed():
    ensure_storage_dirs()

    if DATABASE_PATH.exists():
        return False

    if not LEGACY_DATABASE_PATH.exists():
        return False

    shutil.copy2(LEGACY_DATABASE_PATH, DATABASE_PATH)
    return True


def migrate_legacy_uploads_if_needed():
    ensure_storage_dirs()

    if not LEGACY_UPLOAD_DIR.exists():
        return False

    has_current_uploads = any(UPLOAD_DIR.iterdir())

    if has_current_uploads:
        return False

    for source in LEGACY_UPLOAD_DIR.rglob("*"):
        if not source.is_file():
            continue

        relative_path = source.relative_to(LEGACY_UPLOAD_DIR)
        target = UPLOAD_DIR / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    return True


def migrate_legacy_data_if_needed():
    database_migrated = migrate_legacy_database_if_needed()
    uploads_migrated = migrate_legacy_uploads_if_needed()
    ensure_app_config()

    return {
        "database_migrated": database_migrated,
        "uploads_migrated": uploads_migrated,
        "data_dir": str(DATA_DIR),
    }


def create_upgrade_backup(label: str):
    ensure_storage_dirs()

    if not DATABASE_PATH.exists():
        return None

    safe_label = "".join(
        character if character.isalnum() or character in ["-", "_"] else "-"
        for character in label
    ).strip("-")
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_DIR / f"{safe_label}-{timestamp}.zip"

    with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.write(DATABASE_PATH, arcname=DATABASE_FILE_NAME)

        if UPLOAD_DIR.exists():
            for path in UPLOAD_DIR.rglob("*"):
                if path.is_file():
                    zip_file.write(path, arcname=f"uploads/{path.relative_to(UPLOAD_DIR)}")

    return backup_path


def resolve_frontend_dist_dir() -> Path | None:
    configured_path = os.getenv("PERSONAL_LIFE_APP_FRONTEND_DIR")
    candidates = []

    if configured_path:
        candidates.append(Path(configured_path).expanduser())

    if getattr(sys, "frozen", False):
        executable_path = Path(sys.executable).resolve()
        candidates.append(executable_path.parent.parent / "frontend")

    candidates.extend(
        [
            PROJECT_ROOT / "frontend" / "dist",
            PROJECT_ROOT / "frontend",
        ]
    )

    for candidate in candidates:
        if (candidate / "index.html").exists():
            return candidate

    return None
