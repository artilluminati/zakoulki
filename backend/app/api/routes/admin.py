from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.thread import Thread, thread_categories
from app.models.report import Report
from app.models.category import Category
from app.models.geo_place import GeoPlace
from app.models.thread_extra import Tag, ThreadTag
from app.models.donation import Donation
from app.models.org_application import (
    APP_APPROVED,
    APP_PENDING,
    ORG_KINDS,
    OrgApplication,
)
from app.models.recommendation import (
    REC_PUBLISHED,
    REC_REJECTED,
    REC_TOPICS,
    Recommendation,
)
from app.services import badges as badge_service

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
        query = query.filter((User.username.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%")))
    items = query.limit(limit).all()
    badges_map = badge_service.badges_for_users(db, [u.id for u in items])
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "badge": u.badge,
             "badges": badges_map.get(u.id, []),
             "email_notifications": u.email_notifications,
             "created_at": u.created_at} for u in items]


class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(user|admin)$")


class BadgeUpdate(BaseModel):
    badge: str | None = Field(default=None, pattern="^(official)$")


@router.patch("/users/{user_id}/badge")
def admin_set_badge(user_id: int, data: BadgeUpdate, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    """Старый эндпоинт — оставляем рабочим: ставит/снимает официальный бейдж."""
    require_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    if data.badge == "official":
        badge_service.grant_badge(db, target.id, "official", granted_by=user.id)
    else:
        badge = db.query(badge_service.UserBadge).filter(
            badge_service.UserBadge.user_id == target.id,
            badge_service.UserBadge.kind == "official",
        ).first()
        if badge:
            badge_service.remove_badge(db, target.id, badge.id)
    db.commit()
    return {"id": target.id, "badges": badge_service.badges_out(db, target.id)}


class BadgeGrant(BaseModel):
    kind: str = Field(pattern="^(official|sponsor|op)$")
    label: str | None = Field(default=None, max_length=80)
    meta: dict | None = None


@router.get("/users/{user_id}/badges")
def admin_user_badges(user_id: int, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    require_admin(user)
    return badge_service.badges_out(db, user_id)


@router.post("/users/{user_id}/badges", status_code=201)
def admin_grant_badge(user_id: int, data: BadgeGrant, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """Выдать бейдж: официальная организация, автор раздела, спонсор — что угодно."""
    require_admin(user)
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Пользователь не найден")
    badge = badge_service.grant_badge(
        db, target.id, data.kind, granted_by=user.id, label=data.label, meta=data.meta)
    db.commit()
    db.refresh(badge)
    return {"id": badge.id, "kind": badge.kind, "label": badge.label, "meta": badge.meta}


@router.delete("/users/{user_id}/badges/{badge_id}", status_code=204)
def admin_revoke_badge(user_id: int, badge_id: int, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    require_admin(user)
    if not badge_service.remove_badge(db, user_id, badge_id):
        raise HTTPException(404, "Бейдж не найден")
    db.commit()


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
    from app.api.routes.threads import _delete_thread_full
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    _delete_thread_full(db, t)
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
        "donations": db.query(Donation).count(),
        "donations_paid": db.query(Donation).filter(Donation.status == "paid").count(),
        "recommendations_pending": db.query(Recommendation).filter(Recommendation.status == "pending").count(),
        "org_applications_pending": db.query(OrgApplication).filter(OrgApplication.status == APP_PENDING).count(),
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


# --------------------------------------------------------------------------
# CRUD объектов: категории
# --------------------------------------------------------------------------

class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    slug: str | None = Field(default=None, max_length=60, pattern=r"^[a-z0-9-]+$")
    icon: str | None = Field(default=None, max_length=40)


def _slugify(text: str) -> str:
    import re
    slug = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ]+", "-", text.strip().lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)[:60] or "category"


@router.get("/categories")
def admin_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    cats = db.query(Category).order_by(Category.id).all()
    out = []
    for c in cats:
        used = db.query(thread_categories).filter(thread_categories.c.category_id == c.id).count()
        out.append({"id": c.id, "name": c.name, "slug": c.slug, "icon": c.icon,
                    "threads_count": used})
    return out


@router.post("/categories", status_code=201)
def admin_create_category(data: CategoryIn, db: Session = Depends(get_db),
                          user: User = Depends(get_current_user)):
    require_admin(user)
    slug = data.slug or _slugify(data.name)
    if db.query(Category).filter(Category.slug == slug).first():
        raise HTTPException(400, "Категория с таким адресом уже есть")
    cat = Category(name=data.name, slug=slug, icon=data.icon)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "slug": cat.slug, "icon": cat.icon}


@router.patch("/categories/{category_id}")
def admin_update_category(category_id: int, data: CategoryIn, db: Session = Depends(get_db),
                           user: User = Depends(get_current_user)):
    require_admin(user)
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "Категория не найдена")
    if data.slug and data.slug != cat.slug:
        if db.query(Category).filter(Category.slug == data.slug, Category.id != category_id).first():
            raise HTTPException(400, "Категория с таким адресом уже есть")
        cat.slug = data.slug
    cat.name = data.name
    if data.icon is not None:
        cat.icon = data.icon
    db.commit()
    return {"id": cat.id, "name": cat.name, "slug": cat.slug, "icon": cat.icon}


@router.delete("/categories/{category_id}", status_code=204)
def admin_delete_category(category_id: int, db: Session = Depends(get_db),
                          user: User = Depends(get_current_user)):
    require_admin(user)
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "Категория не найдена")
    used = db.query(thread_categories).filter(thread_categories.c.category_id == category_id).count()
    if used:
        raise HTTPException(400, f"Нельзя удалить: категория используется в {used} тредах")
    db.delete(cat)
    db.commit()


# --------------------------------------------------------------------------
# CRUD объектов: разделы (хабы) и места
# --------------------------------------------------------------------------

class HubIn(BaseModel):
    title: str | None = Field(default=None, max_length=150)
    body_md: str | None = Field(default=None, max_length=5000)
    is_archived: bool | None = None


@router.get("/hubs")
def admin_hubs(limit: int = Query(100, le=300), db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    require_admin(user)
    items = (db.query(Thread).filter(Thread.is_hub == True, Thread.is_hub_talk == False)
             .order_by(Thread.id.desc()).limit(limit).all())
    authors = {u.id: u.username for u in db.query(User).filter(
        User.id.in_({t.author_id for t in items})).all()} if items else {}
    return [{"id": t.id, "title": t.title, "author": authors.get(t.author_id),
             "body_md": t.body_md, "body_html": t.body_html,
             "city": t.city, "district": t.district, "region": t.region,
             "is_archived": t.is_archived, "comments_count": t.comments_count,
             "created_at": t.created_at} for t in items]


@router.patch("/hubs/{hub_id}")
def admin_update_hub(hub_id: int, data: HubIn, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    require_admin(user)
    hub = db.get(Thread, hub_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    if data.title is not None:
        hub.title = data.title
    if data.body_md is not None:
        from app.services.markdown import render_markdown
        html, _ = render_markdown(data.body_md)
        hub.body_md = data.body_md
        hub.body_html = html
    if data.is_archived is not None:
        hub.is_archived = data.is_archived
    db.commit()
    return {"id": hub.id, "title": hub.title, "is_archived": hub.is_archived}


class PlaceIn(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=200)
    district: str | None = Field(default=None, max_length=200)
    region: str | None = Field(default=None, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    area: list[list[float]] | None = None  # полигон [[lat,lng],...]


@router.get("/places")
def admin_places(q: str | None = None, limit: int = Query(50, le=200),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    query = db.query(GeoPlace).order_by(GeoPlace.id.desc())
    if q:
        query = query.filter((GeoPlace.name.ilike(f"%{q}%")) | (GeoPlace.address.ilike(f"%{q}%")))
    items = query.limit(limit).all()
    return [{"id": p.id, "name": p.name, "address": p.address, "city": p.city,
             "district": p.district, "region": p.region,
             "latitude": p.latitude, "longitude": p.longitude,
             "created_at": p.created_at} for p in items]


@router.patch("/places/{place_id}")
def admin_update_place(place_id: int, data: PlaceIn, background: BackgroundTasks,
                       db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    place = db.get(GeoPlace, place_id)
    if not place:
        raise HTTPException(404, "Место не найдено")

    coords_changed = (data.latitude is not None and abs(data.latitude - place.latitude) > 1e-9) or \
                     (data.longitude is not None and abs(data.longitude - place.longitude) > 1e-9) or \
                     (data.area is not None)

    # явные поля — перезаписываем
    for field in ("name", "address", "city", "district", "region"):
        value = getattr(data, field)
        if value is not None:
            setattr(place, field, value)

    if data.latitude is not None:
        place.latitude = data.latitude
    if data.longitude is not None:
        place.longitude = data.longitude
    if data.area is not None:
        import json as _json
        place.area_json = _json.dumps(data.area) if len(data.area) >= 3 else place.area_json

    # если координаты поменялись — подтягиваем город/район/регион/адрес из реверс-геокодера,
    # если они не переданы явно, и обновляем название, если оно было автосгенерировано
    if coords_changed:
        try:
            from app.services import citydata as _cd
            r = _cd.nominatim_reverse(float(place.latitude), float(place.longitude))
            if r:
                if data.city is None and r.get("city"):
                    place.city = r.get("city")
                if data.district is None and r.get("district"):
                    place.district = r.get("district")
                if data.region is None and r.get("region"):
                    place.region = r.get("region")
                if data.address is None and r.get("address"):
                    place.address = r.get("address")
                # автосгенерированное имя «Точка на карте» обновляем на новый адрес
                if data.name is None and place.name in ("Точка на карте", "Точка"):
                    if r.get("name"):
                        place.name = r.get("name")
        except Exception:
            pass

        # перегенерация превью — фоном, чтобы ответ не тормозил
        try:
            from app.services.mapshot import render_preview, preview_name
            import os as _os
            import json as _json2
            area = None
            try:
                area = _json2.loads(place.area_json) if place.area_json else None
            except Exception:
                area = None
            background.add_task(
                render_preview, place.latitude, place.longitude,
                _os.path.join(__import__("app.core.config", fromlist=["settings"]).settings.UPLOAD_DIR,
                              preview_name(place.id)),
                area,
            )
        except Exception:
            pass

    db.commit()
    db.refresh(place)
    return {"id": place.id, "name": place.name, "address": place.address,
            "city": place.city, "district": place.district, "region": place.region,
            "latitude": place.latitude, "longitude": place.longitude}


# --------------------------------------------------------------------------
# Теги
# --------------------------------------------------------------------------

class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)


@router.get("/tags")
def admin_tags(q: str | None = Query(None), limit: int = Query(100, le=500),
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    query = db.query(Tag).order_by(Tag.count.desc(), Tag.name)
    if q:
        query = query.filter(Tag.name.ilike(f"%{q}%"))
    items = query.limit(limit).all()
    out = []
    for t in items:
        used = db.query(ThreadTag).filter(ThreadTag.tag_id == t.id).count()
        out.append({"id": t.id, "name": t.name, "slug": t.slug, "count": t.count or 0,
                    "threads_count": used})
    return out


@router.patch("/tags/{tag_id}")
def admin_rename_tag(tag_id: int, data: TagIn, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    require_admin(user)
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Тег не найден")
    new_name = data.name.strip().lstrip("#")
    if not new_name:
        raise HTTPException(400, "Пустое имя")
    if db.query(Tag).filter(Tag.name == new_name, Tag.id != tag_id).first():
        raise HTTPException(400, "Тег с таким именем уже есть")
    tag.name = new_name
    tag.slug = new_name.lower().replace(" ", "-")
    db.commit()
    return {"id": tag.id, "name": tag.name, "slug": tag.slug}


@router.delete("/tags/{tag_id}", status_code=204)
def admin_delete_tag(tag_id: int, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    require_admin(user)
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Тег не найден")
    db.query(ThreadTag).filter(ThreadTag.tag_id == tag_id).delete()
    db.delete(tag)
    db.commit()


@router.delete("/places/{place_id}", status_code=204)
def admin_delete_place(place_id: int, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    require_admin(user)
    place = db.get(GeoPlace, place_id)
    if not place:
        raise HTTPException(404, "Место не найдено")
    db.delete(place)
    db.commit()


# --------------------------------------------------------------------------
# Донаты и рекомендации
# --------------------------------------------------------------------------

@router.get("/donations")
def admin_donations(status: str | None = Query(None, pattern="^(pending|paid|failed|refunded)$"),
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    q = db.query(Donation).order_by(Donation.id.desc())
    if status:
        q = q.filter(Donation.status == status)
    items = q.limit(200).all()
    return [{
        "id": d.id, "amount": d.amount, "purpose": d.purpose, "status": d.status,
        "message": d.message, "donor_name": d.donor_name, "donor_email": d.donor_email,
        "user_id": d.user_id, "badge_granted": d.badge_granted,
        "recommendation_id": d.recommendation_id,
        "provider_payment_id": d.provider_payment_id,
        "created_at": d.created_at, "paid_at": d.paid_at,
    } for d in items]


class RecommendationStatus(BaseModel):
    status: str = Field(pattern="^(published|rejected)$")
    topic: str | None = Field(default=None, pattern="^(zhkh|repair|law|transport|other)$")


@router.get("/recommendations")
def admin_recommendations(status: str | None = Query(None),
                          db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    q = db.query(Recommendation).order_by(Recommendation.id.desc())
    if status:
        q = q.filter(Recommendation.status == status)
    items = q.limit(200).all()
    return [{
        "id": r.id, "title": r.title, "description": r.description, "contact": r.contact,
        "url": r.url, "topic": r.topic, "topic_label": REC_TOPICS.get(r.topic, r.topic),
        "status": r.status, "user_id": r.user_id, "donation_id": r.donation_id,
        "created_at": r.created_at, "published_at": r.published_at,
    } for r in items]


@router.patch("/recommendations/{rec_id}")
def admin_recommendation_status(rec_id: int, data: RecommendationStatus, db: Session = Depends(get_db),
                                user: User = Depends(get_current_user)):
    """Публикация или отклонение рекомендации (после оплаты доната)."""
    require_admin(user)
    from datetime import datetime, timezone, timedelta
    rec = db.get(Recommendation, rec_id)
    if not rec:
        raise HTTPException(404, "Рекомендация не найдена")
    rec.status = REC_PUBLISHED if data.status == "published" else REC_REJECTED
    if data.topic:
        rec.topic = data.topic
    if rec.status == REC_PUBLISHED:
        rec.published_at = datetime.now(timezone.utc)
        rec.expires_at = rec.published_at + timedelta(days=90)
    db.commit()
    return {"id": rec.id, "status": rec.status, "topic": rec.topic}


# --------------------------------------------------------------------------
# Заявки администраций и организаций на официальный аккаунт
# --------------------------------------------------------------------------

class OrgApplicationStatus(BaseModel):
    status: str = Field(pattern="^(pending|approved|rejected)$")
    admin_note: str | None = Field(default=None, max_length=2000)


def _org_application_out(a: OrgApplication, username: str | None) -> dict:
    return {
        "id": a.id,
        "kind": a.kind,
        "kind_label": ORG_KINDS.get(a.kind, a.kind),
        "org_name": a.org_name,
        "city": a.city,
        "address": a.address,
        "website": a.website,
        "description": a.description,
        "contact_name": a.contact_name,
        "contact_email": a.contact_email,
        "contact_phone": a.contact_phone,
        "account_mode": a.account_mode,
        "existing_account": a.existing_account,
        "user_id": a.user_id,
        "username": username,
        "status": a.status,
        "admin_note": a.admin_note,
        "created_at": a.created_at,
        "reviewed_at": a.reviewed_at,
    }


@router.get("/org-applications")
def admin_org_applications(status: str | None = Query(None),
                           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_admin(user)
    q = db.query(OrgApplication).order_by(OrgApplication.id.desc())
    if status:
        q = q.filter(OrgApplication.status == status)
    items = q.limit(200).all()
    user_ids = {a.user_id for a in items if a.user_id}
    users = {u.id: u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return [_org_application_out(a, users.get(a.user_id or 0)) for a in items]


@router.patch("/org-applications/{app_id}")
def admin_org_application_status(app_id: int, data: OrgApplicationStatus,
                                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Одобрение выдаёт бейдж «Официальная организация» привязанному аккаунту."""
    require_admin(user)
    from datetime import datetime, timezone
    app_row = db.get(OrgApplication, app_id)
    if not app_row:
        raise HTTPException(404, "Заявка не найдена")

    target: User | None = None
    if data.status == APP_APPROVED:
        if app_row.user_id:
            target = db.get(User, app_row.user_id)
        if not target and app_row.existing_account:
            account = app_row.existing_account.strip()
            target = db.query(User).filter(
                (User.email == account.lower()) | (User.username == account)
            ).first()
        if not target and app_row.contact_email:
            target = db.query(User).filter(User.email == app_row.contact_email).first()
        if not target:
            raise HTTPException(
                400,
                "Не нашёл аккаунт заявителя. Укажите ник или email существующего аккаунта в заявке и повторите",
            )
        app_row.user_id = target.id
        badge_service.grant_badge(db, target.id, "official", granted_by=user.id)

    app_row.status = data.status
    app_row.admin_note = (data.admin_note or "").strip() or None
    app_row.reviewed_at = datetime.now(timezone.utc) if data.status != APP_PENDING else None
    db.commit()
    db.refresh(app_row)
    return _org_application_out(app_row, target.username if target else None)
