"""Рекомендации «Кто поможет» — блок с проверенными контактами.
Публикация только после модерации, показываются всем."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.recommendation import REC_PUBLISHED, REC_TOPICS, Recommendation

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("")
def list_recommendations(topic: str | None = Query(None), limit: int = Query(12, le=50),
                          db: Session = Depends(get_db)):
    q = db.query(Recommendation).filter(Recommendation.status == REC_PUBLISHED)
    if topic:
        q = q.filter(Recommendation.topic == topic)
    items = q.order_by(Recommendation.published_at.desc().nullslast(), Recommendation.id.desc()).limit(limit).all()
    return [{
        "id": r.id,
        "title": r.title,
        "description": r.description,
        "contact": r.contact,
        "url": r.url,
        "topic": r.topic,
        "topic_label": REC_TOPICS.get(r.topic, r.topic),
        "published_at": r.published_at,
        "expires_at": r.expires_at,
    } for r in items]


@router.get("/topics")
def recommendation_topics():
    return [{"id": k, "label": v} for k, v in REC_TOPICS.items()]
