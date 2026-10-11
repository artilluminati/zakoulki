from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
import os
import uuid
from PIL import Image

from app.db.session import get_db
from app.api.deps import get_current_user, get_optional_user
from app.core.config import settings
from app.models.user import User
from app.models.thread import Thread
from app.models.thread_comment import ThreadComment
from app.models.thread_extra import Tag, ThreadTag, ThreadMention, ThreadLike
from app.models.thread_photo import ThreadPhoto
from app.models.report import Report
from app.models.geo_place import GeoPlace
from app.models.category import Category
from app.services.markdown import render_markdown

router = APIRouter(prefix="/threads", tags=["threads-v5"])


class ThreadCreate(BaseModel):
    body_md: str = Field(min_length=0, max_length=5000)
    title: str | None = Field(default=None, max_length=150)  # Q3: опционально
    place_id: int | None = None
    category_ids: list[int] = []
    tags: list[str] = Field(default=[], max_length=5, description="явные теги из TagPicker")
    poll: dict | None = Field(default=None, description="{question, options[], multiple?}")
    city: str | None = Field(default=None, max_length=200, description="город из scope (для оффтопа)")
    district: str | None = Field(default=None, max_length=200, description="район из scope (для оффтопа)")
    region: str | None = Field(default=None, max_length=200)
    country: str | None = Field(default=None, max_length=100)


class CommentCreate(BaseModel):
    body_md: str = Field(min_length=0, max_length=2000)
    parent_id: int | None = None


def _place_out(p) -> dict:
    import os as _os
    import json as _json
    from app.core.config import settings as _settings
    from app.services.mapshot import preview_name as _pv
    _map_pv = _pv(p.id)
    has_map = _os.path.exists(_os.path.join(_settings.UPLOAD_DIR, _map_pv))
    try:
        area = _json.loads(p.area_json) if p.area_json else None
    except Exception:
        area = None
    return {"id": p.id, "name": p.name, "address": p.address,
            "district": p.district, "lat": p.latitude, "lng": p.longitude,
            "preview_url": p.preview_url,
            "city": p.city, "region": p.region, "country": p.country,
            "area": area,
            "map_preview": f"/uploads/{_map_pv}" if has_map else None}


def _thread_out(t: Thread, db: Session, user_id: int | None = None) -> dict:
    from app.models.thread_photo import ThreadPhoto
    photos = db.query(ThreadPhoto).filter(ThreadPhoto.thread_id == t.id, ThreadPhoto.comment_id.is_(None)).all()
    cats = [{"id": c.id, "name": c.name, "slug": c.slug} for c in (t.categories or [])]
    tag_rows = (db.query(Tag).join(ThreadTag, ThreadTag.tag_id == Tag.id)
                .filter(ThreadTag.thread_id == t.id).all())
    author = db.get(User, t.author_id)
    return {
        "id": t.id, "author_id": t.author_id,
        "author_username": author.username if author else None,
        "author_badge": author.badge if author else None,
        "title": t.title,
        "body_md": t.body_md, "body_html": t.body_html,
        "categories": cats,
        "tags": [tg.name for tg in tag_rows],
        "photos": [{"id": p.id, **_photo_urls(p.file_name)} for p in photos],
        "is_offtop": t.is_offtop,
        "place": _place_out(t.place) if t.place else None,
        "views": t.views, "likes_count": t.likes_count, "comments_count": t.comments_count,
        "created_at": t.created_at,
        "city": t.city, "district": t.district, "region": t.region, "country": t.country,
        "poll": _poll_out(db, t.id, user_id),
        "hub_requested": t.hub_requested,
        "hub_votes": t.hub_votes,
        "hub_voted": _hub_voted(db, t.id, user_id),
        "is_hub": t.is_hub,
        "is_hub_talk": t.is_hub_talk,
        "hub_id": t.hub_id,
        "hub": _hub_brief(db, t.hub_id) if t.hub_id else None,
        "talk_id": _hub_talk_id(db, t.id) if t.is_hub else None,
        "attached_count": _attached_count(db, t.id) if t.is_hub else 0,
        "moderators": _hub_moderators(db, t.id) if t.is_hub else [],
    }


def _hub_brief(db: Session, hub_id: int) -> dict | None:
    h = db.get(Thread, hub_id)
    if not h or not h.is_hub:
        return None
    return {"id": h.id, "title": h.title or "Раздел", "author_id": h.author_id}


def _hub_moderators(db: Session, hub_id: int) -> list[dict]:
    from app.models.hub_moderator import HubModerator
    rows = db.query(HubModerator).filter(HubModerator.hub_id == hub_id).all()
    out = []
    for m in rows:
        u = db.get(User, m.user_id)
        if u:
            out.append({"id": u.id, "username": u.username})
    return out


def _can_moderate_hub(db: Session, hub: Thread, user: User) -> bool:
    """Автор раздела, его модераторы или админ сайта."""
    if user.role == "admin" or hub.author_id == user.id:
        return True
    from app.models.hub_moderator import HubModerator
    return db.get(HubModerator, {"user_id": user.id, "hub_id": hub.id}) is not None


def _hub_talk_id(db: Session, hub_id: int) -> int | None:
    talk = (db.query(Thread).filter(Thread.hub_id == hub_id, Thread.is_hub_talk)
            .order_by(Thread.id).first())
    return talk.id if talk else None


def _attached_count(db: Session, hub_id: int) -> int:
    return (db.query(Thread).filter(Thread.hub_id == hub_id, Thread.is_hub_talk == False).count())


def _attach_tags(db: Session, thread_id: int, explicit: list[str], auto: list[str]) -> None:
    """Пересбор тегов треда: удаляет старые связи, вешает новые, пересчитывает счетчики."""
    import re as _re
    old = db.query(ThreadTag).filter(ThreadTag.thread_id == thread_id).all()
    affected = {tt.tag_id for tt in old}
    for tt in old:
        db.delete(tt)
    db.flush()
    seen: set[str] = set()

    def attach(name: str, is_auto: bool) -> None:
        name = name.strip().lower()
        if not name or name in seen:
            return
        if not _re.fullmatch(r"[а-яА-ЯёЁa-zA-Z0-9_]{2,50}", name):
            return
        seen.add(name)
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name, slug=name); db.add(tag); db.flush()
        db.add(ThreadTag(thread_id=thread_id, tag_id=tag.id, auto=is_auto))
        affected.add(tag.id)

    for name in (explicit or [])[:5]:
        attach(name, False)
    for name in (auto or [])[:5]:
        attach(name, True)
    for tid in affected:
        left = db.query(ThreadTag).filter(ThreadTag.tag_id == tid).count()
        tag = db.get(Tag, tid)
        if tag:
            tag.count = left


def _resolve_user_ids(db: Session, ids: list[int], names: list[str]) -> list[int]:
    out = list(ids or [])
    for uname in names or []:
        u = db.query(User).filter(User.username == uname).first()
        if not u:
            u = db.query(User).filter(User.username.ilike(uname)).first()
        if u and u.id not in out:
            out.append(u.id)
    return out


@router.get("/notifications/mine")
def my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user), limit: int = 20):
    """Колокольчик: упоминания меня + ответы в моих тредах (с автором, временем и фрагментом)."""
    import re
    def clean(raw: str) -> str:
        s = re.sub(r"@\[(\d+):([^\]]+)\]", r"@\2", raw)
        s = re.sub(r"\+\[(\d+):([^\]]+)\]", r"\2", s)
        return s[:80]
    out = []
    # упоминания меня в тредах
    mentions = (db.query(ThreadMention, Thread, ThreadComment)
                .outerjoin(Thread, ThreadMention.thread_id == Thread.id)
                .outerjoin(ThreadComment, ThreadMention.comment_id == ThreadComment.id)
                .filter(ThreadMention.kind == "user", ThreadMention.user_id == user.id)
                .order_by(ThreadMention.id.desc()).limit(limit).all())
    for m, t, c in mentions:
        author_id = c.author_id if c else t.author_id
        author = db.get(User, author_id)
        out.append({
            "id": f"m{m.id}",
            "kind": "mention",
            "author": author.username if author else "кто-то",
            "author_id": author_id,
            "thread_id": t.id if t else None,
            "comment_id": m.comment_id,
            "title": t.title if t else None,
            "snippet": clean(c.body_md) if c else (clean(t.body_md) if t else ""),
            "created_at": m.created_at.isoformat() if hasattr(m.created_at, 'isoformat') else str(m.created_at),
        })
    # ответы в моих тредах
    replies = (db.query(ThreadComment, Thread, User)
               .join(Thread, ThreadComment.thread_id == Thread.id)
               .join(User, ThreadComment.author_id == User.id)
               .filter(Thread.author_id == user.id, ThreadComment.author_id != user.id)
               .order_by(ThreadComment.id.desc()).limit(limit).all())
    for c, t, u in replies:
        out.append({
            "id": f"r{c.id}",
            "kind": "reply",
            "author": u.username,
            "author_id": u.id,
            "thread_id": t.id,
            "comment_id": c.id,
            "title": t.title,
            "snippet": clean(c.body_md),
            "created_at": c.created_at.isoformat() if hasattr(c.created_at, 'isoformat') else str(c.created_at),
        })
    # сортируем по времени (новые сверху)
    out.sort(key=lambda x: x["created_at"], reverse=True)
    return out[:limit]


@router.get("")
def list_threads(
    search: str | None = Query(None),
    tag: str | None = Query(None, description="имя тега без #"),
    author_id: int | None = Query(None),
    category_id: int | None = Query(None),
    place_id: int | None = Query(None),
    has_geo: bool | None = Query(None),
    is_hub: bool | None = Query(None, description="только разделы"),
    is_offtop: bool | None = Query(None),
    district: str | None = Query(None, description="район"),
    city: str | None = Query(None, description="город/округ"),
    region: str | None = Query(None, description="область/регион"),
    country: str | None = Query(None, description="страна"),
    geo_any: list[str] | None = Query(None, description="город ИЛИ область: несколько значений через OR"),
    sort: str = Query("new", pattern="^(new|top|near)$"),
    lat: float | None = None, lng: float | None = None, radius: float | None = Query(None, description="км"),
    before_id: int | None = None, limit: int = Query(20, ge=1, le=50),
    after_id: int | None = Query(None, description="только треды новее id — для лёгкого поллинга ленты"),
    db: Session = Depends(get_db),
):
    q = db.query(Thread).options(joinedload(Thread.place)).order_by(Thread.id.desc())
    if district or city or region or country or geo_any:
        # место треда ИЛИ его собственная привязка (оффтоп)
        from sqlalchemy import or_ as _loc_or
        q = q.outerjoin(GeoPlace, Thread.place_id == GeoPlace.id)
        if geo_any:
            vals = [v for v in geo_any if v]
            q = q.filter(_loc_or(
                GeoPlace.city.in_(vals), GeoPlace.district.in_(vals), GeoPlace.region.in_(vals),
                Thread.city.in_(vals), Thread.district.in_(vals), Thread.region.in_(vals),
            ))
        if district:
            q = q.filter(_loc_or(GeoPlace.district == district, Thread.district == district))
        if city:
            q = q.filter(_loc_or(GeoPlace.city == city, Thread.city == city))
        if region:
            q = q.filter(_loc_or(GeoPlace.region == region, Thread.region == region))
        if country:
            q = q.filter(_loc_or(GeoPlace.country == country, Thread.country == country))
    if before_id:
        q = q.filter(Thread.id < before_id)
    if after_id:
        q = q.filter(Thread.id > after_id)
    if author_id:
        q = q.filter(Thread.author_id == author_id)
    if place_id:
        q = q.filter(Thread.place_id == place_id)
    if search:
        q = q.filter(Thread.body_md.ilike(f"%{search}%"))
    if tag:
        q = q.join(ThreadTag, ThreadTag.thread_id == Thread.id).join(Tag, ThreadTag.tag_id == Tag.id).filter(Tag.name == tag.lower())
    if category_id:
        from app.models.thread import thread_categories
        q = q.join(thread_categories, thread_categories.c.thread_id == Thread.id).filter(thread_categories.c.category_id == category_id)
    if has_geo is True:
        # вопросы с точкой
        q = q.filter(Thread.place_id.isnot(None))
    if has_geo is False:
        q = q.filter(Thread.place_id.is_(None))
    if is_hub is not None:
        q = q.filter(Thread.is_hub == is_hub)
    if is_offtop is not None:
        q = q.filter(Thread.is_offtop == is_offtop)
    if sort == "near" and lat is not None and lng is not None and radius:
        delta = radius / 111.0
        q = q.join(GeoPlace, Thread.place_id == GeoPlace.id)
        q = q.filter(GeoPlace.latitude.between(lat - delta, lat + delta))
        q = q.filter(GeoPlace.longitude.between(lng - delta, lng + delta))
    if sort == "top":
        q = q.order_by(Thread.likes_count.desc(), Thread.id.desc())
    q = q.distinct()
    items = q.limit(limit).all()
    return [_thread_out(t, db) for t in items]


@router.post("", status_code=201)
def create_thread(data: ThreadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if data.place_id is not None and not db.get(GeoPlace, data.place_id):
        raise HTTPException(404, "Место не найдено")
    html, entities = render_markdown(data.body_md)
    # вопрос = есть основная точка ИЛИ упоминание места в тексте
    is_offtop = data.place_id is None and not entities["place_ids"]
    if len(data.body_md) > 280 and data.place_id is None and not entities["place_ids"]:
        # длинный без точки — все равно вопрос, не оффтоп
        is_offtop = False
    t = Thread(author_id=user.id, title=data.title, body_md=data.body_md, body_html=html,
               is_offtop=is_offtop, place_id=data.place_id,
               city=data.city, district=data.district, region=data.region, country=data.country)
    db.add(t); db.flush()
    _attach_tags(db, t.id, data.tags or [], entities["tags"][:5])
    # упоминания мест из текста
    for pid in entities["place_ids"]:
        db.add(ThreadMention(thread_id=t.id, kind="place", place_id=pid))
    for uid in _resolve_user_ids(db, entities["user_ids"], entities.get("usernames", [])):
        db.add(ThreadMention(thread_id=t.id, kind="user", user_id=uid))
    if data.category_ids:
        t.categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()
    if data.poll:
        from app.models.poll import Poll, PollOption
        q = str(data.poll.get("question", ""))[:300].strip()
        opts = [str(o)[:150].strip() for o in (data.poll.get("options") or [])][:10]
        opts = [o for o in opts if o]
        if q and len(opts) >= 2:
            poll = Poll(thread_id=t.id, question=q, multiple=bool(data.poll.get("multiple", False)))
            db.add(poll); db.flush()
            for i, text in enumerate(opts):
                db.add(PollOption(poll_id=poll.id, position=i, text=text))
    db.commit(); db.refresh(t)
    return _thread_out(t, db)


HUB_THRESHOLD = 3


def _hub_voted(db: Session, thread_id: int, user_id: int | None) -> bool:
    if not user_id:
        return False
    from app.models.hub_vote import HubVote
    return db.get(HubVote, {"user_id": user_id, "thread_id": thread_id}) is not None


def _poll_out(db: Session, thread_id: int, user_id: int | None) -> dict | None:
    from app.models.poll import Poll, PollOption, PollVote
    poll = db.query(Poll).filter(Poll.thread_id == thread_id).first()
    if not poll:
        return None
    voted: list[int] = []
    if user_id:
        voted = [v.option_id for v in db.query(PollVote).join(PollOption, PollVote.option_id == PollOption.id)
                 .filter(PollOption.poll_id == poll.id, PollVote.user_id == user_id).all()]
    return {
        "id": poll.id, "question": poll.question, "multiple": poll.multiple,
        "total": sum(o.votes for o in poll.options),
        "voted": voted,
        "options": [{"id": o.id, "text": o.text, "votes": o.votes} for o in poll.options],
    }


@router.get("/{thread_id}")
def get_thread(thread_id: int, db: Session = Depends(get_db),
               user: User | None = Depends(get_optional_user)):
    t = db.query(Thread).options(joinedload(Thread.place)).filter(Thread.id == thread_id).first()
    if not t:
        raise HTTPException(404, "Тред не найден")
    t.views += 1; db.commit()
    out = _thread_out(t, db, user.id if user else None)
    comments = db.query(ThreadComment).filter(ThreadComment.thread_id == thread_id).order_by(ThreadComment.id).all()
    out["comments"] = [{
        "id": c.id, "parent_id": c.parent_id, "author_id": c.author_id,
        "author_username": (db.get(User, c.author_id).username if db.get(User, c.author_id) else None),
        "author_badge": (db.get(User, c.author_id).badge if db.get(User, c.author_id) else None),
        "body_md": c.body_md, "body_html": c.body_html, "created_at": c.created_at,
        "photos": [{"id": p.id, **_photo_urls(p.file_name)}
                   for p in db.query(ThreadPhoto).filter(ThreadPhoto.comment_id == c.id).all()],
    } for c in comments]
    return out


@router.post("/{thread_id}/comments", status_code=201)
def add_comment(thread_id: int, data: CommentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.is_hub and not t.is_hub_talk:
        talk_id = _hub_talk_id(db, t.id)
        raise HTTPException(400, f"Раздел не обсуждают здесь — общее обсуждение в треде #{talk_id}" if talk_id else "Раздел не обсуждают здесь")
    html, entities = render_markdown(data.body_md, comments_mode=True)
    c = ThreadComment(thread_id=thread_id, parent_id=data.parent_id, author_id=user.id,
                      body_md=data.body_md, body_html=html)
    db.add(c); db.flush()
    for pid in entities["place_ids"]:
        db.add(ThreadMention(comment_id=c.id, kind="place", place_id=pid))
    for uid in _resolve_user_ids(db, entities["user_ids"], entities.get("usernames", [])):
        db.add(ThreadMention(comment_id=c.id, kind="user", user_id=uid))
    t.comments_count += 1
    db.commit(); db.refresh(c)
    return {"id": c.id, "body_html": c.body_html}


class ThreadUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=150)
    body_md: str | None = Field(default=None, min_length=1, max_length=5000)
    tags: list[str] | None = None
    place_id: int | None = Field(default=None, description="смена точки/территории (копия места создаётся фронтом)")


@router.patch("/{thread_id}")
def update_thread(thread_id: int, data: ThreadUpdate, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.author_id != user.id and user.role != "admin":
        raise HTTPException(403, "Недостаточно прав")
    if data.title is not None:
        t.title = data.title or None
    if data.place_id is not None:
        if data.place_id == 0:
            t.place_id = None
        else:
            if not db.get(GeoPlace, data.place_id):
                raise HTTPException(404, "Место не найдено")
            t.place_id = data.place_id
    if data.body_md is not None:
        html, entities = render_markdown(data.body_md)
        t.body_md = data.body_md
        t.body_html = html
        db.query(ThreadMention).filter(ThreadMention.thread_id == thread_id).delete()
        for pid in entities["place_ids"]:
            db.add(ThreadMention(thread_id=t.id, kind="place", place_id=pid))
        for uid in _resolve_user_ids(db, entities["user_ids"], entities.get("usernames", [])):
            db.add(ThreadMention(thread_id=t.id, kind="user", user_id=uid))
        auto = entities["tags"][:5]
        explicit = data.tags[:5] if data.tags is not None else [
            tg.name for tg in db.query(Tag).join(ThreadTag, ThreadTag.tag_id == Tag.id)
            .filter(ThreadTag.thread_id == thread_id, ThreadTag.auto == False).all()
        ]
        _attach_tags(db, t.id, explicit, auto)
        t.is_offtop = t.place_id is None and not entities["place_ids"]
        if len(data.body_md) > 280 and t.place_id is None and not entities["place_ids"]:
            t.is_offtop = False
    db.commit(); db.refresh(t)
    return _thread_out(t, db)


class CommentUpdate(BaseModel):
    body_md: str = Field(min_length=1, max_length=2000)


@router.patch("/comments/{comment_id}")
def update_comment(comment_id: int, data: CommentUpdate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    c = db.get(ThreadComment, comment_id)
    if not c:
        raise HTTPException(404, "Комментарий не найден")
    if c.author_id != user.id and user.role != "admin":
        raise HTTPException(403, "Недостаточно прав")
    html, entities = render_markdown(data.body_md, comments_mode=True)
    c.body_md = data.body_md
    c.body_html = html
    db.query(ThreadMention).filter(ThreadMention.comment_id == comment_id).delete()
    for pid in entities["place_ids"]:
        db.add(ThreadMention(comment_id=c.id, kind="place", place_id=pid))
    for uid in _resolve_user_ids(db, entities["user_ids"], entities.get("usernames", [])):
        db.add(ThreadMention(comment_id=c.id, kind="user", user_id=uid))
    db.commit(); db.refresh(c)
    return {"id": c.id, "body_html": c.body_html}


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(ThreadComment, comment_id)
    if not c:
        raise HTTPException(404, "Комментарий не найден")
    if c.author_id != user.id and user.role != "admin":
        raise HTTPException(403, "Недостаточно прав")
    t = db.get(Thread, c.thread_id)
    db.delete(c)
    if t:
        t.comments_count = max(0, t.comments_count - 1)
    db.commit()


def _make_talk(db: Session, hub: Thread, author_id: int) -> Thread:
    """Тред общего обсуждения уголка. Раздел готов сразу, модерация — жалобами."""
    name = (hub.title or "Раздел").strip() or "Раздел"
    talk = Thread(author_id=author_id, title=None,
                  body_md=f"Общее обсуждение: {name}",
                  body_html=f"Общее обсуждение: {name}",
                  is_offtop=True, place_id=hub.place_id,
                  city=hub.city, district=hub.district, region=hub.region, country=hub.country,
                  hub_id=hub.id, is_hub_talk=True)
    db.add(talk); db.flush()
    return talk


class HubCreate(BaseModel):
    place_id: int
    title: str = Field(min_length=2, max_length=150)


@router.get("/hubs")
def search_hubs(q: str | None = Query(None, min_length=2, max_length=100),
                limit: int = Query(20, le=50), db: Session = Depends(get_db)):
    """Все разделы для карточки выбора: поиск по названию и месту. Масштабируется списком."""
    query = db.query(Thread).filter(Thread.is_hub == True)  # noqa: E712
    if q:
        like = f"%{q}%"
        query = (query.outerjoin(GeoPlace, Thread.place_id == GeoPlace.id)
                 .filter((Thread.title.ilike(like)) | (GeoPlace.name.ilike(like))))
    hubs = query.order_by(Thread.id.desc()).limit(limit).all()
    out = []
    for h in hubs:
        members = (db.query(Thread).filter(Thread.hub_id == h.id, Thread.is_hub_talk == False).count())
        out.append({"id": h.id, "title": h.title or "Раздел",
                    "place": {"id": h.place.id, "name": h.place.name} if h.place else None,
                    "members": members})
    return out


@router.post("/hubs", status_code=201)
def create_hub(data: HubCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Создать раздел места. Готов сразу; споры — через жалобы."""
    place = db.get(GeoPlace, data.place_id)
    if not place:
        raise HTTPException(404, "Место не найдено")
    hub = Thread(author_id=user.id, title=data.title.strip(), body_md=data.title.strip(),
                 body_html=data.title.strip(), is_offtop=False, place_id=place.id,
                 city=place.city, district=place.district, region=place.region, country=place.country,
                 is_hub=True)
    db.add(hub); db.flush()
    talk = _make_talk(db, hub, user.id)
    db.commit(); db.refresh(hub)
    out = _thread_out(hub, db, user.id)
    out["talk_id"] = talk.id
    return out


class HubTitle(BaseModel):
    title: str | None = Field(default=None, max_length=150)


@router.post("/{thread_id}/make-hub", status_code=201)
def make_hub(thread_id: int, data: HubTitle, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    """Переквалифицировать тред с местом в раздел (автор или админ)."""
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.author_id != user.id and user.role != "admin":
        raise HTTPException(403, "Недостаточно прав")
    if t.is_hub or t.is_hub_talk:
        raise HTTPException(400, "Уже раздел")
    if t.place_id is None:
        raise HTTPException(400, "Уголку нужна точка или территория")
    if data.title:
        t.title = data.title.strip() or t.title
    if not t.title:
        t.title = "Раздел"
    t.is_hub = True
    t.is_offtop = False
    db.flush()
    talk = _make_talk(db, t, user.id)
    db.commit(); db.refresh(t)
    out = _thread_out(t, db, user.id)
    out["talk_id"] = talk.id
    return out


class HubAttach(BaseModel):
    hub_id: int


@router.post("/{thread_id}/attach-hub")
def attach_hub(thread_id: int, data: HubAttach, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """Прикрепить свой вопрос к уголку того же места (чужой — только админ)."""
    t = db.get(Thread, thread_id)
    hub = db.get(Thread, data.hub_id)
    if not t or not hub:
        raise HTTPException(404, "Тред не найден")
    if not hub.is_hub:
        raise HTTPException(400, "Это не раздел")
    if t.is_hub or t.is_hub_talk:
        raise HTTPException(400, "Раздел нельзя прикрепить")
    if t.author_id != user.id and not _can_moderate_hub(db, hub, user):
        raise HTTPException(403, "Недостаточно прав")
    if t.place_id != hub.place_id:
        raise HTTPException(400, "Раздел другого места")
    t.hub_id = hub.id
    db.commit(); db.refresh(t)
    return _thread_out(t, db, user.id)


@router.delete("/{thread_id}/attach-hub")
def detach_hub(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    hub = db.get(Thread, t.hub_id) if t.hub_id else None
    if t.author_id != user.id and (not hub or not _can_moderate_hub(db, hub, user)):
        raise HTTPException(403, "Недостаточно прав")
    t.hub_id = None
    db.commit(); db.refresh(t)
    return _thread_out(t, db, user.id)


class HubModeratorAdd(BaseModel):
    username: str = Field(min_length=1, max_length=50)


@router.get("/{thread_id}/moderators")
def hub_moderators(thread_id: int, db: Session = Depends(get_db)):
    hub = db.get(Thread, thread_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    return _hub_moderators(db, hub.id)


@router.post("/{thread_id}/moderators", status_code=201)
def hub_moderator_add(thread_id: int, data: HubModeratorAdd, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """Назначить модератора раздела: автор раздела или админ сайта."""
    from app.models.hub_moderator import HubModerator
    hub = db.get(Thread, thread_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    if hub.author_id != user.id and user.role != "admin":
        raise HTTPException(403, "Только автор раздела")
    target = db.query(User).filter(User.username == data.username.strip()).first()
    if not target:
        raise HTTPException(404, "Житель не найден")
    if target.id == hub.author_id:
        raise HTTPException(400, "Автор уже главный")
    if not db.get(HubModerator, {"user_id": target.id, "hub_id": hub.id}):
        db.add(HubModerator(user_id=target.id, hub_id=hub.id))
        db.commit()
    return _hub_moderators(db, hub.id)


@router.delete("/{thread_id}/moderators/{user_id}")
def hub_moderator_remove(thread_id: int, user_id: int, db: Session = Depends(get_db),
                         user: User = Depends(get_current_user)):
    from app.models.hub_moderator import HubModerator
    hub = db.get(Thread, thread_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    if hub.author_id != user.id and user.role != "admin":
        raise HTTPException(403, "Только автор раздела")
    m = db.get(HubModerator, {"user_id": user_id, "hub_id": hub.id})
    if m:
        db.delete(m)
        db.commit()
    return _hub_moderators(db, hub.id)


@router.get("/{thread_id}/attached")
def hub_attached(thread_id: int, db: Session = Depends(get_db)):
    """Вопросы, прикреплённые к уголку (в общую ленту они тоже попадают)."""
    hub = db.get(Thread, thread_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    items = (db.query(Thread).filter(Thread.hub_id == thread_id, Thread.is_hub_talk == False)
             .order_by(Thread.id.desc()).limit(30).all())
    return [_thread_out(t, db) for t in items]


@router.post("/{thread_id}/vote")
def vote_poll(thread_id: int, data: dict, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    """Голосование в опросе треда. {option_ids: [...]}. Один голос на вариант, повторный — снимает."""
    from app.models.poll import Poll, PollOption, PollVote
    poll = db.query(Poll).filter(Poll.thread_id == thread_id).first()
    if not poll:
        raise HTTPException(404, "Опроса нет")
    want = [int(x) for x in (data.get("option_ids") or []) if str(x).isdigit()]
    if not poll.multiple:
        want = want[:1]
    valid = {o.id for o in poll.options}
    want = [oid for oid in want if oid in valid]
    mine = {v.option_id for v in db.query(PollVote).join(PollOption, PollVote.option_id == PollOption.id)
            .filter(PollOption.poll_id == poll.id, PollVote.user_id == user.id).all()}
    for oid in want:
        if oid in mine:
            db.query(PollVote).filter(PollVote.user_id == user.id, PollVote.option_id == oid).delete()
            db.query(PollOption).filter(PollOption.id == oid).update({PollOption.votes: PollOption.votes - 1})
        else:
            db.add(PollVote(user_id=user.id, option_id=oid))
            db.query(PollOption).filter(PollOption.id == oid).update({PollOption.votes: PollOption.votes + 1})
    # защита счетчиков от ухода в минус
    db.query(PollOption).filter(PollOption.poll_id == poll.id, PollOption.votes < 0).update({PollOption.votes: 0})
    db.commit()
    return _poll_out(db, thread_id, user.id)


@router.post("/{thread_id}/like")
def like_thread(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    ex = db.get(ThreadLike, {"user_id": user.id, "thread_id": thread_id})
    if ex:
        db.delete(ex); t.likes_count = max(0, t.likes_count - 1); db.commit()
        return {"liked": False}
    db.add(ThreadLike(user_id=user.id, thread_id=thread_id))
    t.likes_count += 1; db.commit()
    return {"liked": True}


@router.post("/{thread_id}/request-hub", status_code=201)
def request_hub(thread_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    """Автор выдвигает тред на голосование за раздел -> статус «на рассмотрении»."""
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.author_id != user.id and user.role != "admin":
        raise HTTPException(403, "Только автор")
    if t.is_hub or t.is_hub_talk:
        raise HTTPException(400, "Уже раздел")
    if t.place_id is None:
        raise HTTPException(400, "Уголку нужна точка или территория")
    t.hub_requested = True
    db.commit()
    return _thread_out(t, db, user.id)


@router.post("/{thread_id}/vote-hub")
def vote_hub(thread_id: int, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    """Голос «в раздел» (переключается). N голосов -> автоматически раздел."""
    from app.models.hub_vote import HubVote
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.is_hub or t.is_hub_talk:
        raise HTTPException(400, "Уже раздел")
    if t.place_id is None:
        raise HTTPException(400, "Уголку нужна точка или территория")
    if not t.hub_requested:
        raise HTTPException(400, "Тред не выдвинут в раздел")
    ex = db.get(HubVote, {"user_id": user.id, "thread_id": thread_id})
    if ex:
        db.delete(ex)
        t.hub_votes = max(0, t.hub_votes - 1)
    else:
        db.add(HubVote(user_id=user.id, thread_id=thread_id))
        t.hub_votes += 1
    if t.hub_votes >= HUB_THRESHOLD and not t.is_hub:
        if not t.title:
            t.title = "Раздел"
        t.is_hub = True
        t.is_offtop = False
        db.flush()
        _make_talk(db, t, t.author_id)
    db.commit()
    return _thread_out(t, db, user.id)


@router.post("/{thread_id}/bookmark")
def bookmark_thread(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.thread_bookmark import ThreadBookmark
    if not db.get(Thread, thread_id):
        raise HTTPException(404, "Тред не найден")
    ex = db.get(ThreadBookmark, {"user_id": user.id, "thread_id": thread_id})
    if ex:
        db.delete(ex); db.commit()
        return {"bookmarked": False}
    db.add(ThreadBookmark(user_id=user.id, thread_id=thread_id))
    db.commit()
    return {"bookmarked": True}


@router.get("/bookmarks/mine")
def my_bookmarks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.models.thread_bookmark import ThreadBookmark
    ids = [b.thread_id for b in db.query(ThreadBookmark).filter(ThreadBookmark.user_id == user.id).order_by(ThreadBookmark.created_at.desc()).all()]
    if not ids:
        return []
    items = db.query(Thread).filter(Thread.id.in_(ids)).all()
    by_id = {t.id: t for t in items}
    return [_thread_out(by_id[i], db) for i in ids if i in by_id]


class ReportCreate(BaseModel):
    reason: str = Field(pattern="^(spam|abuse|offtopic|other)$")
    text: str | None = Field(default=None, max_length=500)
    comment_id: int | None = None


@router.post("/{thread_id}/report", status_code=201)
def report_thread(thread_id: int, data: ReportCreate, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    """Q7: жалоба на тред или коммент внутри треда."""
    if not db.get(Thread, thread_id):
        raise HTTPException(404, "Тред не найден")
    r = Report(reporter_id=user.id, thread_id=thread_id, comment_id=data.comment_id,
               reason=data.reason, text=data.text)
    db.add(r); db.commit(); db.refresh(r)
    return {"id": r.id, "status": r.status}


@router.post("/{thread_id}/photos", status_code=201)
def upload_thread_photo(
    thread_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Фото треда."""
    from app.models.thread_photo import ThreadPhoto
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.author_id != user.id:
        raise HTTPException(403, "Недостаточно прав")
    ph = _save_photo(db, file, thread_id=t.id)
    return {"id": ph.id, "file_name": ph.file_name, **_photo_urls(ph.file_name)}


@router.post("/comments/{comment_id}/photos", status_code=201)
def upload_comment_photo(
    comment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Фото ответа."""
    from app.models.thread_photo import ThreadPhoto
    c = db.get(ThreadComment, comment_id)
    if not c:
        raise HTTPException(404, "Комментарий не найден")
    if c.author_id != user.id:
        raise HTTPException(403, "Недостаточно прав")
    ph = _save_photo(db, file, thread_id=c.thread_id, comment_id=c.id)
    return {"id": ph.id, "file_name": ph.file_name, **_photo_urls(ph.file_name)}


@router.delete("/photos/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    """Удаление своего фото треда/ответа (или админом)."""
    from app.models.thread_photo import ThreadPhoto
    ph = db.get(ThreadPhoto, photo_id)
    if not ph:
        raise HTTPException(404, "Фото не найдено")
    allowed = user.role == "admin"
    if not allowed:
        if ph.comment_id is not None:
            c = db.get(ThreadComment, ph.comment_id)
            allowed = c is not None and c.author_id == user.id
        else:
            t = db.get(Thread, ph.thread_id)
            allowed = t is not None and t.author_id == user.id
    if not allowed:
        raise HTTPException(403, "Недостаточно прав")
    try:
        os.remove(os.path.join(settings.UPLOAD_DIR, ph.file_name))
    except OSError:
        pass
    db.delete(ph)
    db.commit()


def _photo_urls(file_name: str) -> dict:
    import os as _os
    pv = f"pv_{file_name}"
    has_pv = _os.path.exists(os.path.join(settings.UPLOAD_DIR, pv))
    return {
        "url": f"/uploads/{file_name}",
        "preview_url": f"/uploads/{pv}" if has_pv else f"/uploads/{file_name}",
    }


def _save_photo(db: Session, file: UploadFile, thread_id: int, comment_id: int | None = None):
    from app.models.thread_photo import ThreadPhoto
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "Файл слишком большой")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    file_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, file_name)
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    width = height = None
    try:
        with Image.open(file_path) as img:
            width, height = img.size
            # превью для лент/пинов: длинная сторона max 640
            pv = img.copy()
            pv.thumbnail((640, 640))
            pv_name = f"pv_{file_name}"
            if (img.format or "").upper() in ("JPEG", "JPG"):
                pv.convert("RGB").save(os.path.join(settings.UPLOAD_DIR, pv_name), "JPEG", quality=82)
            else:
                pv.save(os.path.join(settings.UPLOAD_DIR, pv_name))
    except Exception:
        pass
    ph = ThreadPhoto(thread_id=thread_id, comment_id=comment_id, file_name=file_name, width=width, height=height)
    db.add(ph); db.commit(); db.refresh(ph)
    return ph
