from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.schemas.token import Token
from app.core.security import hash_password, verify_password, create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    exists = db.query(User).filter((User.email == data.email) | (User.username == data.username)).first()
    if exists:
        raise HTTPException(400, "Пользователь с таким email или именем уже существует")
    user = User(username=data.username, email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
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
def me(current_user: User = Depends(get_current_user)):
    return current_user
