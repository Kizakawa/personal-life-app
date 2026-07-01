from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.expense import Expense
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseSummary,
    ExpenseUpdate,
    SurvivalCategory,
    SurvivalPlanRequest,
    SurvivalPlanResponse,
)

router = APIRouter(prefix="/expenses", tags=["Expenses"])


def apply_month_filter(query, year: int | None, month: int | None):
    if year is not None:
        query = query.filter(extract("year", Expense.transaction_date) == year)

    if month is not None:
        query = query.filter(extract("month", Expense.transaction_date) == month)

    return query


def get_risk_level(daily_budget: int):
    if daily_budget >= 120000:
        return "safe", "Ngân sách khá ổn nếu chi tiêu có kiểm soát."

    if daily_budget >= 70000:
        return "manageable", "Có thể sống được, nhưng cần hạn chế chi tiêu phụ."

    if daily_budget >= 40000:
        return "tight", "Ngân sách khá căng, cần ưu tiên ăn uống cơ bản và đi lại cần thiết."

    return "critical", "Ngân sách rất thấp, cần cắt gần như toàn bộ chi tiêu không thiết yếu."


def build_survival_suggestions(
    daily_budget: int,
    days: int,
    cooking_available: bool,
    city_level: str,
):
    suggestions = []

    if cooking_available:
        suggestions.append("Ưu tiên tự nấu, mua nguyên liệu rẻ và chia khẩu phần theo ngày.")
    else:
        suggestions.append("Ưu tiên cơm bình dân, suất ăn cố định, tránh gọi đồ ăn qua app.")

    if daily_budget < 70000:
        suggestions.append("Tạm dừng đồ uống ngoài, đồ ăn vặt, mua sắm và giải trí trả phí.")
        suggestions.append("Chỉ di chuyển khi thật cần thiết, ưu tiên đi bộ hoặc phương tiện rẻ.")

    if daily_budget < 40000:
        suggestions.append("Cần tìm nguồn hỗ trợ thêm như mượn tạm, ứng trước hoặc làm thêm ngắn hạn.")
        suggestions.append("Chia tiền thành từng ngày, không cầm toàn bộ tiền khi ra ngoài.")

    if city_level == "high":
        suggestions.append("Chi phí ở thành phố lớn cao hơn, cần giảm khoản linh hoạt và tăng quỹ ăn uống.")

    if days >= 14:
        suggestions.append("Thời gian kéo dài, nên giữ một khoản dự phòng nhỏ cho thuốc men hoặc phát sinh.")

    return suggestions


@router.get("", response_model=list[ExpenseResponse])
def get_expenses(
    year: int | None = None,
    month: int | None = Query(default=None, ge=1, le=12),
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Expense)
    query = apply_month_filter(query, year, month)
    query = query.order_by(Expense.transaction_date.desc(), Expense.id.desc()).offset(offset)

    if limit is not None:
        query = query.limit(limit)

    return query.all()


@router.post("", response_model=ExpenseResponse)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    new_expense = Expense(**expense.model_dump())
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    return new_expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()

    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")

    for key, value in expense_data.model_dump().items():
        setattr(expense, key, value)

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()

    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")

    db.delete(expense)
    db.commit()

    return {
        "message": "Expense deleted successfully",
        "id": expense_id,
    }


@router.get("/summary", response_model=ExpenseSummary)
def get_expense_summary(
    year: int | None = None,
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    query = db.query(Expense)
    query = apply_month_filter(query, year, month)

    transactions = query.all()

    total_income = sum(
        item.amount for item in transactions if item.transaction_type == "income"
    )
    total_expense = sum(
        item.amount for item in transactions if item.transaction_type == "expense"
    )

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income - total_expense,
    }


@router.post("/survival-plan", response_model=SurvivalPlanResponse)
def create_survival_plan(data: SurvivalPlanRequest):
    available_money = data.total_money - data.fixed_costs

    if available_money <= 0:
        raise HTTPException(
            status_code=400,
            detail="Chi phí cố định phải nhỏ hơn số tiền hiện có.",
        )

    daily_budget = available_money // data.days
    risk_level, risk_message = get_risk_level(daily_budget)

    food_daily = int(daily_budget * 0.6)
    transport_daily = int(daily_budget * 0.15)
    emergency_daily = int(daily_budget * 0.1)
    flexible_daily = daily_budget - food_daily - transport_daily - emergency_daily

    categories = [
        SurvivalCategory(
            name="Ăn uống",
            daily_amount=food_daily,
            total_amount=food_daily * data.days,
            note="Ưu tiên bữa chính, hạn chế đồ ăn vặt.",
        ),
        SurvivalCategory(
            name="Đi lại",
            daily_amount=transport_daily,
            total_amount=transport_daily * data.days,
            note="Chỉ dùng cho việc thật cần thiết.",
        ),
        SurvivalCategory(
            name="Dự phòng",
            daily_amount=emergency_daily,
            total_amount=emergency_daily * data.days,
            note="Giữ lại cho thuốc men hoặc phát sinh nhỏ.",
        ),
        SurvivalCategory(
            name="Linh hoạt",
            daily_amount=flexible_daily,
            total_amount=flexible_daily * data.days,
            note="Dùng cho nhu cầu nhỏ, có thể cắt nếu thiếu tiền.",
        ),
    ]

    return SurvivalPlanResponse(
        available_money=available_money,
        daily_budget=daily_budget,
        risk_level=risk_level,
        risk_message=risk_message,
        categories=categories,
        suggestions=build_survival_suggestions(
            daily_budget=daily_budget,
            days=data.days,
            cooking_available=data.cooking_available,
            city_level=data.city_level,
        ),
    )