from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search")
def search_users(q: str = Query(min_length=2, max_length=50), limit: int = Query(10, le=30),
                  db: Session = Depends(get_db)):
    return [{"id": u.id, "username": u.username, "email": u.email}
            for u in db.query(User).filter(User.username.ilike(f"%{q}%")).limit(limit).all()]


@router.get("/by-username/{username}", response_model=UserOut)
def get_user_by_username(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user
