import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.expense import Expense
from app.models.expense_category import ExpenseCategory
from app.schemas.expense_category import (
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCategoryUpdate,
)

router = APIRouter(
    prefix="/expense-categories",
    tags=["Expense Categories"],
)

DEFAULT_CATEGORIES = [
    {
        "value": "food",
        "name": "Ăn uống",
        "type": "expense",
        "icon": "AU",
        "color": "#f97316",
        "default_budget": 1500000,
    },
    {
        "value": "study",
        "name": "Học tập",
        "type": "expense",
        "icon": "HT",
        "color": "#7c3aed",
        "default_budget": 900000,
    },
    {
        "value": "transport",
        "name": "Đi lại",
        "type": "expense",
        "icon": "DL",
        "color": "#0ea5e9",
        "default_budget": 700000,
    },
    {
        "value": "entertainment",
        "name": "Giải trí",
        "type": "expense",
        "icon": "GT",
        "color": "#ec4899",
        "default_budget": 600000,
    },
    {
        "value": "health",
        "name": "Sức khỏe",
        "type": "expense",
        "icon": "SK",
        "color": "#10b981",
        "default_budget": 800000,
    },
    {
        "value": "shopping",
        "name": "Mua sắm",
        "type": "expense",
        "icon": "MS",
        "color": "#f59e0b",
        "default_budget": 700000,
    },
    {
        "value": "salary",
        "name": "Lương / trợ cấp",
        "type": "income",
        "icon": "LT",
        "color": "#16a34a",
        "default_budget": 0,
    },
    {
        "value": "other",
        "name": "Khác",
        "type": "expense",
        "icon": "KH",
        "color": "#64748b",
        "default_budget": 500000,
    },
]


def slugify(value: str):
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return slug or "category"


def build_unique_value(db: Session, name: str):
    base_value = slugify(name)
    value = base_value
    counter = 2

    while db.query(ExpenseCategory).filter(ExpenseCategory.value == value).first():
        value = f"{base_value}-{counter}"
        counter += 1

    return value


def ensure_default_categories(db: Session):
    for category_data in DEFAULT_CATEGORIES:
        existed = (
            db.query(ExpenseCategory)
            .filter(ExpenseCategory.value == category_data["value"])
            .first()
        )

        if existed:
            continue

        db.add(ExpenseCategory(**category_data, is_default=1))

    db.commit()


@router.get("/", response_model=list[ExpenseCategoryResponse])
def get_expense_categories(
    type: str | None = Query(default=None, pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
):
    ensure_default_categories(db)

    query = db.query(ExpenseCategory)

    if type:
        query = query.filter(ExpenseCategory.type == type)

    return query.order_by(ExpenseCategory.type.asc(), ExpenseCategory.name.asc()).all()


@router.post("/", response_model=ExpenseCategoryResponse)
def create_expense_category(
    category_data: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
):
    ensure_default_categories(db)

    payload = category_data.model_dump()
    value = payload.get("value") or build_unique_value(db, payload["name"])
    value = slugify(value)
    payload.pop("value", None)

    existed = db.query(ExpenseCategory).filter(ExpenseCategory.value == value).first()

    if existed:
        raise HTTPException(status_code=400, detail="Mã danh mục đã tồn tại")

    category = ExpenseCategory(**payload, value=value, is_default=0)

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


@router.put("/{category_id}", response_model=ExpenseCategoryResponse)
def update_expense_category(
    category_id: int,
    category_data: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
):
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()

    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")

    update_data = category_data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)

    return category


@router.delete("/{category_id}")
def delete_expense_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == category_id).first()

    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")

    if category.is_default:
        raise HTTPException(status_code=400, detail="Không thể xóa danh mục mặc định")

    used = db.query(Expense).filter(Expense.category == category.value).first()

    if used:
        raise HTTPException(
            status_code=400,
            detail="Danh mục đã có giao dịch, không nên xóa để tránh mất lịch sử",
        )

    db.delete(category)
    db.commit()

    return {"message": "Đã xóa danh mục thành công"}
