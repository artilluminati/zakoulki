import math
import os
import uuid
from datetime import datetime, timezone as _tz
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import or_ as sa_or
from sqlalchemy.orm import Session, joinedload, selectinload
from PIL import Image

from app.db.session import get_db
from app.api.deps import get_current_user, get_optional_user
from app.core.config import settings
from app.models.user import User
from app.models.thread import Thread, thread_categories
from app.models.thread_comment import ThreadComment, CommentVote
from app.models.thread_extra import Tag, ThreadTag, ThreadMention, ThreadLike
from app.models.thread_photo import ThreadPhoto
from app.models.report import Report
from app.models.geo_place import GeoPlace
from app.models.category import Category
from app.models.poll import Poll, PollOption, PollVote
from app.models.hub_moderator import HubModerator
from app.models.hub_vote import HubVote
from app.models.thread_bookmark import ThreadBookmark
from app.models.thread_view import ThreadView
from app.services.markdown import render_markdown
from app.services.mapshot import preview_name as map_preview_name
from app.services.badges import badges_map_cached
from app.services import email_notify

router = APIRouter(prefix="/threads", tags=["threads-v5"])


# === СХЕМЫ ===

class ThreadCreate(BaseModel):
    body_md: str = Field(min_length=0, max_length=5000)
    title: str | None = Field(default=None, max_length=150)
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


class ResolveUpdate(BaseModel):
    resolved: bool


class ArchiveUpdate(BaseModel):
    archived: bool


class ThreadUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=150)
    body_md: str | None = Field(default=None, min_length=1, max_length=5000)
    tags: list[str] | None = None
    place_id: int | None = Field(default=None, description="смена точки/территории")


class CommentUpdate(BaseModel):
    body_md: str = Field(min_length=1, max_length=2000)


class CommentVoteIn(BaseModel):
    value: int = Field(ge=-1, le=1, description="+1 вверх, -1 вниз")


class HubCreate(BaseModel):
    place_id: int
    title: str = Field(min_length=2, max_length=150)
    body_md: str | None = Field(default=None, max_length=5000, description="текст раздела")


class HubTitle(BaseModel):
    title: str | None = Field(default=None, max_length=150)


class HubAttach(BaseModel):
    hub_id: int


class HubModeratorAdd(BaseModel):
    username: str = Field(min_length=1, max_length=50)


class ThreadVote(BaseModel):
    value: int = Field(ge=-1, le=1, description="+1 вверх, -1 вниз, 0 снять")


class PollVoteIn(BaseModel):
    option_ids: list[int] = []


class ReportCreate(BaseModel):
    reason: str = Field(pattern="^(spam|abuse|offtopic|other)$")
    text: str | None = Field(default=None, max_length=500)
    comment_id: int | None = None


# === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

def _photo_urls(file_name: str) -> dict:
    pv = f"pv_{file_name}"
    has_pv = os.path.exists(os.path.join(settings.UPLOAD_DIR, pv))
    return {
        "url": f"/uploads/{file_name}",
        "preview_url": f"/uploads/{pv}" if has_pv else f"/uploads/{file_name}",
    }


def _place_out(p: GeoPlace) -> dict:
    _map_pv = map_preview_name(p.id)
    has_map = os.path.exists(os.path.join(settings.UPLOAD_DIR, _map_pv))
    try:
        import json
        area = json.loads(p.area_json) if p.area_json else None
    except Exception:
        area = None
    return {
        "id": p.id, "name": p.name, "address": p.address,
        "district": p.district, "lat": p.latitude, "lng": p.longitude,
        "preview_url": p.preview_url,
        "city": p.city, "region": p.region, "country": p.country,
        "area": area,
        "map_preview": f"/uploads/{_map_pv}" if has_map else None
    }


def _thread_out_batch(
    threads: list[Thread],
    db: Session,
    user_id: int | None = None
) -> list[dict]:
    """Batch-версия _thread_out: загружает все данные одним запросом."""
    if not threads:
        return []
    
    thread_ids = [t.id for t in threads]
    author_ids = {t.author_id for t in threads if t.author_id}
    
    # Batch-загрузка фото
    photos = db.query(ThreadPhoto).filter(
        ThreadPhoto.thread_id.in_(thread_ids),
        ThreadPhoto.comment_id.is_(None)
    ).all()
    photos_by_thread = {}
    for p in photos:
        photos_by_thread.setdefault(p.thread_id, []).append(p)
    
    # Batch-загрузка тегов
    tag_rows = db.query(ThreadTag, Tag).join(Tag).filter(
        ThreadTag.thread_id.in_(thread_ids)
    ).all()
    tags_by_thread = {}
    for tt, tag in tag_rows:
        tags_by_thread.setdefault(tt.thread_id, []).append(tag.name)
    
    # Batch-загрузка авторов
    authors = {u.id: u for u in db.query(User).filter(User.id.in_(author_ids)).all()} if author_ids else {}
    
    # Batch-загрузка бейджей
    author_badges = badges_map_cached(db, list(author_ids)) if author_ids else {}
    
    # Batch-загрузка голосов пользователя
    my_votes = {}
    if user_id:
        votes = db.query(ThreadLike).filter(
            ThreadLike.user_id == user_id,
            ThreadLike.thread_id.in_(thread_ids)
        ).all()
        my_votes = {v.thread_id: v.value for v in votes}
    
    # Batch-загрузка опросов
    polls = db.query(Poll).filter(Poll.thread_id.in_(thread_ids)).all()
    polls_by_thread = {p.thread_id: p for p in polls}
    
    # Batch-загрузка голосов в опросах
    poll_votes = {}
    if user_id and polls:
        poll_ids = [p.id for p in polls]
        pv_rows = db.query(PollVote, PollOption).join(PollOption).filter(
            PollOption.poll_id.in_(poll_ids),
            PollVote.user_id == user_id
        ).all()
        for pv, po in pv_rows:
            poll_votes.setdefault(po.poll_id, []).append(po.id)
    
    # Batch-загрузка голосов за раздел
    hub_votes = {}
    if user_id:
        hv_rows = db.query(HubVote).filter(
            HubVote.user_id == user_id,
            HubVote.thread_id.in_(thread_ids)
        ).all()
        hub_votes = {hv.thread_id for hv in hv_rows}
    
    # Batch-загрузка разделов
    hub_ids = {t.hub_id for t in threads if t.hub_id}
    hubs = {h.id: h for h in db.query(Thread).filter(Thread.id.in_(hub_ids)).all()} if hub_ids else {}
    
    # Batch-загрузка тредов обсуждения
    hub_talks = {}
    hub_threads = [t for t in threads if t.is_hub]
    if hub_threads:
        hub_thread_ids = [t.id for t in hub_threads]
        talks = db.query(Thread).filter(
            Thread.hub_id.in_(hub_thread_ids),
            Thread.is_hub_talk.is_(True)
        ).all()
        hub_talks = {talk.hub_id: talk.id for talk in talks}
    
    # Batch-загрузка прикреплённых вопросов
    attached_counts = {}
    if hub_threads:
        hub_thread_ids = [t.id for t in hub_threads]
        counts = db.query(Thread.hub_id, Thread.id).filter(
            Thread.hub_id.in_(hub_thread_ids),
            Thread.is_hub_talk.is_(False)
        ).all()
        for hub_id, _ in counts:
            attached_counts[hub_id] = attached_counts.get(hub_id, 0) + 1
    
    # Batch-загрузка модераторов
    moderators = {}
    if hub_threads:
        hub_thread_ids = [t.id for t in hub_threads]
        mod_rows = db.query(HubModerator).filter(HubModerator.hub_id.in_(hub_thread_ids)).all()
        mod_user_ids = {m.user_id for m in mod_rows}
        mod_users = {u.id: u for u in db.query(User).filter(User.id.in_(mod_user_ids)).all()} if mod_user_ids else {}
        for m in mod_rows:
            moderators.setdefault(m.hub_id, []).append({
                "id": m.user_id,
                "username": mod_users[m.user_id].username if m.user_id in mod_users else None
            })
    
    # Собираем результат
    result = []
    for t in threads:
        author = authors.get(t.author_id)
        poll = polls_by_thread.get(t.id)
        poll_data = None
        if poll:
            poll_data = {
                "id": poll.id,
                "question": poll.question,
                "multiple": poll.multiple,
                "total": sum(o.votes for o in poll.options),
                "voted": poll_votes.get(poll.id, []),
                "options": [{"id": o.id, "text": o.text, "votes": o.votes} for o in poll.options],
            }
        
        hub = hubs.get(t.hub_id) if t.hub_id else None
        hub_brief = None
        if hub and hub.is_hub:
            hub_brief = {"id": hub.id, "title": hub.title or "Раздел", "author_id": hub.author_id}
        
        result.append({
            "id": t.id, "author_id": t.author_id,
            "author_username": author.username if author else None,
            "author_name": author.name if author else None,
            "author_avatar": author.avatar if author else None,
            "author_badge": author.badge if author else None,
            "author_badges": author_badges.get(t.author_id, []),
            "is_author": bool(user_id and t.author_id == user_id),
            "title": t.title,
            "body_md": t.body_md, "body_html": t.body_html,
            "categories": [{"id": c.id, "name": c.name, "slug": c.slug} for c in (t.categories or [])],
            "tags": tags_by_thread.get(t.id, []),
            "photos": [{"id": p.id, **_photo_urls(p.file_name)} for p in photos_by_thread.get(t.id, [])],
            "is_offtop": t.is_offtop,
            "place": _place_out(t.place) if t.place else None,
            "views": t.views, "likes_count": t.likes_count, "comments_count": t.comments_count,
            "score": t.score, "my_vote": my_votes.get(t.id, 0),
            "is_resolved": t.is_resolved,
            "is_archived": t.is_archived,
            "created_at": t.created_at,
            "city": t.city, "district": t.district, "region": t.region, "country": t.country,
            "poll": poll_data,
            "hub_requested": t.hub_requested,
            "hub_votes": t.hub_votes,
            "hub_voted": t.id in hub_votes,
            "is_hub": t.is_hub,
            "is_hub_talk": t.is_hub_talk,
            "hub_id": t.hub_id,
            "hub": hub_brief,
            "talk_id": hub_talks.get(t.id) if t.is_hub else None,
            "attached_count": attached_counts.get(t.id, 0) if t.is_hub else 0,
            "moderators": moderators.get(t.id, []) if t.is_hub else [],
        })
    
    return result


def _thread_out(t: Thread, db: Session, user_id: int | None = None) -> dict:
    """Одиночная версия для обратной совместимости."""
    return _thread_out_batch([t], db, user_id)[0]


def _hub_brief(db: Session, hub_id: int) -> dict | None:
    h = db.get(Thread, hub_id)
    if not h or not h.is_hub:
        return None
    return {"id": h.id, "title": h.title or "Раздел", "author_id": h.author_id}


def _hub_moderators(db: Session, hub_id: int) -> list[dict]:
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
    return db.get(HubModerator, {"user_id": user.id, "hub_id": hub.id}) is not None


def _can_resolve(db: Session, t: Thread, user: User) -> bool:
    """Решить вопрос могут: автор, админ, официальный аккаунт, автор/модераторы раздела."""
    if user.role == "admin" or t.author_id == user.id:
        return True
    if (user.badge or "") == "official":
        return True
    if t.is_hub and _can_moderate_hub(db, t, user):
        return True
    if t.hub_id:
        hub = db.get(Thread, t.hub_id)
        if hub and _can_moderate_hub(db, hub, user):
            return True
    return False


def _archived_hub_ids(db: Session) -> list[int]:
    return [r[0] for r in db.query(Thread.id).filter(
        Thread.is_hub.is_(True),
        Thread.is_archived.is_(True)
    ).all()]


def _hub_talk_id(db: Session, hub_id: int) -> int | None:
    talk = db.query(Thread).filter(
        Thread.hub_id == hub_id,
        Thread.is_hub_talk.is_(True)
    ).order_by(Thread.id).first()
    return talk.id if talk else None


def _attached_count(db: Session, hub_id: int) -> int:
    return db.query(Thread).filter(
        Thread.hub_id == hub_id,
        Thread.is_hub_talk.is_(False)
    ).count()


def _attach_tags(db: Session, thread_id: int, explicit: list[str], auto: list[str]) -> None:
    """Пересбор тегов треда: удаляет старые связи, вешает новые, пересчитывает счетчики."""
    import re
    old = db.query(ThreadTag).filter(ThreadTag.thread_id == thread_id).all()
    affected = {tt.tag_id for tt in old}
    for tt in old:
        db.delete(tt)
    
    seen: set[str] = set()
    new_tags = []

    def attach(name: str, is_auto: bool) -> None:
        name = name.strip().lower()
        if not name or name in seen:
            return
        if not re.fullmatch(r"[а-яА-ЯёЁa-zA-Z0-9_]{2,50}", name):
            return
        seen.add(name)
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name, slug=name)
            db.add(tag)
            db.flush()
        seen.add(name)
        new_tags.append((tag.id, is_auto))
        affected.add(tag.id)

    for name in (explicit or [])[:5]:
        attach(name, False)
    for name in (auto or [])[:5]:
        attach(name, True)
    
    for tag_id, is_auto in new_tags:
        db.add(ThreadTag(thread_id=thread_id, tag_id=tag_id, auto=is_auto))
    
    db.flush()
    
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


def _delete_photo_files(file_names: list[str]) -> None:
    for fn in file_names:
        for cand in (fn, f"pv_{fn}"):
            try:
                os.remove(os.path.join(settings.UPLOAD_DIR, cand))
            except OSError:
                pass


def _delete_thread_full(db: Session, t: Thread) -> None:
    """Полное удаление треда: фото, комменты, опросы, голоса, закладки, упоминания, теги, жалобы, модераторы."""
    members = db.query(Thread).filter(
        Thread.hub_id == t.id,
        Thread.is_hub_talk.is_(False)
    ).all()
    for m in members:
        m.hub_id = None
    
    talks = db.query(Thread).filter(
        Thread.hub_id == t.id,
        Thread.is_hub_talk.is_(True)
    ).all()
    for talk in talks:
        _delete_thread_full(db, talk)
    
    comment_ids = [c.id for c in db.query(ThreadComment.id).filter(ThreadComment.thread_id == t.id).all()]
    photo_names = [p.file_name for p in db.query(ThreadPhoto).filter(ThreadPhoto.thread_id == t.id).all()]
    _delete_photo_files(photo_names)
    
    db.query(ThreadPhoto).filter(ThreadPhoto.thread_id == t.id).delete(synchronize_session=False)
    
    if comment_ids:
        db.query(ThreadMention).filter(ThreadMention.comment_id.in_(comment_ids)).delete(synchronize_session=False)
        db.query(Report).filter(Report.comment_id.in_(comment_ids)).delete(synchronize_session=False)
    
    db.query(ThreadComment).filter(ThreadComment.thread_id == t.id).delete(synchronize_session=False)
    
    poll = db.query(Poll).filter(Poll.thread_id == t.id).first()
    if poll:
        opt_ids = [o.id for o in db.query(PollOption.id).filter(PollOption.poll_id == poll.id).all()]
        if opt_ids:
            db.query(PollVote).filter(PollVote.option_id.in_(opt_ids)).delete(synchronize_session=False)
        db.query(PollOption).filter(PollOption.poll_id == poll.id).delete(synchronize_session=False)
        db.delete(poll)
    
    db.query(ThreadLike).filter(ThreadLike.thread_id == t.id).delete(synchronize_session=False)
    db.query(HubVote).filter(HubVote.thread_id == t.id).delete(synchronize_session=False)
    db.query(ThreadBookmark).filter(ThreadBookmark.thread_id == t.id).delete(synchronize_session=False)
    db.query(ThreadMention).filter(ThreadMention.thread_id == t.id).delete(synchronize_session=False)
    db.query(ThreadTag).filter(ThreadTag.thread_id == t.id).delete(synchronize_session=False)
    db.query(Report).filter(Report.thread_id == t.id).delete(synchronize_session=False)
    db.query(HubModerator).filter(HubModerator.hub_id == t.id).delete(synchronize_session=False)
    db.execute(thread_categories.delete().where(thread_categories.c.thread_id == t.id))
    
    db.delete(t)


def _move_comments_to_talk(db: Session, hub: Thread, talk: Thread) -> None:
    """Ответы, оставленные пока тред был вопросом, переезжают в обсуждение раздела."""
    db.query(ThreadComment).filter(ThreadComment.thread_id == hub.id).update(
        {ThreadComment.thread_id: talk.id}, synchronize_session=False)
    hub.comments_count = 0
    talk.comments_count = db.query(ThreadComment).filter(ThreadComment.thread_id == talk.id).count()


def _make_talk(db: Session, hub: Thread, author_id: int) -> Thread:
    """Тред общего обсуждения уголка."""
    name = (hub.title or "Раздел").strip() or "Раздел"
    talk = Thread(
        author_id=author_id, title=None,
        body_md=f"Общее обсуждение: {name}",
        body_html=f"Общее обсуждение: {name}",
        is_offtop=True, place_id=hub.place_id,
        city=hub.city, district=hub.district, region=hub.region, country=hub.country,
        hub_id=hub.id, is_hub_talk=True
    )
    db.add(talk)
    db.flush()
    return talk


def _notify_by_email(db: Session, background, t: Thread, c: ThreadComment,
                     author: User, mentioned_ids: list[int]) -> None:
    """Письма: ответ в моём треде + упоминание меня."""
    if background is None:
        return
    snippet = (c.body_md or "")[:200]
    author_name = author.username
    
    if t.author_id != author.id:
        thread_author = db.get(User, t.author_id)
        if thread_author and getattr(thread_author, "email_notifications", True):
            background.add_task(email_notify.notify_reply,
                                {"email": thread_author.email, "username": thread_author.username},
                                author_name, t.title, snippet, t.id)
    
    for uid in dict.fromkeys(mentioned_ids):
        if uid == author.id or uid == t.author_id:
            continue
        mentioned = db.get(User, uid)
        if mentioned and getattr(mentioned, "email_notifications", True):
            background.add_task(email_notify.notify_mention,
                                {"email": mentioned.email, "username": mentioned.username},
                                author_name, t.title, snippet, t.id)


def _save_photo(db: Session, file: UploadFile, thread_id: int, comment_id: int | None = None):
    if file.size is not None and file.size > 10 * 1024 * 1024:
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
    db.add(ph)
    db.commit()
    db.refresh(ph)
    return ph


# === ЭНДПОИНТЫ ===

@router.post("/{thread_id}/resolve")
def resolve_thread(thread_id: int, data: ResolveUpdate, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """Пометить вопрос решённым (или снять)."""
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if not _can_resolve(db, t, user):
        raise HTTPException(403, "Недостаточно прав")
    t.is_resolved = data.resolved
    db.commit()
    return _thread_out(t, db, user.id)


@router.post("/{thread_id}/archive")
def archive_hub(thread_id: int, data: ArchiveUpdate, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    """Убрать раздел в архив."""
    hub = db.get(Thread, thread_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    if hub.author_id != user.id and user.role != "admin" and not _can_moderate_hub(db, hub, user):
        raise HTTPException(403, "Только автор раздела")
    hub.is_archived = data.archived
    db.commit()
    return _thread_out(hub, db, user.id)


@router.get("/notifications/mine")
def my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user),
                     limit: int = Query(20, ge=1, le=100)):
    """Колокольчик: упоминания меня + ответы в моих тредах."""
    import re
    
    def clean(raw: str) -> str:
        s = re.sub(r"@\[(\d+):([^\]]+)\]", r"@\2", raw)
        s = re.sub(r"\+\[(\d+):([^\]]+)\]", r"\2", s)
        return s[:80]
    
    out = []
    
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
    
    out.sort(key=lambda x: x["created_at"], reverse=True)
    return out[:limit]


@router.get("")
def list_threads(
    search: str | None = Query(None, max_length=200),
    tag: str | None = Query(None, description="имя тега без #"),
    author_id: int | None = Query(None),
    category_id: int | None = Query(None),
    place_id: int | None = Query(None),
    has_geo: bool | None = Query(None),
    is_hub: bool | None = Query(None, description="только разделы"),
    is_resolved: bool | None = Query(None, description="только решённые"),
    is_offtop: bool | None = Query(None),
    district: str | None = Query(None, description="район"),
    city: str | None = Query(None, description="город/округ"),
    region: str | None = Query(None, description="область/регион"),
    country: str | None = Query(None, description="страна"),
    geo_any: list[str] | None = Query(None, description="город ИЛИ область: несколько значений через OR"),
    sort: str = Query("new", pattern="^(new|top|near)$"),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    radius: float | None = Query(None, gt=0, description="радиус в км"),
    before_id: int | None = Query(None),
    after_id: int | None = Query(None, description="только треды новее id — для поллинга"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    q = db.query(Thread).options(selectinload(Thread.place)).filter(Thread.is_hub_talk.is_(False))
    
    need_geo_join = (
        district or city or region or country or geo_any
        or (sort == "near" and lat is not None and lng is not None and radius is not None)
    )
    if need_geo_join:
        q = q.outerjoin(GeoPlace, Thread.place_id == GeoPlace.id)
    
    if geo_any:
        vals = [v for v in geo_any if v]
        if vals:
            q = q.filter(sa_or(
                GeoPlace.city.in_(vals), GeoPlace.district.in_(vals), GeoPlace.region.in_(vals),
                Thread.city.in_(vals), Thread.district.in_(vals), Thread.region.in_(vals),
            ))
    
    if district:
        q = q.filter(sa_or(GeoPlace.district == district, Thread.district == district))
    if city:
        q = q.filter(sa_or(GeoPlace.city == city, Thread.city == city))
    if region:
        q = q.filter(sa_or(GeoPlace.region == region, Thread.region == region))
    if country:
        q = q.filter(sa_or(GeoPlace.country == country, Thread.country == country))
    
    if before_id is not None:
        q = q.filter(Thread.id < before_id)
    if author_id is not None:
        q = q.filter(Thread.author_id == author_id)
    if place_id is not None:
        q = q.filter(Thread.place_id == place_id)
    if search:
        q = q.filter(Thread.body_md.ilike(f"%{search}%"))
    if tag:
        q = q.join(ThreadTag, ThreadTag.thread_id == Thread.id).join(Tag, ThreadTag.tag_id == Tag.id).filter(Tag.name == tag.lower())
    if category_id is not None:
        q = q.join(thread_categories, thread_categories.c.thread_id == Thread.id).filter(thread_categories.c.category_id == category_id)
    
    if has_geo is True:
        q = q.filter(Thread.place_id.isnot(None))
    elif has_geo is False:
        q = q.filter(Thread.place_id.is_(None))
    
    if is_hub is not None:
        q = q.filter(Thread.is_hub == is_hub)
    if is_resolved is not None:
        q = q.filter(Thread.is_resolved == is_resolved)
    if is_offtop is not None:
        q = q.filter(Thread.is_offtop == is_offtop)
    
    if sort == "near" and lat is not None and lng is not None and radius is not None:
        delta_lat = radius / 111.0
        cos_lat = math.cos(math.radians(lat)) if lat != 0 else 1.0
        delta_lng = radius / (111.0 * cos_lat)
        q = q.filter(
            GeoPlace.latitude.between(lat - delta_lat, lat + delta_lat),
            GeoPlace.longitude.between(lng - delta_lng, lng + delta_lng),
        )
        q = q.order_by(Thread.id.desc())
    
    if sort == "top":
        archived = _archived_hub_ids(db)
        q = q.filter(Thread.is_archived.is_(False))
        if archived:
            q = q.filter(~Thread.hub_id.in_(archived))
        q = q.order_by(Thread.score.desc(), Thread.id.desc())
    else:
        q = q.order_by(Thread.id.desc())
    
    q = q.distinct()
    
    if after_id is not None:
        if sort == "top":
            if before_id is not None:
                q = q.filter(Thread.id < before_id)
            items = q.limit(limit).all()
        else:
            items = q.filter(Thread.id > after_id).order_by(Thread.id.asc()).limit(limit).all()
            items.reverse()
    else:
        items = q.limit(limit).all()
    
    viewer_id = user.id if user else None
    return _thread_out_batch(items, db, viewer_id)


@router.post("", status_code=201)
def create_thread(data: ThreadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if data.place_id is not None and not db.get(GeoPlace, data.place_id):
        raise HTTPException(404, "Место не найдено")
    
    html, entities = render_markdown(data.body_md)
    is_offtop = data.place_id is None and not entities["place_ids"]
    if len(data.body_md) > 280 and data.place_id is None and not entities["place_ids"]:
        is_offtop = False
    
    t = Thread(
        author_id=user.id, title=data.title, body_md=data.body_md, body_html=html,
        is_offtop=is_offtop, place_id=data.place_id,
        city=data.city, district=data.district, region=data.region, country=data.country
    )
    db.add(t)
    db.flush()
    
    _attach_tags(db, t.id, data.tags or [], entities["tags"][:5])
    
    for pid in entities["place_ids"]:
        db.add(ThreadMention(thread_id=t.id, kind="place", place_id=pid))
    for uid in _resolve_user_ids(db, entities["user_ids"], entities.get("usernames", [])):
        db.add(ThreadMention(thread_id=t.id, kind="user", user_id=uid))
    
    if data.category_ids:
        t.categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()
    
    if data.poll:
        q = str(data.poll.get("question", ""))[:300].strip()
        opts = [str(o)[:150].strip() for o in (data.poll.get("options") or [])][:10]
        opts = [o for o in opts if o]
        if q and len(opts) >= 2:
            poll = Poll(thread_id=t.id, question=q, multiple=bool(data.poll.get("multiple", False)))
            db.add(poll)
            db.flush()
            for i, text in enumerate(opts):
                db.add(PollOption(poll_id=poll.id, position=i, text=text))
    
    db.commit()
    db.refresh(t)
    return _thread_out(t, db)


HUB_THRESHOLD = 3


@router.get("/hubs")
def search_hubs(q: str | None = Query(None, min_length=2, max_length=100),
                limit: int = Query(20, le=50),
                district: str | None = Query(None), city: str | None = Query(None),
                region: str | None = Query(None), country: str | None = Query(None),
                geo_any: list[str] | None = Query(None),
                db: Session = Depends(get_db)):
    """Все разделы для карточки выбора."""
    query = db.query(Thread).filter(Thread.is_hub.is_(True))
    
    need_geo_join = district or city or region or country or geo_any or q
    if need_geo_join:
        query = query.outerjoin(GeoPlace, Thread.place_id == GeoPlace.id)
    
    if geo_any:
        vals = [v for v in geo_any if v]
        if vals:
            query = query.filter(sa_or(
                GeoPlace.city.in_(vals), GeoPlace.district.in_(vals), GeoPlace.region.in_(vals),
                Thread.city.in_(vals), Thread.district.in_(vals), Thread.region.in_(vals),
            ))
    
    if district:
        query = query.filter(sa_or(GeoPlace.district == district, Thread.district == district))
    if city:
        query = query.filter(sa_or(GeoPlace.city == city, Thread.city == city))
    if region:
        query = query.filter(sa_or(GeoPlace.region == region, Thread.region == region))
    if country:
        query = query.filter(sa_or(GeoPlace.country == country, Thread.country == country))
    
    if q:
        like = f"%{q}%"
        query = query.filter((Thread.title.ilike(like)) | (GeoPlace.name.ilike(like)))
    
    hubs = query.order_by(Thread.id.desc()).limit(limit).all()
    out = []
    for h in hubs:
        members = db.query(Thread).filter(
            Thread.hub_id == h.id,
            Thread.is_hub_talk.is_(False)
        ).count()
        out.append({
            "id": h.id, "title": h.title or "Раздел",
            "place": {"id": h.place.id, "name": h.place.name} if h.place else None,
            "members": members
        })
    return out


@router.post("/hubs", status_code=201)
def create_hub(data: HubCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Создать раздел места."""
    place = db.get(GeoPlace, data.place_id)
    if not place:
        raise HTTPException(404, "Место не найдено")
    
    body = (data.body_md or "").strip() or data.title.strip()
    html, _entities = render_markdown(body)
    
    hub = Thread(
        author_id=user.id, title=data.title.strip(), body_md=body, body_html=html,
        is_offtop=False, place_id=place.id,
        city=place.city, district=place.district, region=place.region, country=place.country,
        is_hub=True
    )
    db.add(hub)
    db.flush()
    
    talk = _make_talk(db, hub, user.id)
    db.commit()
    db.refresh(hub)
    
    out = _thread_out(hub, db, user.id)
    out["talk_id"] = talk.id
    return out


@router.get("/{thread_id}")
def get_thread(thread_id: int, db: Session = Depends(get_db),
               user: User | None = Depends(get_optional_user),
               viewer: str | None = Query(None, max_length=64, description="анонимный id зрителя")):
    t = db.query(Thread).options(joinedload(Thread.place)).filter(Thread.id == thread_id).first()
    if not t:
        raise HTTPException(404, "Тред не найден")
    
    key = f"u:{user.id}" if user else (viewer.strip()[:64] if viewer and viewer.strip() else None)
    if key:
        now = datetime.now(_tz.utc)
        seen = db.get(ThreadView, {"thread_id": thread_id, "viewer": key})
        if not seen:
            db.add(ThreadView(thread_id=thread_id, viewer=key, viewed_at=now))
            t.views += 1
        elif not seen.viewed_at or (now - seen.viewed_at).total_seconds() > 24 * 3600:
            seen.viewed_at = now
            t.views += 1
    
    db.commit()
    out = _thread_out(t, db, user.id if user else None)
    
    comments = db.query(ThreadComment).filter(ThreadComment.thread_id == thread_id).order_by(ThreadComment.id).all()
    comment_ids = [c.id for c in comments]
    
    my_votes = {}
    if user and comment_ids:
        votes = db.query(CommentVote).filter(
            CommentVote.user_id == user.id,
            CommentVote.comment_id.in_(comment_ids)
        ).all()
        my_votes = {v.comment_id: v.value for v in votes}
    
    photos = db.query(ThreadPhoto).filter(ThreadPhoto.comment_id.in_(comment_ids)).all() if comment_ids else []
    photos_by_comment = {}
    for p in photos:
        photos_by_comment.setdefault(p.comment_id, []).append(p)
    
    author_ids = {c.author_id for c in comments if c.author_id}
    authors = {u.id: u for u in db.query(User).filter(User.id.in_(author_ids)).all()} if author_ids else {}
    
    out["comments"] = [{
        "id": c.id, "parent_id": c.parent_id, "author_id": c.author_id,
        "author_username": authors[c.author_id].username if c.author_id in authors else None,
        "author_badge": authors[c.author_id].badge if c.author_id in authors else None,
        "body_md": c.body_md, "body_html": c.body_html, "created_at": c.created_at,
        "score": c.score, "my_vote": my_votes.get(c.id, 0),
        "photos": [{"id": p.id, **_photo_urls(p.file_name)} for p in photos_by_comment.get(c.id, [])],
    } for c in comments]
    
    return out


@router.post("/{thread_id}/comments", status_code=201)
def add_comment(thread_id: int, data: CommentCreate, background: BackgroundTasks,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.is_hub and not t.is_hub_talk:
        talk_id = _hub_talk_id(db, t.id)
        raise HTTPException(400, f"Раздел не обсуждают здесь — общее обсуждение в треде #{talk_id}" if talk_id else "Раздел не обсуждают здесь")
    
    html, entities = render_markdown(data.body_md, comments_mode=True)
    c = ThreadComment(
        thread_id=thread_id, parent_id=data.parent_id, author_id=user.id,
        body_md=data.body_md, body_html=html
    )
    db.add(c)
    db.flush()
    
    mentioned_ids = []
    for pid in entities["place_ids"]:
        db.add(ThreadMention(comment_id=c.id, kind="place", place_id=pid))
    for uid in _resolve_user_ids(db, entities["user_ids"], entities.get("usernames", [])):
        db.add(ThreadMention(comment_id=c.id, kind="user", user_id=uid))
        mentioned_ids.append(uid)
    
    t.comments_count += 1
    db.commit()
    db.refresh(c)
    
    _notify_by_email(db, background, t, c, user, mentioned_ids)
    return {"id": c.id, "body_html": c.body_html}


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
            t.city = None
            t.district = None
            t.region = None
            t.country = None
        else:
            new_place = db.get(GeoPlace, data.place_id)
            if not new_place:
                raise HTTPException(404, "Место не найдено")
            t.place_id = data.place_id
            t.city = new_place.city
            t.district = new_place.district
            t.region = new_place.region
            t.country = new_place.country
    
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
            .filter(ThreadTag.thread_id == thread_id, ThreadTag.auto.is_(False)).all()
        ]
        _attach_tags(db, t.id, explicit, auto)
        
        t.is_offtop = t.place_id is None and not entities["place_ids"]
        if len(data.body_md) > 280 and t.place_id is None and not entities["place_ids"]:
            t.is_offtop = False
    
    db.commit()
    db.refresh(t)
    return _thread_out(t, db)


@router.post("/comments/{comment_id}/score")
def score_comment(comment_id: int, data: CommentVoteIn, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    """Голос стрелкой на ответе."""
    c = db.query(ThreadComment).filter(ThreadComment.id == comment_id).with_for_update().first()
    if not c:
        raise HTTPException(404, "Ответ не найден")
    if data.value not in (1, -1):
        raise HTTPException(400, "Голос: +1 или -1")
    
    ex = db.get(CommentVote, {"user_id": user.id, "comment_id": comment_id})
    if ex and ex.value == data.value:
        c.score -= ex.value
        db.delete(ex)
        my_vote = 0
    elif ex:
        c.score += 2 * data.value
        ex.value = data.value
        my_vote = data.value
    else:
        db.add(CommentVote(user_id=user.id, comment_id=comment_id, value=data.value))
        c.score += data.value
        my_vote = data.value
    
    db.commit()
    return {"score": c.score, "my_vote": my_vote}


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
    
    db.commit()
    db.refresh(c)
    return {"id": c.id, "body_html": c.body_html}


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(ThreadComment, comment_id)
    if not c:
        raise HTTPException(404, "Комментарий не найден")
    
    t = db.get(Thread, c.thread_id)
    hub_ctx = None
    if t:
        hub_ctx = t if t.is_hub else (db.get(Thread, t.hub_id) if t.hub_id else None)
    
    allowed = (
        user.role == "admin"
        or c.author_id == user.id
        or (hub_ctx is not None and _can_moderate_hub(db, hub_ctx, user))
    )
    if not allowed:
        raise HTTPException(403, "Недостаточно прав")
    
    photo_names = [p.file_name for p in db.query(ThreadPhoto).filter(ThreadPhoto.comment_id == c.id).all()]
    _delete_photo_files(photo_names)
    db.query(ThreadPhoto).filter(ThreadPhoto.comment_id == c.id).delete(synchronize_session=False)
    db.delete(c)
    
    if t:
        t.comments_count = max(0, t.comments_count - 1)
    
    db.commit()


@router.post("/{thread_id}/make-hub", status_code=201)
def make_hub(thread_id: int, data: HubTitle, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    """Переквалифицировать тред с местом в раздел."""
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
    _move_comments_to_talk(db, t, talk)
    db.commit()
    db.refresh(t)
    
    out = _thread_out(t, db, user.id)
    out["talk_id"] = talk.id
    return out


@router.post("/{thread_id}/attach-hub")
def attach_hub(thread_id: int, data: HubAttach, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    """Прикрепить свой вопрос к уголку."""
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
    db.commit()
    db.refresh(t)
    return _thread_out(t, db, user.id)


@router.delete("/{thread_id}", status_code=204)
def delete_thread(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Удалить свой вопрос."""
    t = db.get(Thread, thread_id)
    if not t:
        return
    
    hub_ctx = t if t.is_hub else (db.get(Thread, t.hub_id) if t.hub_id else None)
    allowed = (
        user.role == "admin"
        or t.author_id == user.id
        or (hub_ctx is not None and _can_moderate_hub(db, hub_ctx, user))
    )
    if not allowed:
        raise HTTPException(403, "Недостаточно прав")
    
    _delete_thread_full(db, t)
    db.commit()


@router.delete("/{thread_id}/attach-hub")
def detach_hub(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    
    hub = db.get(Thread, t.hub_id) if t.hub_id else None
    if t.author_id != user.id and (not hub or not _can_moderate_hub(db, hub, user)):
        raise HTTPException(403, "Недостаточно прав")
    
    t.hub_id = None
    db.commit()
    db.refresh(t)
    return _thread_out(t, db, user.id)


@router.get("/{thread_id}/moderators")
def hub_moderators(thread_id: int, db: Session = Depends(get_db)):
    hub = db.get(Thread, thread_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    return _hub_moderators(db, hub.id)


@router.post("/{thread_id}/moderators", status_code=201)
def hub_moderator_add(thread_id: int, data: HubModeratorAdd, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    """Назначить модератора раздела."""
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
    """Вопросы, прикреплённые к уголку."""
    hub = db.get(Thread, thread_id)
    if not hub or not hub.is_hub:
        raise HTTPException(404, "Раздел не найден")
    
    items = db.query(Thread).filter(
        Thread.hub_id == thread_id,
        Thread.is_hub_talk.is_(False)
    ).order_by(Thread.id.desc()).limit(30).all()
    
    return _thread_out_batch(items, db)


@router.post("/{thread_id}/vote")
def vote_poll(thread_id: int, data: PollVoteIn, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    """Голосование в опросе треда."""
    poll = db.query(Poll).filter(Poll.thread_id == thread_id).first()
    if not poll:
        raise HTTPException(404, "Опроса нет")
    
    want = data.option_ids
    if not poll.multiple:
        want = want[:1]
    
    valid = {o.id for o in poll.options}
    want = [oid for oid in want if oid in valid]
    
    mine = {v.option_id for v in db.query(PollVote).join(PollOption, PollVote.option_id == PollOption.id)
            .filter(PollOption.poll_id == poll.id, PollVote.user_id == user.id).all()}
    
    for oid in want:
        if oid in mine:
            db.query(PollVote).filter(PollVote.user_id == user.id, PollVote.option_id == oid).delete()
            opt = db.query(PollOption).filter(PollOption.id == oid).with_for_update().first()
            opt.votes = max(0, opt.votes - 1)
        else:
            db.add(PollVote(user_id=user.id, option_id=oid))
            opt = db.query(PollOption).filter(PollOption.id == oid).with_for_update().first()
            opt.votes += 1
    
    db.commit()
    
    poll_votes = {}
    if user.id:
        pv_rows = db.query(PollVote, PollOption).join(PollOption).filter(
            PollOption.poll_id == poll.id,
            PollVote.user_id == user.id
        ).all()
        for pv, po in pv_rows:
            poll_votes.setdefault(po.poll_id, []).append(po.id)
    
    return {
        "id": poll.id,
        "question": poll.question,
        "multiple": poll.multiple,
        "total": sum(o.votes for o in poll.options),
        "voted": poll_votes.get(poll.id, []),
        "options": [{"id": o.id, "text": o.text, "votes": o.votes} for o in poll.options],
    }


@router.post("/{thread_id}/score")
def score_thread(thread_id: int, data: ThreadVote, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    """Голос стрелкой."""
    t = db.query(Thread).filter(Thread.id == thread_id).with_for_update().first()
    if not t:
        raise HTTPException(404, "Тред не найден")
    
    if data.value == 0:
        ex = db.get(ThreadLike, {"user_id": user.id, "thread_id": thread_id})
        if ex:
            t.score -= ex.value
            db.delete(ex)
            db.commit()
        return {"score": t.score, "my_vote": 0}
    
    if data.value not in (1, -1):
        raise HTTPException(400, "Голос: +1 или -1")
    
    ex = db.get(ThreadLike, {"user_id": user.id, "thread_id": thread_id})
    if ex and ex.value == data.value:
        t.score -= ex.value
        db.delete(ex)
        my_vote = 0
    elif ex:
        t.score += 2 * data.value
        ex.value = data.value
        my_vote = data.value
    else:
        db.add(ThreadLike(user_id=user.id, thread_id=thread_id, value=data.value))
        t.score += data.value
        my_vote = data.value
    
    db.commit()
    return {"score": t.score, "my_vote": my_vote}


@router.post("/{thread_id}/request-hub", status_code=201)
def request_hub(thread_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    """Автор выдвигает тред на голосование за раздел."""
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
    """Голос «в раздел»."""
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
        _move_comments_to_talk(db, t, _make_talk(db, t, t.author_id))
    
    db.commit()
    return _thread_out(t, db, user.id)


@router.post("/{thread_id}/bookmark")
def bookmark_thread(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.get(Thread, thread_id):
        raise HTTPException(404, "Тред не найден")
    
    ex = db.get(ThreadBookmark, {"user_id": user.id, "thread_id": thread_id})
    if ex:
        db.delete(ex)
        db.commit()
        return {"bookmarked": False}
    
    db.add(ThreadBookmark(user_id=user.id, thread_id=thread_id))
    db.commit()
    return {"bookmarked": True}


@router.get("/bookmarks/mine")
def my_bookmarks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = [b.thread_id for b in db.query(ThreadBookmark).filter(ThreadBookmark.user_id == user.id)
           .order_by(ThreadBookmark.created_at.desc()).all()]
    if not ids:
        return []
    
    items = db.query(Thread).filter(Thread.id.in_(ids)).all()
    by_id = {t.id: t for t in items}
    return _thread_out_batch([by_id[i] for i in ids if i in by_id], db, user.id)


@router.post("/{thread_id}/report", status_code=201)
def report_thread(thread_id: int, data: ReportCreate, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    """Жалоба на тред или коммент внутри треда."""
    if not db.get(Thread, thread_id):
        raise HTTPException(404, "Тред не найден")
    
    r = Report(
        reporter_id=user.id, thread_id=thread_id, comment_id=data.comment_id,
        reason=data.reason, text=data.text
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"id": r.id, "status": r.status}


@router.post("/{thread_id}/photos", status_code=201)
def upload_thread_photo(
    thread_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Фото треда."""
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
    """Удаление своего фото треда/ответа."""
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
    
    _delete_photo_files([ph.file_name])
    db.delete(ph)
    db.commit()