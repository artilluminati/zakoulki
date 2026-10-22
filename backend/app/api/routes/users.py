from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import BadgeOut, UserOut, UserProfileUpdate
from app.services import badges as badge_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search")
def search_users(q: str = Query(min_length=2, max_length=50), limit: int = Query(10, le=30),
                  db: Session = Depends(get_db)):
    # email не отдаем — поиск публичный, достаточно id+username для @-меню
    return [{"id": u.id, "username": u.username}
            for u in db.query(User).filter(User.username.ilike(f"%{q}%")).limit(limit).all()]


@router.get("/by-username/{username}", response_model=UserOut)
def get_user_by_username(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return _user_out(db, user)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return _user_out(db, user)


@router.patch("/me", response_model=UserOut)
def update_me(data: UserProfileUpdate, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    if data.email_notifications is not None:
        user.email_notifications = data.email_notifications
    if data.avatar is not None:
        user.avatar = data.avatar
    db.commit()
    db.refresh(user)
    return _user_out(db, user)


def _user_out(db: Session, user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.badges = [BadgeOut.model_validate(b) for b in badge_service.badges_out(db, user.id)]
    return out
