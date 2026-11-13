from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SetupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)
    security_question: str | None = Field(default=None, max_length=200)
    security_answer: str | None = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str | None = None
    created_at: datetime | None = None
    last_login_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AuthStatusResponse(BaseModel):
    has_account: bool
    default_username: str | None = None


class AuthTokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserResponse
    recovery_key: str | None = None


class MessageResponse(BaseModel):
    message: str


class RecoveryInfoResponse(BaseModel):
    username: str
    has_security_question: bool
    security_question: str | None = None
    has_recovery_key: bool


class ResetPasswordRequest(BaseModel):
    username: str
    method: str  # "question" | "key"
    security_answer: str | None = None
    recovery_key: str | None = None
    new_password: str = Field(min_length=6, max_length=128)


class SecurityQuestionUpdateRequest(BaseModel):
    security_question: str = Field(min_length=3, max_length=200)
    security_answer: str = Field(min_length=1, max_length=200)


class SecurityQuestionResponse(BaseModel):
    security_question: str | None = None
    has_security_question: bool


class RecoveryKeyResponse(BaseModel):
    recovery_key: str
    recovery_file_path: str | None = None
