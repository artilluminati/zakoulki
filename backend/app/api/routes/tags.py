from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.thread_extra import Tag

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("")
def list_tags(search: str | None = Query(None, min_length=1, max_length=50),
              limit: int = Query(10, ge=1, le=30),
              db: Session = Depends(get_db)):
    """Популярные теги (для TagPicker и поиска). Без # — отдельная сущность."""
    q = db.query(Tag)
    if search:
        q = q.filter(Tag.name.ilike(f"%{search}%"))
    q = q.order_by(Tag.count.desc(), Tag.name).limit(limit)
    return [{"name": t.name, "count": t.count or 0} for t in q.all()]
