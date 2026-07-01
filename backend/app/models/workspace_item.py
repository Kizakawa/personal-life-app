from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Integer, String, Text

from app.database import Base


class WorkspaceItem(Base):
    __tablename__ = "workspace_items"

    id = Column(Integer, primary_key=True, index=True)

    module = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)

    category = Column(String, nullable=True)
    status = Column(String, nullable=True, default="active")
    priority = Column(String, nullable=True, default="medium")

    subject = Column(String, nullable=True)
    project_name = Column(String, nullable=True)

    target_date = Column(Date, nullable=True)

    file_path = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)
    content = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)