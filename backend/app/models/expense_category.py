from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False, default="expense")
    icon = Column(String, nullable=False, default="KH")
    color = Column(String, nullable=False, default="#64748b")
    default_budget = Column(Integer, nullable=False, default=0)
    is_default = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
