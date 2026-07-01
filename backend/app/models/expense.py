from sqlalchemy import Column, Date, Integer, String, Text

from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String, nullable=False)  # income | expense
    amount = Column(Integer, nullable=False)
    category = Column(String, nullable=False)
    transaction_date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=False, default="cash")
    note = Column(Text, nullable=True)