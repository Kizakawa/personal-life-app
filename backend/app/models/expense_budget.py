from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint

from app.database import Base


class ExpenseBudget(Base):
    __tablename__ = "expense_budgets"
    __table_args__ = (
        UniqueConstraint("category", "month", "year", name="uq_expense_budget_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    limit_amount = Column(Integer, nullable=False, default=0)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
