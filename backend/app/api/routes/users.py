from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.geo_place import GeoPlace
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
    from app.core.security import verify_password

    # смена логина/почты — чувствительные операции: требуем текущий пароль
    sensitive = False
    if data.username is not None and data.username != user.username:
        sensitive = True
    if data.email is not None and str(data.email).lower() != user.email.lower():
        sensitive = True

    if sensitive:
        if not data.current_password or not verify_password(data.current_password, user.password_hash):
            raise HTTPException(400, "Для смены логина или почты введите текущий пароль")
        if data.username is not None and data.username != user.username:
            if db.query(User).filter(User.username == data.username, User.id != user.id).first():
                raise HTTPException(400, "Этот логин уже занят")
            user.username = data.username
        if data.email is not None and str(data.email).lower() != user.email.lower():
            if db.query(User).filter(User.email == data.email, User.id != user.id).first():
                raise HTTPException(400, "Этот email уже зарегистрирован")
            user.email = str(data.email)

    if data.name is not None:
        user.name = data.name.strip() or None
    if data.email_notifications is not None:
        user.email_notifications = data.email_notifications
    if data.theme is not None:
        user.theme = data.theme
    if data.avatar is not None:
        user.avatar = data.avatar
    db.commit()
    db.refresh(user)
    return _user_out(db, user)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(file: UploadFile = File(...), db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    """Загрузка аватарки. Файл сохраняется в app/uploads, имя — в user.avatar."""
    import os, uuid
    from app.core.config import settings
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Нужен файл изображения (jpg/png/webp)")
    data = await file.read()
    if len(data) > 4 * 1024 * 1024:
        raise HTTPException(400, "Файл больше 4 МБ")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    fname = f"avatar_{user.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, fname)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    # удаляем старую аватарку (если была своя)
    if user.avatar and user.avatar.startswith("avatar_"):
        try:
            os.remove(os.path.join(settings.UPLOAD_DIR, user.avatar))
        except OSError:
            pass
    user.avatar = fname
    db.commit()
    db.refresh(user)
    return _user_out(db, user)


@router.delete("/me", status_code=204)
def delete_me(data: UserProfileUpdate, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    """Удаление аккаунта. Требует текущий пароль для подтверждения."""
    from app.core.security import verify_password
    if not data.current_password or not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Введите текущий пароль для подтверждения удаления")

    # не даём удалить последнего администратора
    if user.role == "admin":
        others = db.query(User).filter(User.role == "admin", User.id != user.id).count()
        if others == 0:
            raise HTTPException(400, "Нельзя удалить последнего администратора")

    # отвязываем созданные места
    db.query(GeoPlace).filter(GeoPlace.created_by == user.id).update({"created_by": None})
    db.commit()

    # удаляем пользователя (каскадно удалятся треды, комменты, закладки, лайки, жалобы и т.д.)
    db.delete(user)
    db.commit()


def _user_out(db: Session, user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.badges = [BadgeOut.model_validate(b) for b in badge_service.badges_out(db, user.id)]
    return out
