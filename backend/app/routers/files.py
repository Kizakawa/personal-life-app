import mimetypes
import secrets
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.file_item import FileItem
from app.storage import UPLOAD_DIR, ensure_storage_dirs

router = APIRouter(
    prefix="/files",
    tags=["Files"],
)

ensure_storage_dirs()


def serialize_file(item: FileItem):
    return {
        "id": item.id,
        "original_name": item.original_name,
        "stored_name": item.stored_name,
        "file_path": item.file_path,
        "public_token": item.public_token,
        "file_type": item.file_type,
        "module": item.module,
        "subject": item.subject,
        "project_name": item.project_name,
        "url": item.url,
        "tags": item.tags,
        "note": item.note,
        "created_at": str(item.created_at) if item.created_at else None,
    }



def generate_file_public_token(db: Session) -> str:
    for _ in range(5):
        token = secrets.token_urlsafe(32)
        exists = db.query(FileItem.id).filter(FileItem.public_token == token).first()
        if not exists:
            return token

    return secrets.token_urlsafe(48)


def ensure_file_public_token(db: Session, item: FileItem) -> str:
    if item.public_token:
        return item.public_token

    item.public_token = generate_file_public_token(db)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item.public_token

def save_upload_file(upload_file: UploadFile):
    safe_name = Path(upload_file.filename or "file").name
    stored_name = f"{uuid4().hex}_{safe_name}"
    target_path = UPLOAD_DIR / stored_name

    with target_path.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return safe_name, stored_name, str(target_path)


def delete_physical_file(file_path: str | None):
    if not file_path:
        return

    path = Path(file_path)
    if path.exists() and path.is_file():
        path.unlink()


@router.get("/")
def get_files(
    module: str = "documents",
    keyword: str = "",
    db: Session = Depends(get_db),
):
    query = db.query(FileItem)

    if module:
        query = query.filter(FileItem.module == module)

    items = query.order_by(FileItem.created_at.desc()).all()

    if keyword:
        keyword_lower = keyword.lower().strip()
        items = [
            item
            for item in items
            if keyword_lower in (item.original_name or "").lower()
            or keyword_lower in (item.subject or "").lower()
            or keyword_lower in (item.project_name or "").lower()
            or keyword_lower in (item.tags or "").lower()
            or keyword_lower in (item.note or "").lower()
            or keyword_lower in (item.file_type or "").lower()
            or keyword_lower in (item.url or "").lower()
        ]

    return [serialize_file(item) for item in items]


@router.post("/")
def create_file_record(
    upload_file: UploadFile | None = File(default=None),
    title: str = Form(default=""),
    file_type: str = Form(default="other"),
    module: str = Form(default="documents"),
    subject: str = Form(default=""),
    project_name: str = Form(default=""),
    url: str = Form(default=""),
    tags: str = Form(default=""),
    note: str = Form(default=""),
    db: Session = Depends(get_db),
):
    clean_title = title.strip()
    clean_url = url.strip()

    if upload_file is None and not clean_url and not clean_title:
        raise HTTPException(
            status_code=400,
            detail="Cần chọn file, nhập link hoặc nhập tên tài liệu.",
        )

    original_name = clean_title
    stored_name = None
    file_path = None

    if upload_file is not None and upload_file.filename:
        safe_name, stored_name, file_path = save_upload_file(upload_file)
        original_name = clean_title or safe_name

    if not original_name:
        original_name = clean_url or "Tài liệu"

    item = FileItem(
        original_name=original_name,
        stored_name=stored_name,
        file_path=file_path,
        public_token=generate_file_public_token(db) if file_path else None,
        file_type=file_type or "other",
        module=module or "documents",
        subject=subject or None,
        project_name=project_name or None,
        url=clean_url or None,
        tags=tags or None,
        note=note or None,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return serialize_file(item)


@router.put("/{file_id}")
def update_file_record(
    file_id: int,
    upload_file: UploadFile | None = File(default=None),
    title: str = Form(default=""),
    file_type: str = Form(default="other"),
    module: str = Form(default="documents"),
    subject: str = Form(default=""),
    project_name: str = Form(default=""),
    url: str = Form(default=""),
    tags: str = Form(default=""),
    note: str = Form(default=""),
    db: Session = Depends(get_db),
):
    item = db.query(FileItem).filter(FileItem.id == file_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy file.")

    clean_title = title.strip()
    clean_url = url.strip()

    if upload_file is None and not clean_url and not clean_title and not item.file_path:
        raise HTTPException(
            status_code=400,
            detail="Cần chọn file, nhập link hoặc nhập tên tài liệu.",
        )

    if upload_file is not None and upload_file.filename:
        delete_physical_file(item.file_path)
        safe_name, stored_name, file_path = save_upload_file(upload_file)
        item.stored_name = stored_name
        item.file_path = file_path
        item.public_token = item.public_token or generate_file_public_token(db)
        if not clean_title:
            clean_title = safe_name

    if clean_title:
        item.original_name = clean_title

    if not item.original_name:
        item.original_name = clean_url or "Tài liệu"

    item.file_type = file_type or "other"
    item.module = module or "documents"
    item.subject = subject or None
    item.project_name = project_name or None
    item.url = clean_url or None
    item.tags = tags or None
    item.note = note or None

    db.commit()
    db.refresh(item)

    return serialize_file(item)


@router.delete("/{file_id}")
def delete_file(file_id: int, db: Session = Depends(get_db)):
    item = db.query(FileItem).filter(FileItem.id == file_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy file.")

    delete_physical_file(item.file_path)

    db.delete(item)
    db.commit()

    return {
        "message": "Đã xóa file.",
        "id": file_id,
    }


@router.get("/{file_id}/inline")
def inline_file(file_id: int, token: str | None = None, db: Session = Depends(get_db)):
    item = db.query(FileItem).filter(FileItem.id == file_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy file.")

    if token and token != item.public_token:
        raise HTTPException(status_code=401, detail="Link ảnh không hợp lệ hoặc đã bị thu hồi.")

    if token and not item.public_token:
        raise HTTPException(status_code=401, detail="Link ảnh không hợp lệ hoặc đã bị thu hồi.")

    if not item.file_path:
        raise HTTPException(status_code=400, detail="Tài liệu này không có file xem nhanh.")

    path = Path(item.file_path)

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File không còn tồn tại trên máy.")

    guessed_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(
        path,
        filename=item.original_name,
        media_type=guessed_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{item.original_name}"'},
    )


@router.get("/{file_id}/download")
def download_file(file_id: int, db: Session = Depends(get_db)):
    item = db.query(FileItem).filter(FileItem.id == file_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy file.")

    if not item.file_path:
        raise HTTPException(status_code=400, detail="Tài liệu này không có file tải về.")

    path = Path(item.file_path)

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File không còn tồn tại trên máy.")

    return FileResponse(
        path,
        filename=item.original_name,
        media_type="application/octet-stream",
    )
