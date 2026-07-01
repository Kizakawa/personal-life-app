from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.expense_budget import ExpenseBudget
from app.models.expense_category import ExpenseCategory
from app.schemas.expense_budget import (
    ExpenseBudgetCreate,
    ExpenseBudgetResponse,
    ExpenseBudgetUpdate,
)

router = APIRouter(
    prefix="/expense-budgets",
    tags=["Expense Budgets"],
)


def ensure_category_exists(db: Session, category: str):
    existed = db.query(ExpenseCategory).filter(ExpenseCategory.value == category).first()

    if not existed:
        raise HTTPException(status_code=400, detail="Danh mục không tồn tại")


@router.get("/", response_model=list[ExpenseBudgetResponse])
def get_expense_budgets(
    month: int = Query(ge=1, le=12),
    year: int = Query(ge=2000, le=2200),
    db: Session = Depends(get_db),
):
    return (
        db.query(ExpenseBudget)
        .filter(ExpenseBudget.month == month, ExpenseBudget.year == year)
        .order_by(ExpenseBudget.category.asc())
        .all()
    )


@router.post("/", response_model=ExpenseBudgetResponse)
def create_or_update_expense_budget(
    budget_data: ExpenseBudgetCreate,
    db: Session = Depends(get_db),
):
    ensure_category_exists(db, budget_data.category)

    budget = (
        db.query(ExpenseBudget)
        .filter(
            ExpenseBudget.category == budget_data.category,
            ExpenseBudget.month == budget_data.month,
            ExpenseBudget.year == budget_data.year,
        )
        .first()
    )

    if budget:
        budget.limit_amount = budget_data.limit_amount
        budget.note = budget_data.note
    else:
        budget = ExpenseBudget(**budget_data.model_dump())
        db.add(budget)

    db.commit()
    db.refresh(budget)

    return budget


@router.put("/{budget_id}", response_model=ExpenseBudgetResponse)
def update_expense_budget(
    budget_id: int,
    budget_data: ExpenseBudgetUpdate,
    db: Session = Depends(get_db),
):
    budget = db.query(ExpenseBudget).filter(ExpenseBudget.id == budget_id).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy hạn mức")

    update_data = budget_data.model_dump(exclude_unset=True)

    if "category" in update_data:
        ensure_category_exists(db, update_data["category"])

    for key, value in update_data.items():
        setattr(budget, key, value)

    db.commit()
    db.refresh(budget)

    return budget


@router.delete("/{budget_id}")
def delete_expense_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.query(ExpenseBudget).filter(ExpenseBudget.id == budget_id).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy hạn mức")

    db.delete(budget)
    db.commit()

    return {"message": "Đã xóa hạn mức thành công"}
