from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthStatusResponse,
    AuthTokenResponse,
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    SetupRequest,
    UserResponse,
)
from app.security import (
    create_session,
    extract_bearer_token,
    get_user_by_token,
    hash_password,
    normalize_username,
    revoke_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    token = extract_bearer_token(authorization)
    user = get_user_by_token(db, token)

    if not user:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ")

    return user


@router.get("/status", response_model=AuthStatusResponse)
def get_auth_status(db: Session = Depends(get_db)):
    has_account = db.query(User).count() > 0
    return {"has_account": has_account}


@router.post("/setup", response_model=AuthTokenResponse)
def setup_first_account(data: SetupRequest, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="Ứng dụng đã có tài khoản")

    username = normalize_username(data.username)
    user = User(
        username=username,
        display_name=data.display_name.strip() if data.display_name else username,
        password_hash=hash_password(data.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token, expires_at = create_session(db, user)

    return {
        "token": token,
        "expires_at": expires_at,
        "user": user,
    }


@router.post("/login", response_model=AuthTokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    username = normalize_username(data.username)
    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Sai tài khoản hoặc mật khẩu")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    token, expires_at = create_session(db, user)

    return {
        "token": token,
        "expires_at": expires_at,
        "user": user,
    }


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")

    user.password_hash = hash_password(data.new_password)

    db.query(User).filter(User.id == user.id).update(
        {"password_hash": user.password_hash}
    )
    db.commit()

    return {"message": "Đã đổi mật khẩu thành công"}


@router.post("/logout", response_model=MessageResponse)
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    token = extract_bearer_token(authorization)
    revoke_token(db, token)
    return {"message": "Đã đăng xuất"}
