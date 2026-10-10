from fastapi import APIRouter

from app.services import citydata as _cd

router = APIRouter(prefix="/citydata", tags=["citydata"])


@router.get("/sources")
def list_sources():
    """Реестр городских данных: что подключено, что требует ключ, что запланировано."""
    return _cd.PROVIDERS


@router.get("/stats")
def public_stats():
    """Публичная витрина цифр для /about и ведомств."""
    from app.db.session import SessionLocal
    from app.models.thread import Thread
    from app.models.thread_comment import ThreadComment
    from app.models.geo_place import GeoPlace
    from app.models.user import User
    db = SessionLocal()
    try:
        return {
            "threads": db.query(Thread).count(),
            "with_geo": db.query(Thread).filter(Thread.place_id.isnot(None)).count(),
            "comments": db.query(ThreadComment).count(),
            "places": db.query(GeoPlace).count(),
            "users": db.query(User).count(),
        }
    finally:
        db.close()
