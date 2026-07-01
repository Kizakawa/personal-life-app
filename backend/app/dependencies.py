from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.security import extract_bearer_token, get_user_by_token


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = extract_bearer_token(authorization)
    user = get_user_by_token(db, token)

    if not user:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ")

    return user
