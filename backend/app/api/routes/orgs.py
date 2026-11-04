"""Заявки администраций и организаций на официальный аккаунт.

Публичный поток: организация заполняет форму → заявка попадает в админку.
Аккаунт можно создать прямо в форме или указать уже существующий — тогда
администратор привяжет заявку к нему при проверке.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import get_db
from app.models.org_application import (
    ACCOUNT_EXISTING,
    ACCOUNT_NEW,
    APP_PENDING,
    OrgApplication,
)
from app.models.user import User

router = APIRouter(prefix="/org-applications", tags=["org-applications"])

USERNAME_PATTERN = r"^[\wа-яА-ЯёЁ-]+$"


class OrgApplicationCreate(BaseModel):
    kind: str = Field(default="organization", pattern="^(administration|organization)$")
    org_name: str = Field(min_length=2, max_length=150)
    city: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=2000)

    contact_name: str = Field(min_length=2, max_length=120)
    contact_email: EmailStr
    contact_phone: str | None = Field(default=None, max_length=40)

    account_mode: str = Field(default=ACCOUNT_NEW, pattern="^(new|existing)$")
    # для account_mode="new": аккаунт создаётся сразу, email входа = contact_email
    username: str | None = Field(default=None, min_length=3, max_length=50, pattern=USERNAME_PATTERN)
    password: str | None = Field(default=None, min_length=6, max_length=100)
    # для account_mode="existing": ник или email уже существующего аккаунта
    existing_account: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def check_account(self):
        if self.account_mode == ACCOUNT_NEW:
            if not self.username or not self.password:
                raise ValueError("Укажите ник и пароль — аккаунт создаётся сразу")
        elif not (self.existing_account or "").strip():
            raise ValueError("Укажите ник или email существующего аккаунта")
        return self


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _clean_url(value: str | None) -> str | None:
    """Сайт показываем ссылкой — без схемы добавим https, чтобы не было javascript:."""
    value = _clean(value)
    if not value:
        return None
    if not value.lower().startswith(("http://", "https://")):
        value = "https://" + value
    return value[:255]


@router.post("", status_code=201)
def create_org_application(data: OrgApplicationCreate, db: Session = Depends(get_db)):
    """Публичная форма: заявка на официальный аккаунт."""
    email = str(data.contact_email).strip().lower()

    pending = (
        db.query(OrgApplication)
        .filter(OrgApplication.contact_email == email, OrgApplication.status == APP_PENDING)
        .first()
    )
    if pending:
        raise HTTPException(400, "Заявка с этим email уже на проверке — ответим после рассмотрения")

    user: User | None = None
    if data.account_mode == ACCOUNT_NEW:
        exists = (
            db.query(User)
            .filter((User.email == email) | (User.username == (data.username or "").strip()))
            .first()
        )
        if exists:
            raise HTTPException(400, "Такой email или ник уже занят — войдите в аккаунт или укажите другой")
        user = User(
            username=(data.username or "").strip(),
            email=email,
            password_hash=hash_password(data.password or ""),
        )
        db.add(user)
        db.flush()
    else:
        account = (data.existing_account or "").strip()
        user = (
            db.query(User)
            .filter((User.email == account.lower()) | (User.username == account))
            .first()
        )

    application = OrgApplication(
        kind=data.kind,
        org_name=data.org_name.strip(),
        city=_clean(data.city),
        address=_clean(data.address),
        website=_clean_url(data.website),
        description=_clean(data.description),
        contact_name=data.contact_name.strip(),
        contact_email=email,
        contact_phone=_clean(data.contact_phone),
        account_mode=data.account_mode,
        existing_account=_clean(data.existing_account),
        user_id=user.id if user else None,
        status=APP_PENDING,
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return {
        "ok": True,
        "id": application.id,
        "account_created": data.account_mode == ACCOUNT_NEW,
        "account_found": bool(user) if data.account_mode == ACCOUNT_EXISTING else True,
        "message": "Заявка отправлена — ответим на указанный email",
    }
