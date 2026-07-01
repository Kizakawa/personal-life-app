from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.database import get_db
from app.models.deadline import Deadline
from app.schemas.deadline import DeadlineCreate, DeadlineUpdate, DeadlineResponse


router = APIRouter(
    prefix="/deadlines",
    tags=["Deadlines"]
)


@router.get("/", response_model=list[DeadlineResponse])
def get_deadlines(db: Session = Depends(get_db)):
    deadlines = db.query(Deadline).order_by(Deadline.due_date.asc()).all()
    return deadlines


@router.get("/upcoming", response_model=list[DeadlineResponse])
def get_upcoming_deadlines(db: Session = Depends(get_db)):
    today = date.today()
    next_7_days = today + timedelta(days=7)

    deadlines = (
        db.query(Deadline)
        .filter(
            Deadline.due_date >= today,
            Deadline.due_date <= next_7_days,
            Deadline.status != "done"
        )
        .order_by(Deadline.due_date.asc())
        .all()
    )

    return deadlines


@router.get("/{deadline_id}", response_model=DeadlineResponse)
def get_deadline(deadline_id: int, db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()

    if not deadline:
        raise HTTPException(status_code=404, detail="Không tìm thấy deadline")

    return deadline


@router.post("/", response_model=DeadlineResponse)
def create_deadline(deadline_data: DeadlineCreate, db: Session = Depends(get_db)):
    new_deadline = Deadline(**deadline_data.model_dump())

    db.add(new_deadline)
    db.commit()
    db.refresh(new_deadline)

    return new_deadline


@router.put("/{deadline_id}", response_model=DeadlineResponse)
def update_deadline(
    deadline_id: int,
    deadline_data: DeadlineUpdate,
    db: Session = Depends(get_db)
):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()

    if not deadline:
        raise HTTPException(status_code=404, detail="Không tìm thấy deadline")

    update_data = deadline_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(deadline, key, value)

    db.commit()
    db.refresh(deadline)

    return deadline


@router.delete("/{deadline_id}")
def delete_deadline(deadline_id: int, db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()

    if not deadline:
        raise HTTPException(status_code=404, detail="Không tìm thấy deadline")

    db.delete(deadline)
    db.commit()

    return {"message": "Đã xóa deadline thành công"}


@router.patch("/{deadline_id}/done", response_model=DeadlineResponse)
def mark_deadline_done(deadline_id: int, db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()

    if not deadline:
        raise HTTPException(status_code=404, detail="Không tìm thấy deadline")

    deadline.status = "done"

    db.commit()
    db.refresh(deadline)

    return deadline