from datetime import date

from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    transaction_type: str = Field(pattern="^(income|expense)$")
    amount: int = Field(gt=0)
    category: str
    transaction_date: date
    payment_method: str = "cash"
    note: str | None = None


class ExpenseUpdate(ExpenseCreate):
    pass


class ExpenseResponse(ExpenseCreate):
    id: int

    class Config:
        from_attributes = True


class ExpenseSummary(BaseModel):
    total_income: int
    total_expense: int
    balance: int


class SurvivalPlanRequest(BaseModel):
    total_money: int = Field(gt=0)
    days: int = Field(gt=0)
    fixed_costs: int = Field(default=0, ge=0)
    city_level: str = "medium"
    cooking_available: bool = True


class SurvivalCategory(BaseModel):
    name: str
    daily_amount: int
    total_amount: int
    note: str


class SurvivalPlanResponse(BaseModel):
    available_money: int
    daily_budget: int
    risk_level: str
    risk_message: str
    categories: list[SurvivalCategory]
    suggestions: list[str]