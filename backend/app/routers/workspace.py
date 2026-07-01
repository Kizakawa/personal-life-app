from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.gamification import record_gamification_event
from app.html_sanitizer import sanitize_rich_html
from app.models.workspace_item import WorkspaceItem
from app.schemas.workspace_item import (
    WorkspaceItemCreate,
    WorkspaceItemResponse,
    WorkspaceItemUpdate,
)

router = APIRouter(
    prefix="/workspace-items",
    tags=["Workspace Items"],
)


@router.get("/", response_model=list[WorkspaceItemResponse])
def get_workspace_items(
    module: Optional[str] = None,
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    subject: Optional[str] = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(WorkspaceItem)

    if module:
        query = query.filter(WorkspaceItem.module == module)

    if category:
        query = query.filter(WorkspaceItem.category == category)

    if status:
        query = query.filter(WorkspaceItem.status == status)

    if subject:
        query = query.filter(WorkspaceItem.subject == subject)

    if keyword:
        search_text = f"%{keyword.strip()}%"

        query = query.filter(
            or_(
                WorkspaceItem.title.ilike(search_text),
                WorkspaceItem.category.ilike(search_text),
                WorkspaceItem.status.ilike(search_text),
                WorkspaceItem.priority.ilike(search_text),
                WorkspaceItem.subject.ilike(search_text),
                WorkspaceItem.project_name.ilike(search_text),
                WorkspaceItem.file_path.ilike(search_text),
                WorkspaceItem.url.ilike(search_text),
                WorkspaceItem.tags.ilike(search_text),
                WorkspaceItem.content.ilike(search_text),
            )
        )

    query = query.order_by(WorkspaceItem.updated_at.desc(), WorkspaceItem.created_at.desc()).offset(offset)

    if limit is not None:
        query = query.limit(limit)

    return query.all()


@router.post("/", response_model=WorkspaceItemResponse)
def create_workspace_item(
    item_data: WorkspaceItemCreate,
    db: Session = Depends(get_db),
):
    data = item_data.model_dump()
    if data.get("content"):
        data["content"] = sanitize_rich_html(data.get("content"))
    item = WorkspaceItem(**data)

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.put("/{item_id}", response_model=WorkspaceItemResponse)
def update_workspace_item(
    item_id: int,
    item_data: WorkspaceItemUpdate,
    db: Session = Depends(get_db),
):
    item = db.query(WorkspaceItem).filter(WorkspaceItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục dữ liệu")

    old_status = item.status
    update_data = item_data.model_dump(exclude_unset=True)

    if update_data.get("content"):
        update_data["content"] = sanitize_rich_html(update_data.get("content"))

    for key, value in update_data.items():
        setattr(item, key, value)

    if old_status != "done" and item.status == "done":
        record_gamification_event(
            db,
            source_type="workspace_item",
            source_id=item.id,
            action="complete_workspace_item",
            points=12 if item.priority == "high" else 8,
            title=f"Hoàn thành mục học tập: {item.title}",
            reason=item.subject or item.module,
        )

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{item_id}")
def delete_workspace_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    item = db.query(WorkspaceItem).filter(WorkspaceItem.id == item_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục dữ liệu")

    db.delete(item)
    db.commit()

    return {"message": "Đã xóa mục dữ liệu thành công"}
