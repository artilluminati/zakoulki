from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[\wа-яА-ЯёЁ-]+$")
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


class UserLogin(BaseModel):
    email: str  # email или ник — одно поле входа
    password: str


class BadgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    label: str | None = None
    meta: dict = Field(default_factory=dict)
    created_at: datetime


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    avatar: str | None = None
    role: str = "user"
    badge: str | None = None          # legacy: официальная организация
    badges: list[BadgeOut] = Field(default_factory=list)
    email_notifications: bool = True
    created_at: datetime


class UserProfileUpdate(BaseModel):
    email_notifications: bool | None = None
    avatar: str | None = Field(default=None, max_length=255)
