from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[\wа-яА-ЯёЁ-]+$")
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)


class UserLogin(BaseModel):
    email: str  # email или ник — одно поле входа
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    avatar: str | None = None
    role: str = "user"
    badge: str | None = None
    created_at: datetime
