from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.gamification import build_gamification_summary

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


DAY_LABELS = {
    2: "T2",
    3: "T3",
    4: "T4",
    5: "T5",
    6: "T6",
    7: "T7",
    1: "CN",
}

CATEGORY_LABELS = {
    "food": "Ăn uống",
    "study": "Học tập",
    "transport": "Đi lại",
    "entertainment": "Giải trí",
    "health": "Sức khỏe",
    "salary": "Lương / trợ cấp",
    "other": "Khác",
}


def safe_get(obj, names, default=None):
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)
            if value is not None:
                return value

    return default


def to_text(value):
    if value is None:
        return None

    if isinstance(value, (datetime, date, time)):
        return str(value)

    return value


def normalize_date(value):
    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    return None


def current_app_day(today=None):
    current = today or date.today()
    weekday = current.weekday()

    if weekday == 6:
        return 1

    return weekday + 2


def is_today_schedule(item):
    today = date.today()
    app_day = current_app_day(today)

    date_value = safe_get(item, ["schedule_date", "date", "day_date"])

    if isinstance(date_value, datetime):
        date_value = date_value.date()

    if date_value == today:
        return True

    day_value = safe_get(item, ["day_of_week", "weekday", "day"])

    if day_value is None:
        return False

    if isinstance(day_value, int):
        return day_value == app_day

    day_text = str(day_value).lower().strip()

    weekday_map = {
        "1": 1,
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
        "monday": 2,
        "tuesday": 3,
        "wednesday": 4,
        "thursday": 5,
        "friday": 6,
        "saturday": 7,
        "sunday": 1,
        "thu 2": 2,
        "thứ 2": 2,
        "thứ hai": 2,
        "thu 3": 3,
        "thứ 3": 3,
        "thứ ba": 3,
        "thu 4": 4,
        "thứ 4": 4,
        "thứ tư": 4,
        "thu 5": 5,
        "thứ 5": 5,
        "thứ năm": 5,
        "thu 6": 6,
        "thứ 6": 6,
        "thứ sáu": 6,
        "thu 7": 7,
        "thứ 7": 7,
        "thứ bảy": 7,
        "chu nhat": 1,
        "chủ nhật": 1,
    }

    return weekday_map.get(day_text) == app_day


def priority_rank(priority):
    value = str(priority or "medium").lower().strip()

    if value == "high":
        return 0

    if value == "medium":
        return 1

    if value == "low":
        return 2

    return 3


def status_rank(status):
    value = str(status or "pending").lower().strip()

    if value == "doing":
        return 0

    if value in ["almost_done", "almost-done", "near_done"]:
        return 1

    if value == "pending":
        return 2

    return 3


def load_today_schedules(db: Session):
    try:
        from app.models.schedule import Schedule
    except Exception:
        return []

    try:
        schedules = db.query(Schedule).all()
    except Exception:
        return []

    result = []

    for item in schedules:
        if not is_today_schedule(item):
            continue

        result.append({
            "id": safe_get(item, ["id"]),
            "title": safe_get(item, ["title", "subject_name", "subject", "name"], "Lịch học"),
            "startTime": to_text(safe_get(item, ["start_time", "startTime", "start"])),
            "endTime": to_text(safe_get(item, ["end_time", "endTime", "end"])),
            "location": safe_get(item, ["location", "room", "classroom"]),
            "teacher": safe_get(item, ["teacher", "lecturer"]),
            "type": safe_get(item, ["type", "schedule_type"]),
            "category": safe_get(item, ["category"], "study"),
        })

    result.sort(key=lambda item: item["startTime"] or "")
    return result


def load_today_tasks(db: Session):
    try:
        from app.models.task import Task
    except Exception:
        return []

    today = date.today()

    try:
        tasks = db.query(Task).all()
    except Exception:
        return []

    result = []

    for item in tasks:
        task_date = normalize_date(safe_get(item, ["task_date", "date"]))

        if task_date != today:
            continue

        result.append({
            "id": safe_get(item, ["id"]),
            "title": safe_get(item, ["title", "name"], "Việc cần làm"),
            "startTime": to_text(safe_get(item, ["start_time"])),
            "endTime": to_text(safe_get(item, ["end_time"])),
            "status": safe_get(item, ["status"], "pending"),
            "priority": safe_get(item, ["priority"], "medium"),
            "note": safe_get(item, ["note"]),
        })

    result.sort(key=lambda item: (status_rank(item["status"]), priority_rank(item["priority"])))
    return result


def load_upcoming_deadlines(db: Session):
    try:
        from app.models.deadline import Deadline
    except Exception:
        return []

    today = date.today()
    limit_day = today + timedelta(days=7)

    try:
        deadlines = db.query(Deadline).all()
    except Exception:
        return []

    result = []

    for item in deadlines:
        due_date = normalize_date(safe_get(item, ["due_date", "deadline_date", "date"]))

        if due_date is None:
            continue

        if due_date < today or due_date > limit_day:
            continue

        status = safe_get(item, ["status"], "pending")

        if str(status).lower().strip() == "done":
            continue

        result.append({
            "id": safe_get(item, ["id"]),
            "title": safe_get(item, ["title", "name"], "Deadline"),
            "subject": safe_get(item, ["subject", "subject_name"]),
            "dueDate": str(due_date),
            "daysLeft": (due_date - today).days,
            "priority": safe_get(item, ["priority"], "medium"),
            "status": status,
        })

    result.sort(key=lambda item: (item["daysLeft"], priority_rank(item["priority"])))
    return result


def load_active_projects(db: Session):
    try:
        from app.models.project import Project
    except Exception:
        return []

    try:
        projects = db.query(Project).all()
    except Exception:
        return []

    today = date.today()
    done_statuses = {"done", "completed", "finished", "archived", "đã xong", "da xong"}
    result = []

    for item in projects:
        status = safe_get(item, ["status"], "pending")
        status_text = str(status or "").lower().strip()

        if status_text in done_statuses:
            continue

        deadline_date = normalize_date(safe_get(item, ["deadline_date", "due_date", "date"]))
        days_left = None

        if deadline_date is not None:
            days_left = (deadline_date - today).days

        result.append({
            "id": safe_get(item, ["id"]),
            "name": safe_get(item, ["name", "title"], "Dự án"),
            "goal": safe_get(item, ["goal"]),
            "status": status,
            "priority": safe_get(item, ["priority"], "medium"),
            "deadlineDate": str(deadline_date) if deadline_date else None,
            "daysLeft": days_left,
            "todo": safe_get(item, ["todo"]),
            "currentBug": safe_get(item, ["current_bug", "bug"]),
        })

    result.sort(
        key=lambda item: (
            status_rank(item["status"]),
            priority_rank(item["priority"]),
            item["daysLeft"] if item["daysLeft"] is not None else 99999,
        )
    )

    return result[:5]


def load_subjects_need_review(db: Session):
    try:
        from app.models.subject import Subject
    except Exception:
        return []

    try:
        subjects = db.query(Subject).all()
    except Exception:
        return []

    progress_order = {
        "needs_review": 0,
        "need_review": 0,
        "can_xem_lai": 0,
        "cần xem lại": 0,
        "not_started": 1,
        "not-started": 1,
        "chua_hoc": 1,
        "chưa học": 1,
        "studying": 2,
        "dang_hoc": 2,
        "đang học": 2,
        "reviewed": 3,
        "da_on": 3,
        "đã ôn": 3,
    }

    reviewed_statuses = {"reviewed", "da_on", "đã ôn", "done", "completed"}
    result = []

    for item in subjects:
        progress_status = safe_get(item, ["progress_status"], "not_started")
        progress_key = str(progress_status or "").lower().strip()

        if progress_key in reviewed_statuses:
            continue

        result.append({
            "id": safe_get(item, ["id"]),
            "name": safe_get(item, ["name", "title"], "Môn học"),
            "lecturer": safe_get(item, ["lecturer", "teacher"]),
            "credits": safe_get(item, ["credits"]),
            "room": safe_get(item, ["room", "classroom"]),
            "semester": safe_get(item, ["semester"]),
            "progressStatus": progress_status,
            "note": safe_get(item, ["note"]),
        })

    result.sort(
        key=lambda item: progress_order.get(
            str(item["progressStatus"] or "").lower().strip(),
            9,
        )
    )

    return result[:5]


def load_recent_files(db: Session):
    try:
        from app.models.file_item import FileItem
    except Exception:
        return []

    try:
        files = db.query(FileItem).order_by(FileItem.created_at.desc()).limit(5).all()
    except Exception:
        return []

    result = []

    for item in files:
        result.append({
            "id": safe_get(item, ["id"]),
            "name": safe_get(item, ["original_name"], "Tài liệu"),
            "fileType": safe_get(item, ["file_type"], "other"),
            "subject": safe_get(item, ["subject"]),
            "projectName": safe_get(item, ["project_name"]),
            "url": safe_get(item, ["url"]),
            "hasFile": bool(safe_get(item, ["file_path"])),
            "createdAt": to_text(safe_get(item, ["created_at"])),
        })

    return result


def load_expense_summary(db: Session):
    try:
        from app.models.expense import Expense
    except Exception:
        return {"totalIncome": 0, "totalExpense": 0, "balance": 0}

    today = date.today()
    total_income = 0
    total_expense = 0

    try:
        expenses = db.query(Expense).all()
    except Exception:
        expenses = []

    for item in expenses:
        item_date = normalize_date(
            safe_get(item, ["expense_date", "transaction_date", "date", "created_at"])
        )

        if isinstance(item_date, date):
            if item_date.year != today.year or item_date.month != today.month:
                continue

        amount = safe_get(item, ["amount", "money", "value"], 0) or 0

        try:
            amount = float(amount)
        except Exception:
            amount = 0

        kind = str(
            safe_get(item, ["transaction_type", "type", "kind", "category_type"], "expense")
        ).lower()

        if kind in ["income", "thu", "in"]:
            total_income += amount
        else:
            total_expense += amount

    return {
        "totalIncome": total_income,
        "totalExpense": total_expense,
        "balance": total_income - total_expense,
    }


def load_finance_charts(db: Session):
    try:
        from app.models.expense import Expense
    except Exception:
        return {
            "monthlyTrend": [],
            "categoryBreakdown": [],
            "recentTransactions": [],
        }

    today = date.today()
    monthly = {
        month: {"month": month, "label": f"T{month}", "income": 0, "expense": 0}
        for month in range(1, 13)
    }
    categories = {}
    recent_transactions = []

    try:
        expenses = db.query(Expense).order_by(Expense.transaction_date.desc(), Expense.id.desc()).all()
    except Exception:
        expenses = []

    for item in expenses:
        item_date = normalize_date(safe_get(item, ["transaction_date", "date"]))

        if not isinstance(item_date, date) or item_date.year != today.year:
            continue

        amount = float(safe_get(item, ["amount"], 0) or 0)
        kind = str(safe_get(item, ["transaction_type"], "expense")).lower()

        if kind == "income":
            monthly[item_date.month]["income"] += amount
        else:
            monthly[item_date.month]["expense"] += amount

            if item_date.month == today.month:
                category = str(safe_get(item, ["category"], "other") or "other")
                if category not in categories:
                    categories[category] = {
                        "key": category,
                        "label": CATEGORY_LABELS.get(category, category),
                        "amount": 0,
                    }

                categories[category]["amount"] += amount

        if len(recent_transactions) < 5:
            recent_transactions.append({
                "id": safe_get(item, ["id"]),
                "type": kind,
                "amount": amount,
                "category": safe_get(item, ["category"], "other"),
                "categoryLabel": CATEGORY_LABELS.get(
                    str(safe_get(item, ["category"], "other") or "other"),
                    safe_get(item, ["category"], "Khác"),
                ),
                "date": str(item_date),
                "note": safe_get(item, ["note"]),
            })

    return {
        "monthlyTrend": list(monthly.values()),
        "categoryBreakdown": sorted(
            categories.values(),
            key=lambda item: item["amount"],
            reverse=True,
        ),
        "recentTransactions": recent_transactions,
    }


def count_by_status(items, statuses):
    result = {status: 0 for status in statuses}

    for item in items:
        status = str(safe_get(item, ["status"], "pending") or "pending").lower().strip()

        if status in result:
            result[status] += 1
        else:
            result["other"] = result.get("other", 0) + 1

    return result


def load_productivity_stats(db: Session):
    result = {
        "tasks": {"total": 0, "pending": 0, "doing": 0, "done": 0},
        "deadlines": {"total": 0, "pending": 0, "doing": 0, "done": 0, "overdue": 0},
        "projects": {"total": 0, "pending": 0, "doing": 0, "almost_done": 0, "done": 0},
        "subjects": {"total": 0, "not_started": 0, "studying": 0, "needs_review": 0, "reviewed": 0},
    }

    today = date.today()

    try:
        from app.models.task import Task

        tasks = db.query(Task).all()
        task_status = count_by_status(tasks, ["pending", "doing", "done"])
        result["tasks"] = {"total": len(tasks), **task_status}
    except Exception:
        pass

    try:
        from app.models.deadline import Deadline

        deadlines = db.query(Deadline).all()
        deadline_status = count_by_status(deadlines, ["pending", "doing", "done"])
        overdue = 0

        for item in deadlines:
            due_date = normalize_date(safe_get(item, ["due_date"]))
            status = str(safe_get(item, ["status"], "pending") or "pending").lower()

            if due_date and due_date < today and status != "done":
                overdue += 1

        result["deadlines"] = {
            "total": len(deadlines),
            **deadline_status,
            "overdue": overdue,
        }
    except Exception:
        pass

    try:
        from app.models.project import Project

        projects = db.query(Project).all()
        project_status = count_by_status(projects, ["pending", "doing", "almost_done", "done"])
        result["projects"] = {"total": len(projects), **project_status}
    except Exception:
        pass

    try:
        from app.models.subject import Subject

        subjects = db.query(Subject).all()
        subject_stats = {
            "total": len(subjects),
            "not_started": 0,
            "studying": 0,
            "needs_review": 0,
            "reviewed": 0,
        }

        for item in subjects:
            progress = str(safe_get(item, ["progress_status"], "not_started") or "not_started")
            if progress in subject_stats:
                subject_stats[progress] += 1

        result["subjects"] = subject_stats
    except Exception:
        pass

    return result


def load_week_workload(db: Session):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    days = []

    for index in range(7):
        current = monday + timedelta(days=index)
        app_day = current_app_day(current)
        days.append({
            "date": str(current),
            "dayOfWeek": app_day,
            "label": DAY_LABELS[app_day],
            "schedules": 0,
            "tasks": 0,
            "total": 0,
        })

    try:
        from app.models.schedule import Schedule

        schedules = db.query(Schedule).all()
        for item in schedules:
            day_value = safe_get(item, ["day_of_week"])
            for day in days:
                if day["dayOfWeek"] == day_value:
                    day["schedules"] += 1
                    break
    except Exception:
        pass

    try:
        from app.models.task import Task

        tasks = db.query(Task).all()
        for item in tasks:
            task_date = normalize_date(safe_get(item, ["task_date"]))
            if not task_date:
                continue

            for day in days:
                if day["date"] == str(task_date):
                    day["tasks"] += 1
                    break
    except Exception:
        pass

    for day in days:
        day["total"] = day["schedules"] + day["tasks"]

    return days



def load_student_actions(db: Session):
    try:
        from app.models.subject import Subject
        from app.routers.student_hub import (
            build_calendar_days,
            build_gpa_summary,
            build_subject_card,
            build_today_actions,
        )

        subjects = db.query(Subject).order_by(Subject.name.asc()).all()
        subject_cards = [build_subject_card(db, subject) for subject in subjects]
        gpa_summary = build_gpa_summary(subject_cards)
        calendar_days = build_calendar_days(db, 14)
        return build_today_actions(calendar_days, subject_cards, gpa_summary)
    except Exception:
        return []

def build_survival_summary(expense_summary):
    today = date.today()

    if today.month == 12:
        next_month = date(today.year + 1, 1, 1)
    else:
        next_month = date(today.year, today.month + 1, 1)

    days_left = max((next_month - today).days, 1)
    available_money = expense_summary["balance"]
    safe_daily_budget = available_money / days_left if available_money > 0 else 0

    if available_money < 0:
        risk_level = "danger"
        risk_message = "Số dư tháng đang âm, cần khóa các khoản chi không thiết yếu."
    elif safe_daily_budget < 30000:
        risk_level = "warning"
        risk_message = "Ngân sách/ngày thấp, nên chi theo định mức cố định."
    else:
        risk_level = "stable"
        risk_message = "Ngân sách hiện tại tương đối ổn."

    return {
        "availableMoney": available_money,
        "days": days_left,
        "safeDailyBudget": safe_daily_budget,
        "riskLevel": risk_level,
        "riskMessage": risk_message,
    }



def load_focus_summary(db: Session):
    try:
        from app.routers.focus import serialize_focus_summary
        return serialize_focus_summary(db)
    except Exception:
        return {
            "totalSessions": 0,
            "totalMinutes": 0,
            "todaySessions": 0,
            "todayMinutes": 0,
            "weekSessions": 0,
            "weekMinutes": 0,
            "recentSessions": [],
        }


def build_focus_score(today_tasks, upcoming_deadlines, active_projects, expense_summary):
    score = 100
    score -= min(len(today_tasks) * 6, 24)
    score -= min(len(upcoming_deadlines) * 8, 32)
    score -= min(len(active_projects) * 4, 20)

    if expense_summary["balance"] < 0:
        score -= 18

    return max(score, 0)


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    today_schedules = load_today_schedules(db)
    today_tasks = load_today_tasks(db)
    upcoming_deadlines = load_upcoming_deadlines(db)
    active_projects = load_active_projects(db)
    subjects_need_review = load_subjects_need_review(db)
    recent_files = load_recent_files(db)
    expense_summary = load_expense_summary(db)
    finance_charts = load_finance_charts(db)
    productivity_stats = load_productivity_stats(db)
    week_workload = load_week_workload(db)
    survival_summary = build_survival_summary(expense_summary)
    student_actions = load_student_actions(db)
    focus_summary = load_focus_summary(db)
    gamification_summary = build_gamification_summary(db)
    focus_score = build_focus_score(
        today_tasks,
        upcoming_deadlines,
        active_projects,
        expense_summary,
    )

    reminders = []

    if today_schedules:
        reminders.append(f"Hôm nay có {len(today_schedules)} lịch cần chú ý.")
    else:
        reminders.append("Hôm nay chưa có lịch học hoặc lịch sinh hoạt.")

    if today_tasks:
        reminders.append(f"Có {len(today_tasks)} việc cần làm hôm nay.")

    urgent_deadlines = [item for item in upcoming_deadlines if item["daysLeft"] <= 1]
    if urgent_deadlines:
        reminders.append(f"Có {len(urgent_deadlines)} deadline rất gần hạn.")
    elif upcoming_deadlines:
        reminders.append(f"Có {len(upcoming_deadlines)} deadline trong 7 ngày tới.")

    if active_projects:
        reminders.append(f"Có {len(active_projects)} dự án đang cần theo dõi.")

    if subjects_need_review:
        reminders.append(f"Có {len(subjects_need_review)} môn cần học hoặc xem lại.")

    if recent_files:
        reminders.append(f"Có {len(recent_files)} tài liệu mới trong kho tài liệu.")

    if survival_summary["riskLevel"] != "stable":
        reminders.append(survival_summary["riskMessage"])

    if focus_summary.get("todayMinutes", 0) == 0:
        reminders.append("Hôm nay chưa có phiên tập trung nào, nên bắt đầu một Pomodoro ngắn.")

    overview = {
        "focusScore": focus_score,
        "todayScheduleCount": len(today_schedules),
        "todayTaskCount": len(today_tasks),
        "upcomingDeadlineCount": len(upcoming_deadlines),
        "activeProjectCount": len(active_projects),
        "subjectNeedReviewCount": len(subjects_need_review),
        "recentFileCount": len(recent_files),
        "monthlyBalance": expense_summary["balance"],
    }

    return {
        "overview": overview,
        "today": {
            "schedules": today_schedules,
            "tasks": today_tasks,
        },
        "finance": {
            "summary": expense_summary,
            "survival": survival_summary,
            **finance_charts,
        },
        "productivity": productivity_stats,
        "weekWorkload": week_workload,
        "todaySchedules": today_schedules,
        "todayTasks": today_tasks,
        "upcomingDeadlines": upcoming_deadlines,
        "activeProjects": active_projects,
        "subjectsNeedReview": subjects_need_review,
        "recentFiles": recent_files,
        "expenseSummary": expense_summary,
        "survivalSummary": survival_summary,
        "importantReminders": reminders,
        "studentActions": student_actions,
        "focus": focus_summary,
        "gamification": gamification_summary,
    }
