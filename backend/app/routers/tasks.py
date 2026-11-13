from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.gamification_service import record_gamification_event
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


@router.get("/", response_model=list[TaskResponse])
def get_tasks(
    status: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Task)

    if status:
        query = query.filter(Task.status == status)

    if start_date:
        query = query.filter(Task.task_date >= start_date)

    if end_date:
        query = query.filter(Task.task_date <= end_date)

    query = query.order_by(Task.task_date.asc(), Task.id.desc()).offset(offset)

    if limit is not None:
        query = query.limit(limit)

    return query.all()


@router.get("/today", response_model=list[TaskResponse])
def get_today_tasks(db: Session = Depends(get_db)):
    today = date.today()

    tasks = (
        db.query(Task)
        .filter(Task.task_date == today)
        .order_by(Task.id.desc())
        .all()
    )

    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy task")

    return task


@router.post("/", response_model=TaskResponse)
def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    new_task = Task(**task_data.model_dump())

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy task")

    old_status = task.status
    update_data = task_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(task, key, value)

    if old_status != "done" and task.status == "done":
        record_gamification_event(
            db,
            source_type="task",
            source_id=task.id,
            action="complete_task",
            points=10 if task.priority != "high" else 15,
            title=f"Hoàn thành việc: {task.title}",
            reason="Task ưu tiên cao" if task.priority == "high" else "Hoàn thành task",
        )

    db.commit()
    db.refresh(task)

    return task


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy task")

    db.delete(task)
    db.commit()

    return {"message": "Đã xóa task thành công"}


@router.patch("/{task_id}/done", response_model=TaskResponse)
def mark_task_done(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy task")

    old_status = task.status
    task.status = "done"

    if old_status != "done":
        record_gamification_event(
            db,
            source_type="task",
            source_id=task.id,
            action="complete_task",
            points=10 if task.priority != "high" else 15,
            title=f"Hoàn thành việc: {task.title}",
            reason="Task ưu tiên cao" if task.priority == "high" else "Hoàn thành task",
        )

    db.commit()
    db.refresh(task)

    return task
