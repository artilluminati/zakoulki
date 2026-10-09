from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.thread import Thread
from app.models.report import Report

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Только для администратора")
    return user


@router.get("/users")
def admin_users(q: str | None = None, limit: int = Query(50, le=200),
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    query = db.query(User).order_by(User.id.desc())
    if q:
        query = query.filter(User.username.ilike(f"%{q}%"))
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role,
             "created_at": u.created_at} for u in query.limit(limit).all()]


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


@router.patch("/users/{user_id}")
def admin_set_role(user_id: int, data: RoleUpdate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    require_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    target.role = data.role
    db.commit()
    return {"id": target.id, "role": target.role}


@router.get("/reports")
def admin_reports(status: str | None = None, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    require_admin(user)
    q = db.query(Report).order_by(Report.id.desc()).limit(100)
    items = q.all()
    if status:
        items = [r for r in items if r.status == status]
    return [{"id": r.id, "reporter_id": r.reporter_id, "thread_id": r.thread_id,
             "comment_id": r.comment_id, "reason": r.reason, "text": r.text,
             "status": r.status} for r in items]


@router.delete("/threads/{thread_id}", status_code=204)
def admin_delete_thread(thread_id: int, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    require_admin(user)
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    db.delete(t)
    db.commit()
