from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleResponse, ScheduleUpdate

router = APIRouter(prefix="/schedules", tags=["Schedules"])


@router.get("", response_model=list[ScheduleResponse])
def get_schedules(db: Session = Depends(get_db)):
    return (
        db.query(Schedule)
        .order_by(Schedule.day_of_week, Schedule.start_time)
        .all()
    )


@router.post("", response_model=ScheduleResponse)
def create_schedule(schedule: ScheduleCreate, db: Session = Depends(get_db)):
    new_schedule = Schedule(**schedule.model_dump())
    db.add(new_schedule)

    # Tự động đồng bộ sang bảng Subject nếu là môn học (category == "study")
    if new_schedule.category == "study" and new_schedule.title:
        from app.models.subject import Subject
        subj_name = new_schedule.title.strip()
        existing_subject = db.query(Subject).filter(Subject.name.ilike(subj_name)).first()
        if not existing_subject:
            new_subject = Subject(
                name=subj_name,
                room=new_schedule.location,
                note=new_schedule.note,
                progress_status="studying",
            )
            db.add(new_subject)
        else:
            if existing_subject.progress_status != "studying":
                existing_subject.progress_status = "studying"

    db.commit()
    db.refresh(new_schedule)
    return new_schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    db: Session = Depends(get_db),
):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for key, value in schedule_data.model_dump().items():
        setattr(schedule, key, value)

    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()

    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    db.delete(schedule)
    db.commit()

    return {
        "message": "Schedule deleted successfully",
        "id": schedule_id,
    }