from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


def safe_count(db: Session, model):
    try:
        return db.query(model).count()
    except Exception:
        return 0


def get_task_stats(db: Session):
    try:
        from app.models.task import Task
    except Exception:
        return {
            "total": 0,
            "pending": 0,
            "doing": 0,
            "done": 0,
            "today": 0,
        }

    today = date.today()

    return {
        "total": db.query(Task).count(),
        "pending": db.query(Task).filter(Task.status == "pending").count(),
        "doing": db.query(Task).filter(Task.status == "doing").count(),
        "done": db.query(Task).filter(Task.status == "done").count(),
        "today": db.query(Task).filter(Task.task_date == today).count(),
    }


def get_deadline_stats(db: Session):
    try:
        from app.models.deadline import Deadline
    except Exception:
        return {
            "total": 0,
            "pending": 0,
            "doing": 0,
            "done": 0,
            "overdue": 0,
        }

    today = date.today()

    return {
        "total": db.query(Deadline).count(),
        "pending": db.query(Deadline).filter(Deadline.status == "pending").count(),
        "doing": db.query(Deadline).filter(Deadline.status == "doing").count(),
        "done": db.query(Deadline).filter(Deadline.status == "done").count(),
        "overdue": (
            db.query(Deadline)
            .filter(Deadline.due_date < today)
            .filter(Deadline.status != "done")
            .count()
        ),
    }


def get_project_stats(db: Session):
    try:
        from app.models.project import Project
    except Exception:
        return {
            "total": 0,
            "pending": 0,
            "doing": 0,
            "almostDone": 0,
            "done": 0,
            "overdue": 0,
        }

    today = date.today()

    return {
        "total": db.query(Project).count(),
        "pending": db.query(Project).filter(Project.status == "pending").count(),
        "doing": db.query(Project).filter(Project.status == "doing").count(),
        "almostDone": (
            db.query(Project)
            .filter(Project.status == "almost_done")
            .count()
        ),
        "done": db.query(Project).filter(Project.status == "done").count(),
        "overdue": (
            db.query(Project)
            .filter(Project.deadline_date < today)
            .filter(Project.status != "done")
            .count()
        ),
    }


def get_subject_stats(db: Session):
    try:
        from app.models.subject import Subject
    except Exception:
        return {
            "total": 0,
            "notStarted": 0,
            "studying": 0,
            "reviewed": 0,
            "needsReview": 0,
        }

    return {
        "total": db.query(Subject).count(),
        "notStarted": (
            db.query(Subject)
            .filter(Subject.progress_status == "not_started")
            .count()
        ),
        "studying": (
            db.query(Subject)
            .filter(Subject.progress_status == "studying")
            .count()
        ),
        "reviewed": (
            db.query(Subject)
            .filter(Subject.progress_status == "reviewed")
            .count()
        ),
        "needsReview": (
            db.query(Subject)
            .filter(Subject.progress_status == "needs_review")
            .count()
        ),
    }


def get_expense_stats(db: Session):
    try:
        from app.models.expense import Expense
    except Exception:
        return {
            "totalIncome": 0,
            "totalExpense": 0,
            "balance": 0,
        }

    today = date.today()
    total_income = 0
    total_expense = 0

    expenses = db.query(Expense).all()

    for item in expenses:
        if item.transaction_date.year != today.year:
            continue

        if item.transaction_type == "income":
            total_income += item.amount
        else:
            total_expense += item.amount

    return {
        "totalIncome": total_income,
        "totalExpense": total_expense,
        "balance": total_income - total_expense,
    }


def get_workspace_stats(db: Session):
    try:
        from app.models.workspace_item import WorkspaceItem
    except Exception:
        return {}

    modules = [
        "study",
        "class_notes",
        "knowledge",
        "exam",
        "documents",
        "journal",
        "commands",
    ]

    result = {}

    for module in modules:
        result[module] = (
            db.query(WorkspaceItem)
            .filter(WorkspaceItem.module == module)
            .count()
        )

    return result


@router.get("/summary")
def get_analytics_summary(db: Session = Depends(get_db)):
    try:
        from app.models.event import Event

        event_count = safe_count(db, Event)
    except Exception:
        event_count = 0

    try:
        from app.models.schedule import Schedule

        schedule_count = safe_count(db, Schedule)
    except Exception:
        schedule_count = 0

    try:
        from app.models.person import Person

        people_count = safe_count(db, Person)
    except Exception:
        people_count = 0

    return {
        "events": event_count,
        "schedules": schedule_count,
        "people": people_count,
        "tasks": get_task_stats(db),
        "deadlines": get_deadline_stats(db),
        "projects": get_project_stats(db),
        "subjects": get_subject_stats(db),
        "expenses": get_expense_stats(db),
        "workspace": get_workspace_stats(db),
    }
