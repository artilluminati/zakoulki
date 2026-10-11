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
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "badge": u.badge,
             "created_at": u.created_at} for u in query.limit(limit).all()]


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


class BadgeUpdate(BaseModel):
    badge: str | None = Field(default=None, pattern="^(official)$")


@router.patch("/users/{user_id}/badge")
def admin_set_badge(user_id: int, data: BadgeUpdate, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    require_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    target.badge = data.badge
    db.commit()
    return {"id": target.id, "badge": target.badge}


class PasswordReset(BaseModel):
    password: str = Field(min_length=6, max_length=100)


@router.patch("/users/{user_id}")
def admin_set_role(user_id: int, data: RoleUpdate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    require_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    if target.id == user.id and data.role != "admin":
        raise HTTPException(400, "Нельзя снять роль с себя")
    if data.role != "admin" and target.role == "admin":
        others = db.query(User).filter(User.role == "admin", User.id != target.id).count()
        if others == 0:
            raise HTTPException(400, "Должен остаться хотя бы один администратор")
    target.role = data.role
    db.commit()
    return {"id": target.id, "role": target.role}


@router.patch("/users/{user_id}/password")
def admin_reset_password(user_id: int, data: PasswordReset, db: Session = Depends(get_db),
                         user: User = Depends(get_current_user)):
    from app.core.security import hash_password
    require_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    target.password_hash = hash_password(data.password)
    db.commit()
    return {"id": target.id}


@router.get("/reports")
def admin_reports(status: str | None = Query(None, pattern="^(new|reviewed|rejected)$"),
                  db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    require_admin(user)
    q = db.query(Report).order_by(Report.id.desc())
    if status:
        q = q.filter(Report.status == status)
    items = q.limit(100).all()
    reporter_ids = {r.reporter_id for r in items}
    reporters = {u.id: u.username for u in db.query(User).filter(User.id.in_(reporter_ids)).all()} if reporter_ids else {}
    return [{"id": r.id, "reporter_id": r.reporter_id, "reporter": reporters.get(r.reporter_id),
             "thread_id": r.thread_id,
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


class ReportStatus(BaseModel):
    status: str = Field(pattern="^(reviewed|rejected)$")


@router.patch("/reports/{report_id}")
def admin_report_status(report_id: int, data: ReportStatus, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    require_admin(user)
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "Жалоба не найдена")
    r.status = data.status
    db.commit()
    return {"id": r.id, "status": r.status}


@router.get("/stats")
def admin_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Сводка для шапки админки: пользователи, треды, места, новые жалобы."""
    require_admin(user)
    from app.models.geo_place import GeoPlace
    return {
        "users": db.query(User).count(),
        "threads": db.query(Thread).count(),
        "places": db.query(GeoPlace).count(),
        "reports_new": db.query(Report).filter(Report.status == "new").count(),
    }


@router.get("/threads")
def admin_threads(limit: int = Query(30, le=100), db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    """Свежие треды для модерации: удаление, пин важного."""
    require_admin(user)
    items = db.query(Thread).order_by(Thread.id.desc()).limit(limit).all()
    author_ids = {t.author_id for t in items}
    authors = {u.id: u.username for u in db.query(User).filter(User.id.in_(author_ids)).all()} if author_ids else {}
    return [{"id": t.id, "author": authors.get(t.author_id), "title": t.title,
             "snippet": (t.body_md or "")[:120], "is_offtop": t.is_offtop,
             "is_hub": t.is_hub, "place_id": t.place_id, "comments_count": t.comments_count,
             "created_at": t.created_at} for t in items]
