from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database import Base


class FileItem(Base):
    __tablename__ = "file_items"

    id = Column(Integer, primary_key=True, index=True)

    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=True)
    file_path = Column(Text, nullable=True)
    public_token = Column(String, unique=True, index=True, nullable=True)

    file_type = Column(String, nullable=True)
    module = Column(String, nullable=False, default="documents")

    subject = Column(String, nullable=True)
    project_name = Column(String, nullable=True)
    url = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)