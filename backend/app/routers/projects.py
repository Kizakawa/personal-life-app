from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)

ALLOWED_STATUSES = {"pending", "doing", "almost_done", "done"}
ALLOWED_PRIORITIES = {"low", "medium", "high"}
TEXT_FIELDS = {
    "name",
    "goal",
    "todo",
    "current_bug",
    "solution",
    "related_files",
    "note",
}


def normalize_project_data(project_data, partial=False):
    data = project_data.model_dump(exclude_unset=partial)

    for field in TEXT_FIELDS:
        if field in data and isinstance(data[field], str):
            data[field] = data[field].strip() or None

    if not partial and not data.get("name"):
        raise HTTPException(status_code=400, detail="Tên dự án không được để trống")

    if partial and "name" in data and not data.get("name"):
        raise HTTPException(status_code=400, detail="Tên dự án không được để trống")

    if not partial and not data.get("status"):
        data["status"] = "pending"

    if not partial and not data.get("priority"):
        data["priority"] = "medium"

    if "status" in data and data.get("status") not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái dự án không hợp lệ")

    if "priority" in data and data.get("priority") not in ALLOWED_PRIORITIES:
        raise HTTPException(status_code=400, detail="Mức ưu tiên dự án không hợp lệ")

    return data


@router.get("/", response_model=list[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.updated_at.desc()).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")

    return project


@router.post("/", response_model=ProjectResponse)
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
):
    project = Project(**normalize_project_data(project_data))

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")

    update_data = normalize_project_data(project_data, partial=True)

    for key, value in update_data.items():
        setattr(project, key, value)

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")

    db.delete(project)
    db.commit()

    return {"message": "Đã xóa dự án thành công"}
