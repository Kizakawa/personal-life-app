from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import AuthSession, User
from app.schemas.auth import (
    AuthStatusResponse,
    AuthTokenResponse,
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RecoveryInfoResponse,
    RecoveryKeyResponse,
    ResetPasswordRequest,
    SecurityQuestionResponse,
    SecurityQuestionUpdateRequest,
    SetupRequest,
    UserResponse,
)
from app.security import (
    create_session,
    extract_bearer_token,
    generate_recovery_key,
    get_user_by_token,
    hash_password,
    hash_recovery_key,
    hash_security_answer,
    normalize_username,
    revoke_token,
    verify_password,
    verify_recovery_key,
    verify_security_answer,
)
from app.storage import RECOVERY_KEY_PATH, save_recovery_key_file

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
    users = db.query(User).all()
    has_account = len(users) > 0
    default_username = users[0].username if len(users) == 1 else None
    return {"has_account": has_account, "default_username": default_username}


@router.post("/setup", response_model=AuthTokenResponse)
def setup_first_account(data: SetupRequest, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="Ứng dụng đã có tài khoản")

    username = normalize_username(data.username)
    recovery_key = generate_recovery_key()
    recovery_hash = hash_recovery_key(recovery_key)

    question = data.security_question.strip() if data.security_question else None
    answer_hash = hash_security_answer(data.security_answer) if data.security_answer else None

    user = User(
        username=username,
        display_name=data.display_name.strip() if data.display_name else username,
        password_hash=hash_password(data.password),
        security_question=question,
        security_answer_hash=answer_hash,
        recovery_key=recovery_key,
        recovery_key_hash=recovery_hash,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    save_recovery_key_file(username, recovery_key)

    token, expires_at = create_session(db, user)

    return {
        "token": token,
        "expires_at": expires_at,
        "user": user,
        "recovery_key": recovery_key,
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


@router.get("/recovery-info", response_model=RecoveryInfoResponse)
def get_recovery_info(
    username: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if username and username.strip():
        user = db.query(User).filter(User.username == normalize_username(username)).first()
    else:
        users = db.query(User).all()
        user = users[0] if len(users) == 1 else None

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tài khoản. Vui lòng kiểm tra lại tên tài khoản.",
        )

    return {
        "username": user.username,
        "has_security_question": bool(user.security_question and user.security_answer_hash),
        "security_question": user.security_question,
        "has_recovery_key": bool(user.recovery_key or user.recovery_key_hash),
    }


@router.post("/forgot-password/reset", response_model=AuthTokenResponse)
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    username = normalize_username(data.username)
    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tài khoản. Vui lòng kiểm tra lại tên tài khoản.",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    if data.method == "question":
        if not user.security_answer_hash:
            raise HTTPException(
                status_code=400,
                detail="Tài khoản này chưa cài đặt câu hỏi bảo mật. Vui lòng sử dụng Mã khôi phục.",
            )
        if not verify_security_answer(data.security_answer, user.security_answer_hash):
            raise HTTPException(
                status_code=400,
                detail="Câu trả lời bảo mật không chính xác. Vui lòng kiểm tra lại.",
            )
    elif data.method == "key":
        if not verify_recovery_key(data.recovery_key, user.recovery_key_hash, user.recovery_key):
            raise HTTPException(
                status_code=400,
                detail="Mã khôi phục không chính xác. Vui lòng kiểm tra lại mã PLA-XXXX-XXXX-XXXX.",
            )
    else:
        raise HTTPException(status_code=400, detail="Phương thức khôi phục không hợp lệ")

    # Đặt mật khẩu mới
    user.password_hash = hash_password(data.new_password)
    user.updated_at = datetime.utcnow()

    # Thu hồi tất cả các phiên đăng nhập cũ
    db.query(AuthSession).filter(AuthSession.user_id == user.id).update(
        {"revoked_at": datetime.utcnow()}
    )

    # Tạo phiên đăng nhập mới cho người dùng
    token, expires_at = create_session(db, user)

    return {
        "token": token,
        "expires_at": expires_at,
        "user": user,
        "recovery_key": user.recovery_key,
    }


@router.get("/security-question", response_model=SecurityQuestionResponse)
def get_security_question(
    user: User = Depends(get_current_user),
):
    return {
        "security_question": user.security_question,
        "has_security_question": bool(user.security_question and user.security_answer_hash),
    }


@router.post("/security-question", response_model=MessageResponse)
def update_security_question(
    data: SecurityQuestionUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    question = data.security_question.strip()
    answer_hash = hash_security_answer(data.security_answer)

    user.security_question = question
    user.security_answer_hash = answer_hash
    user.updated_at = datetime.utcnow()

    db.query(User).filter(User.id == user.id).update(
        {
            "security_question": question,
            "security_answer_hash": answer_hash,
            "updated_at": user.updated_at,
        }
    )
    db.commit()

    return {"message": "Đã cập nhật câu hỏi bảo mật thành công"}


@router.get("/recovery-key", response_model=RecoveryKeyResponse)
def get_recovery_key(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.recovery_key:
        user.recovery_key = generate_recovery_key()
        user.recovery_key_hash = hash_recovery_key(user.recovery_key)
        save_recovery_key_file(user.username, user.recovery_key)
        db.query(User).filter(User.id == user.id).update(
            {
                "recovery_key": user.recovery_key,
                "recovery_key_hash": user.recovery_key_hash,
            }
        )
        db.commit()

    return {
        "recovery_key": user.recovery_key,
        "recovery_file_path": str(RECOVERY_KEY_PATH),
    }


@router.post("/recovery-key/regenerate", response_model=RecoveryKeyResponse)
def regenerate_recovery_key(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.recovery_key = generate_recovery_key()
    user.recovery_key_hash = hash_recovery_key(user.recovery_key)
    save_recovery_key_file(user.username, user.recovery_key)

    db.query(User).filter(User.id == user.id).update(
        {
            "recovery_key": user.recovery_key,
            "recovery_key_hash": user.recovery_key_hash,
            "updated_at": datetime.utcnow(),
        }
    )
    db.commit()

    return {
        "recovery_key": user.recovery_key,
        "recovery_file_path": str(RECOVERY_KEY_PATH),
    }
