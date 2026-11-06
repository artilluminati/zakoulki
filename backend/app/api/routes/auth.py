import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.schemas.token import Token
from app.core.security import hash_password, verify_password, create_access_token
from app.api.deps import get_current_user
from app.services import mail_templates
from app.services.mailer import send_email

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TTL_MINUTES = 60


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    exists = db.query(User).filter((User.email == data.email) | (User.username == data.username)).first()
    if exists:
        raise HTTPException(400, "Пользователь с таким email или именем уже существует")
    user = User(username=data.username, name=data.name, email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    from app.services import email_notify
    background.add_task(email_notify.notify_welcome, user)
    return user


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    # вход по email ИЛИ нику через одно поле
    login = data.email.strip()
    user = db.query(User).filter(User.email == login).first()
    if not user:
        user = db.query(User).filter(User.username == login).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(400, "Неверный логин или пароль")
    token = create_access_token(subject=str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.api.routes.users import _user_out
    return _user_out(db, current_user)


class ForgotPassword(BaseModel):
    email: str


class ResetPassword(BaseModel):
    token: str
    password: str


@router.post("/forgot-password")
async def forgot_password(data: ForgotPassword, db: Session = Depends(get_db)):
    """Восстановление пароля. Ответ всегда одинаковый — чтобы нельзя было
    выяснить, зарегистрирован ли email."""
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()
    if user:
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TTL_MINUTES),
        ))
        db.commit()
        subject, html = mail_templates.password_reset(user.username, token)
        await send_email(user.email, subject, html)
    return {"ok": True, "message": "Если такой email зарегистрирован — письмо с ссылкой уже отправлено"}


@router.post("/reset-password")
def reset_password(data: ResetPassword, db: Session = Depends(get_db)):
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token == data.token).first()
    if not row or row.used_at:
        raise HTTPException(400, "Ссылка недействительна — запросите восстановление ещё раз")
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(400, "Срок действия ссылки истёк — запросите восстановление ещё раз")
    if len(data.password) < 6:
        raise HTTPException(400, "Пароль должен быть не короче 6 символов")

    user = db.get(User, row.user_id)
    if not user:
        raise HTTPException(400, "Ссылка недействительна")
    user.password_hash = hash_password(data.password)
    row.used_at = datetime.now(timezone.utc)
    # все прочие ссылки этого пользователя тоже гасим
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
    ).update({"used_at": datetime.now(timezone.utc)})
    db.commit()
    return {"ok": True, "message": "Пароль обновлён — войдите с новым паролем"}
