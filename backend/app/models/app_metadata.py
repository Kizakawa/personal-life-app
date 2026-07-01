from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text

from app.database import Base


class AppMetadata(Base):
    __tablename__ = "app_metadata"

    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
