from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.app_setting import AppSetting
from app.schemas.app_setting import (
    AppSettingCreate,
    AppSettingResponse,
    AppSettingUpdate,
)

router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)


DEFAULT_SETTINGS = [
    {
        "key": "app_name",
        "value": "Personal Life App",
        "note": "Tên ứng dụng",
    },
    {
        "key": "owner_name",
        "value": "Bảo",
        "note": "Tên người dùng chính",
    },
    {
        "key": "currency",
        "value": "VND",
        "note": "Đơn vị tiền tệ mặc định",
    },
    {
        "key": "monthly_budget",
        "value": "0",
        "note": "Ngân sách tháng mặc định",
    },
    {
        "key": "deadline_reminder_days",
        "value": "1,3,7",
        "note": "Các mốc ngày nhắc deadline",
    },
    {
        "key": "privacy_mode",
        "value": "off",
        "note": "Chế độ riêng tư: on/off",
    },
]

SENSITIVE_SETTING_KEYS = {"gemini_api_key"}


def mask_setting(setting: AppSetting) -> AppSettingResponse:
    payload = AppSettingResponse.model_validate(setting)

    if payload.key in SENSITIVE_SETTING_KEYS and payload.value:
        return payload.model_copy(update={"value": "••••••••"})

    return payload


@router.post("/init", response_model=list[AppSettingResponse])
def init_default_settings(db: Session = Depends(get_db)):
    created_or_existing = []

    for setting in DEFAULT_SETTINGS:
        existing = db.query(AppSetting).filter(
            AppSetting.key == setting["key"]
        ).first()

        if existing:
            created_or_existing.append(existing)
            continue

        new_setting = AppSetting(**setting)
        db.add(new_setting)
        db.commit()
        db.refresh(new_setting)

        created_or_existing.append(new_setting)

    return created_or_existing


@router.get("/", response_model=list[AppSettingResponse])
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(AppSetting).order_by(AppSetting.key.asc()).all()
    return [mask_setting(setting) for setting in settings]


@router.get("/{key}", response_model=AppSettingResponse)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()

    if not setting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cài đặt")

    return mask_setting(setting)


@router.post("/", response_model=AppSettingResponse)
def create_setting(
    setting_data: AppSettingCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(AppSetting).filter(
        AppSetting.key == setting_data.key
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Key cài đặt đã tồn tại")

    setting = AppSetting(**setting_data.model_dump())

    db.add(setting)
    db.commit()
    db.refresh(setting)

    return mask_setting(setting)


@router.put("/{key}", response_model=AppSettingResponse)
def update_setting(
    key: str,
    setting_data: AppSettingUpdate,
    db: Session = Depends(get_db),
):
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()

    if not setting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cài đặt")

    update_data = setting_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(setting, field, value)

    db.commit()
    db.refresh(setting)

    return mask_setting(setting)


@router.delete("/{key}")
def delete_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()

    if not setting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cài đặt")

    db.delete(setting)
    db.commit()

    return {"message": "Đã xóa cài đặt thành công"}
