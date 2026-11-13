import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.user import AuthSession, User

PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 210_000
TOKEN_EXPIRE_DAYS = 7


def normalize_username(username: str) -> str:
    return username.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()

    return f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt, expected_digest = stored_hash.split("$", 3)
        iterations = int(iterations_text)
    except ValueError:
        return False

    if algorithm != PASSWORD_ALGORITHM:
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()

    return hmac.compare_digest(actual_digest, expected_digest)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(db: Session, user: User) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=expires_at,
    )

    db.add(session)
    user.last_login_at = datetime.utcnow()
    db.commit()

    return token, expires_at


def get_user_by_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None

    session = (
        db.query(AuthSession)
        .filter(AuthSession.token_hash == hash_token(token))
        .filter(AuthSession.revoked_at.is_(None))
        .first()
    )

    if not session or session.expires_at <= datetime.utcnow():
        return None

    user = session.user

    if not user or not user.is_active:
        return None

    return user


def revoke_token(db: Session, token: str | None) -> bool:
    if not token:
        return False

    session = (
        db.query(AuthSession)
        .filter(AuthSession.token_hash == hash_token(token))
        .filter(AuthSession.revoked_at.is_(None))
        .first()
    )

    if not session:
        return False

    session.revoked_at = datetime.utcnow()
    db.commit()
    return True


def generate_calendar_token() -> str:
    return secrets.token_urlsafe(36)


def ensure_calendar_token(db: Session, user: User) -> str:
    if user.calendar_token:
        return user.calendar_token

    user.calendar_token = generate_calendar_token()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.calendar_token


def regenerate_calendar_token(db: Session, user: User) -> str:
    user.calendar_token = generate_calendar_token()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.calendar_token


def get_user_by_calendar_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None

    return (
        db.query(User)
        .filter(User.calendar_token == token)
        .filter(User.is_active == 1)
        .first()
    )


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token:
        return None

    return token.strip()


RECOVERY_KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_recovery_key() -> str:
    parts = [
        "".join(secrets.choice(RECOVERY_KEY_CHARS) for _ in range(4))
        for _ in range(3)
    ]
    return f"PLA-{'-'.join(parts)}"


def normalize_recovery_key(key: str | None) -> str:
    if not key:
        return ""
    return key.replace("-", "").replace(" ", "").strip().upper()


def hash_recovery_key(key: str) -> str:
    normalized = normalize_recovery_key(key)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def verify_recovery_key(key: str | None, stored_hash: str | None, plain_key: str | None = None) -> bool:
    if not key:
        return False
    normalized_input = normalize_recovery_key(key)
    if not normalized_input:
        return False

    if stored_hash:
        input_hash = hashlib.sha256(normalized_input.encode("utf-8")).hexdigest()
        if hmac.compare_digest(input_hash, stored_hash):
            return True

    if plain_key:
        normalized_plain = normalize_recovery_key(plain_key)
        if hmac.compare_digest(normalized_input, normalized_plain):
            return True

    return False


import unicodedata


def strip_vietnamese_accents(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D")
    return unicodedata.normalize("NFC", text)


def normalize_security_answer(answer: str | None) -> str:
    if not answer:
        return ""
    stripped = strip_vietnamese_accents(answer)
    return " ".join(stripped.strip().lower().split())


def hash_security_answer(answer: str) -> str:
    normalized = normalize_security_answer(answer)
    return hash_password(normalized)


def verify_security_answer(answer: str | None, stored_hash: str | None) -> bool:
    if not answer or not stored_hash:
        return False
    normalized = normalize_security_answer(answer)
    return verify_password(normalized, stored_hash)
