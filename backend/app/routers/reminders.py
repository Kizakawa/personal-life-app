from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(
    prefix="/reminders",
    tags=["Reminders"],
)


def to_text(value):
    if value is None:
        return None

    if isinstance(value, (date, datetime, time)):
        return str(value)

    return value


def get_deadline_reminders(db: Session):
    try:
        from app.models.deadline import Deadline
    except Exception:
        return {
            "overdue": [],
            "upcoming": [],
        }

    today = date.today()
    next_7_days = today + timedelta(days=7)

    overdue = []
    upcoming = []

    deadlines = db.query(Deadline).all()

    for item in deadlines:
        if item.status == "done":
            continue

        days_left = (item.due_date - today).days

        data = {
            "id": item.id,
            "title": item.title,
            "subject": item.subject,
            "dueDate": str(item.due_date),
            "daysLeft": days_left,
            "priority": item.priority,
            "status": item.status,
        }

        if item.due_date < today:
            overdue.append(data)
        elif today <= item.due_date <= next_7_days:
            upcoming.append(data)

    return {
        "overdue": overdue,
        "upcoming": upcoming,
    }


def get_project_reminders(db: Session):
    try:
        from app.models.project import Project
    except Exception:
        return {
            "overdue": [],
            "upcoming": [],
        }

    today = date.today()
    next_7_days = today + timedelta(days=7)

    overdue = []
    upcoming = []

    projects = db.query(Project).all()

    for item in projects:
        if item.status == "done":
            continue

        if not item.deadline_date:
            continue

        days_left = (item.deadline_date - today).days

        data = {
            "id": item.id,
            "title": item.name,
            "goal": item.goal,
            "deadlineDate": str(item.deadline_date),
            "daysLeft": days_left,
            "priority": item.priority,
            "status": item.status,
        }

        if item.deadline_date < today:
            overdue.append(data)
        elif today <= item.deadline_date <= next_7_days:
            upcoming.append(data)

    return {
        "overdue": overdue,
        "upcoming": upcoming,
    }


def get_today_tasks(db: Session):
    try:
        from app.models.task import Task
    except Exception:
        return []

    today = date.today()

    tasks = (
        db.query(Task)
        .filter(Task.task_date == today)
        .filter(Task.status != "done")
        .order_by(Task.id.desc())
        .all()
    )

    return [
        {
            "id": item.id,
            "title": item.title,
            "taskDate": str(item.task_date),
            "startTime": to_text(item.start_time),
            "endTime": to_text(item.end_time),
            "priority": item.priority,
            "status": item.status,
        }
        for item in tasks
    ]


def get_upcoming_events(db: Session):
    try:
        from app.models.event import Event
    except Exception:
        return []

    today = date.today()
    next_7_days = today + timedelta(days=7)

    events = (
        db.query(Event)
        .filter(Event.event_date >= today)
        .filter(Event.event_date <= next_7_days)
        .order_by(Event.event_date.asc())
        .all()
    )

    return [
        {
            "id": item.id,
            "title": item.title,
            "eventDate": str(item.event_date),
            "eventTime": to_text(item.event_time),
            "note": item.note,
            "daysLeft": (item.event_date - today).days,
        }
        for item in events
    ]


def get_today_schedules(db: Session):
    try:
        from app.models.schedule import Schedule
    except Exception:
        return []

    today_weekday = date.today().weekday()

    schedules = (
        db.query(Schedule)
        .filter(Schedule.day_of_week == today_weekday)
        .order_by(Schedule.start_time.asc())
        .all()
    )

    return [
        {
            "id": item.id,
            "title": item.title,
            "category": item.category,
            "startTime": to_text(item.start_time),
            "endTime": to_text(item.end_time),
            "location": item.location,
            "note": item.note,
        }
        for item in schedules
    ]


@router.get("/summary")
def get_reminders_summary(db: Session = Depends(get_db)):
    deadline_reminders = get_deadline_reminders(db)
    project_reminders = get_project_reminders(db)
    today_tasks = get_today_tasks(db)
    upcoming_events = get_upcoming_events(db)
    today_schedules = get_today_schedules(db)

    total_count = (
        len(deadline_reminders["overdue"])
        + len(deadline_reminders["upcoming"])
        + len(project_reminders["overdue"])
        + len(project_reminders["upcoming"])
        + len(today_tasks)
        + len(upcoming_events)
        + len(today_schedules)
    )

    return {
        "totalCount": total_count,
        "overdueDeadlines": deadline_reminders["overdue"],
        "upcomingDeadlines": deadline_reminders["upcoming"],
        "overdueProjects": project_reminders["overdue"],
        "upcomingProjects": project_reminders["upcoming"],
        "todayTasks": today_tasks,
        "upcomingEvents": upcoming_events,
        "todaySchedules": today_schedules,
    }