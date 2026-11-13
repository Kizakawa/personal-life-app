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
    if daily_budget >= 150000:
        return "safe", "Ngân sách tương đối an toàn. Vẫn nên đặt trần chi theo ngày để tránh tiêu lệch đầu kỳ."

    if daily_budget >= 100000:
        return "stable", "Có thể sống ổn nếu tự kiểm soát ăn uống, đi lại và giữ một khoản dự phòng nhỏ."

    if daily_budget >= 70000:
        return "manageable", "Có thể xoay được, nhưng phải cắt đồ uống ngoài, mua sắm nhỏ và các khoản linh hoạt."

    if daily_budget >= 40000:
        return "tight", "Ngân sách căng. Cần ưu tiên no bụng, đi lại bắt buộc và chia tiền theo từng ngày."

    return "critical", "Ngân sách rất thấp. Cần tìm thêm nguồn hỗ trợ hoặc giảm số ngày phải tự xoay nếu có thể."


def build_survival_suggestions(
    daily_budget: int,
    days: int,
    cooking_available: bool,
    city_level: str,
):
    suggestions = []

    if cooking_available:
        suggestions.append("Tự nấu là phương án chính: mua gạo/mì/trứng/đậu/rau theo 2-3 ngày, tránh mua lắt nhắt mỗi bữa.")
    else:
        suggestions.append("Không tự nấu thì ưu tiên cơm bình dân/suất cố định, chọn quán quen giá ổn và tránh gọi đồ ăn qua app.")

    suggestions.append("Chia tiền thành phong bì hoặc ví nhỏ theo ngày; tiền hôm sau không dùng để bù cho hôm nay.")

    if daily_budget < 70000:
        suggestions.append("Tạm dừng đồ uống ngoài, ăn vặt, mua sắm, game/nạp app và mọi khoản không giúp sống qua ngày.")
        suggestions.append("Chỉ di chuyển khi thật cần thiết; ghép việc cùng một chuyến để giảm tiền xe.")

    if daily_budget < 40000:
        suggestions.append("Nên chủ động tìm thêm nguồn hỗ trợ: mượn tạm, ứng trước, làm thêm ngắn hạn hoặc xin hỗ trợ bữa ăn.")
        suggestions.append("Không cầm toàn bộ tiền khi ra ngoài; giữ tối thiểu một khoản dự phòng y tế/đi lại khẩn cấp.")

    if city_level == "high":
        suggestions.append("Ở khu vực chi phí cao, giảm mạnh khoản linh hoạt và tăng phần ăn uống/đi lại bắt buộc.")
    elif city_level == "low":
        suggestions.append("Khu vực chi phí thấp cho phép giữ thêm dự phòng, nhưng vẫn nên ghi chi mỗi ngày.")

    if days >= 14:
        suggestions.append("Thời gian dài trên 2 tuần: đặt mốc kiểm tra mỗi 3 ngày để điều chỉnh trước khi thiếu tiền.")

    return suggestions


def build_survival_categories(daily_budget: int, days: int, cooking_available: bool):
    if daily_budget < 40000:
        food_ratio, transport_ratio, emergency_ratio = 0.72, 0.1, 0.12
    elif daily_budget < 70000:
        food_ratio, transport_ratio, emergency_ratio = 0.65, 0.13, 0.12
    elif cooking_available:
        food_ratio, transport_ratio, emergency_ratio = 0.55, 0.15, 0.12
    else:
        food_ratio, transport_ratio, emergency_ratio = 0.62, 0.14, 0.1

    food_daily = int(daily_budget * food_ratio)
    transport_daily = int(daily_budget * transport_ratio)
    emergency_daily = int(daily_budget * emergency_ratio)
    flexible_daily = max(daily_budget - food_daily - transport_daily - emergency_daily, 0)

    food_note = (
        "Tự nấu theo mẻ, ưu tiên món no lâu và rẻ."
        if cooking_available
        else "Chọn suất ăn cố định, tránh đồ uống và phí giao hàng."
    )

    return [
        SurvivalCategory(
            name="Ăn uống bắt buộc",
            daily_amount=food_daily,
            total_amount=food_daily * days,
            note=food_note,
        ),
        SurvivalCategory(
            name="Đi lại cần thiết",
            daily_amount=transport_daily,
            total_amount=transport_daily * days,
            note="Chỉ dùng cho học, làm, việc bắt buộc; gom nhiều việc vào một chuyến.",
        ),
        SurvivalCategory(
            name="Dự phòng sống còn",
            daily_amount=emergency_daily,
            total_amount=emergency_daily * days,
            note="Giữ cho thuốc men, phát sinh nhỏ hoặc một lượt di chuyển khẩn cấp.",
        ),
        SurvivalCategory(
            name="Linh hoạt có thể cắt",
            daily_amount=flexible_daily,
            total_amount=flexible_daily * days,
            note="Chỉ dùng khi ba khoản trên đã an toàn; thiếu tiền thì cắt khoản này trước.",
        ),
    ]


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

    return SurvivalPlanResponse(
        available_money=available_money,
        daily_budget=daily_budget,
        risk_level=risk_level,
        risk_message=risk_message,
        categories=build_survival_categories(
            daily_budget=daily_budget,
            days=data.days,
            cooking_available=data.cooking_available,
        ),
        suggestions=build_survival_suggestions(
            daily_budget=daily_budget,
            days=data.days,
            cooking_available=data.cooking_available,
            city_level=data.city_level,
        ),
    )
