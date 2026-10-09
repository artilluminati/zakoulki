from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
import os
import uuid
from PIL import Image

from app.db.session import get_db
from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.thread import Thread
from app.models.thread_comment import ThreadComment
from app.models.thread_extra import Tag, ThreadTag, ThreadMention, ThreadLike
from app.models.report import Report
from app.models.geo_place import GeoPlace
from app.models.category import Category
from app.services.markdown import render_markdown

router = APIRouter(prefix="/threads", tags=["threads-v5"])


class ThreadCreate(BaseModel):
    body_md: str = Field(min_length=1, max_length=5000)
    title: str | None = Field(default=None, max_length=150)  # Q3: опционально
    place_id: int | None = None
    category_ids: list[int] = []


class CommentCreate(BaseModel):
    body_md: str = Field(min_length=1, max_length=2000)
    parent_id: int | None = None


def _thread_out(t: Thread, db: Session) -> dict:
    from app.models.thread_photo import ThreadPhoto
    photos = db.query(ThreadPhoto).filter(ThreadPhoto.thread_id == t.id).all()
    return {
        "id": t.id, "author_id": t.author_id,
        "author_username": db.get(User, t.author_id).username if db.get(User, t.author_id) else None,
        "title": t.title,
        "body_md": t.body_md, "body_html": t.body_html,
        "photos": [{"id": p.id, "url": f"/uploads/{p.file_name}"} for p in photos],
        "is_offtop": t.is_offtop,
        "place": {"id": t.place.id, "name": t.place.name, "address": t.place.address,
                  "district": t.place.district, "lat": t.place.latitude, "lng": t.place.longitude,
                  "preview_url": t.place.preview_url} if t.place else None,
        "views": t.views, "likes_count": t.likes_count, "comments_count": t.comments_count,
        "created_at": t.created_at,
    }


@router.get("/notifications/mine")
def my_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user), limit: int = 20):
    """Колокольчик: упоминания меня + ответы в моих тредах."""
    mentions = (db.query(ThreadMention).filter(ThreadMention.kind == "user", ThreadMention.user_id == user.id)
                .order_by(ThreadMention.id.desc()).limit(limit).all())
    out = []
    for m in mentions:
        out.append({"id": m.id, "kind": "mention", "thread_id": m.thread_id, "comment_id": m.comment_id})
    replies = (db.query(ThreadComment).join(Thread, ThreadComment.thread_id == Thread.id)
               .filter(Thread.author_id == user.id, ThreadComment.author_id != user.id)
               .order_by(ThreadComment.id.desc()).limit(limit).all())
    for c in replies:
        out.append({"id": f"r{c.id}", "kind": "reply", "thread_id": c.thread_id, "comment_id": c.id})
    return out[:limit]


@router.get("")
def list_threads(
    search: str | None = Query(None),
    tag: str | None = Query(None, description="имя тега без #"),
    has_geo: bool | None = Query(None),
    is_offtop: bool | None = Query(None),
    sort: str = Query("new", pattern="^(new|top|near)$"),
    lat: float | None = None, lng: float | None = None, radius: float | None = Query(None, description="км"),
    before_id: int | None = None, limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    q = db.query(Thread).options(joinedload(Thread.place)).order_by(Thread.id.desc())
    if before_id:
        q = q.filter(Thread.id < before_id)
    if search:
        q = q.filter(Thread.body_md.ilike(f"%{search}%"))
    if tag:
        q = q.join(ThreadTag, ThreadTag.thread_id == Thread.id).join(Tag, ThreadTag.tag_id == Tag.id).filter(Tag.name == tag.lower())
    if has_geo is True:
        q = q.filter(Thread.place_id.isnot(None))
    if has_geo is False:
        q = q.filter(Thread.place_id.is_(None))
    if is_offtop is not None:
        q = q.filter(Thread.is_offtop == is_offtop)
    if sort == "near" and lat is not None and lng is not None and radius:
        delta = radius / 111.0
        q = q.join(GeoPlace, Thread.place_id == GeoPlace.id)
        q = q.filter(GeoPlace.latitude.between(lat - delta, lat + delta))
        q = q.filter(GeoPlace.longitude.between(lng - delta, lng + delta))
    if sort == "top":
        q = q.order_by(Thread.likes_count.desc(), Thread.id.desc())
    items = q.limit(limit).all()
    return [_thread_out(t, db) for t in items]


@router.post("", status_code=201)
def create_thread(data: ThreadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    html, entities = render_markdown(data.body_md)
    # вопрос = есть основная точка ИЛИ упоминание места в тексте
    is_offtop = data.place_id is None and not entities["place_ids"]
    if len(data.body_md) > 280 and data.place_id is None and not entities["place_ids"]:
        # длинный без точки — все равно вопрос, не оффтоп
        is_offtop = False
    t = Thread(author_id=user.id, title=data.title, body_md=data.body_md, body_html=html,
               is_offtop=is_offtop, place_id=data.place_id)
    db.add(t); db.flush()
    # теги
    for name in entities["tags"][:5]:
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name, slug=name); db.add(tag); db.flush()
        db.add(ThreadTag(thread_id=t.id, tag_id=tag.id, auto=True))
    # упоминания мест из текста
    for pid in entities["place_ids"]:
        db.add(ThreadMention(thread_id=t.id, kind="place", place_id=pid))
    for uid in entities["user_ids"]:
        db.add(ThreadMention(thread_id=t.id, kind="user", user_id=uid))
    if data.category_ids:
        t.categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()
    db.commit(); db.refresh(t)
    return _thread_out(t, db)


@router.get("/{thread_id}")
def get_thread(thread_id: int, db: Session = Depends(get_db)):
    t = db.query(Thread).options(joinedload(Thread.place)).filter(Thread.id == thread_id).first()
    if not t:
        raise HTTPException(404, "Тред не найден")
    t.views += 1; db.commit()
    out = _thread_out(t, db)
    comments = db.query(ThreadComment).filter(ThreadComment.thread_id == thread_id).order_by(ThreadComment.id).all()
    out["comments"] = [{"id": c.id, "parent_id": c.parent_id, "author_id": c.author_id,
                        "body_html": c.body_html, "created_at": c.created_at} for c in comments]
    return out


@router.post("/{thread_id}/comments", status_code=201)
def add_comment(thread_id: int, data: CommentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    html, entities = render_markdown(data.body_md, comments_mode=True)
    c = ThreadComment(thread_id=thread_id, parent_id=data.parent_id, author_id=user.id,
                      body_md=data.body_md, body_html=html)
    db.add(c); db.flush()
    for pid in entities["place_ids"]:
        db.add(ThreadMention(comment_id=c.id, kind="place", place_id=pid))
    t.comments_count += 1
    db.commit(); db.refresh(c)
    return {"id": c.id, "body_html": c.body_html}


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
    """Фото треда (до 5, 10МБ)."""
    from app.models.thread_photo import ThreadPhoto
    t = db.get(Thread, thread_id)
    if not t:
        raise HTTPException(404, "Тред не найден")
    if t.author_id != user.id:
        raise HTTPException(403, "Недостаточно прав")
    if db.query(ThreadPhoto).filter(ThreadPhoto.thread_id == thread_id).count() >= 5:
        raise HTTPException(400, "Не больше 5 фото")
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(400, "Файл больше 10МБ")

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
    except Exception:
        pass
    ph = ThreadPhoto(thread_id=thread_id, file_name=file_name, width=width, height=height)
    db.add(ph); db.commit(); db.refresh(ph)
    return {"id": ph.id, "file_name": ph.file_name, "url": f"/uploads/{ph.file_name}"}
