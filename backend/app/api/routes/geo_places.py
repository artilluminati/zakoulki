from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.geo_place import GeoPlace
from app.models.thread import Thread

router = APIRouter(prefix="/geo-places", tags=["geo-places-v5"])


class GeoPlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    latitude: float
    longitude: float
    yandex_kind: str = "self"
    yandex_id: str | None = None
    address: str | None = None
    district: str | None = None
    street: str | None = None
    preview_url: str | None = None


def _out(p: GeoPlace) -> dict:
    return {"id": p.id, "name": p.name, "address": p.address, "district": p.district,
            "street": p.street, "lat": p.latitude, "lng": p.longitude,
            "yandex_kind": p.yandex_kind, "preview_url": p.preview_url}


@router.get("/search")
def search_places(q: str = Query(min_length=2), lat: float | None = None, lng: float | None = None,
                  db: Session = Depends(get_db)):
    """Поиск по своим местам (Яндекс-прокси подключим когда будет ключ — см. QUESTIONS.md:6)."""
    items = db.query(GeoPlace).filter(GeoPlace.name.ilike(f"%{q}%")).limit(10).all()
    return [_out(p) for p in items]


@router.post("", status_code=201)
def create_place(data: GeoPlaceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = GeoPlace(**data.model_dump(), created_by=user.id)
    db.add(p); db.commit(); db.refresh(p)
    return _out(p)


@router.get("/nearby")
def nearby_threads(lat: float, lng: float, radius: float = Query(0.3, description="км, default 300м"),
                   db: Session = Depends(get_db)):
    """Ближайшие обсуждения для экрана создания: 'это уже обсуждают рядом?'."""
    delta = radius / 111.0
    items = (db.query(Thread).join(GeoPlace, Thread.place_id == GeoPlace.id)
             .filter(GeoPlace.latitude.between(lat - delta, lat + delta))
             .filter(GeoPlace.longitude.between(lng - delta, lng + delta))
             .order_by(Thread.id.desc()).limit(3).all())
    return [{"id": t.id, "body_md": t.body_md[:140], "place_name": t.place.name if t.place else None} for t in items]


@router.get("/map-points")
def map_points(north: float, south: float, east: float, west: float,
               limit: int = Query(200, le=500), db: Session = Depends(get_db)):
    """Легковесные точки для кластеризации на карте."""
    from app.models.thread_photo import ThreadPhoto
    items = (db.query(Thread).join(GeoPlace, Thread.place_id == GeoPlace.id)
             .filter(GeoPlace.latitude.between(south, north))
             .filter(GeoPlace.longitude.between(west, east))
             .order_by(Thread.comments_count.desc(), Thread.id.desc()).limit(limit).all())
    out = []
    for t in items:
        cover = db.query(ThreadPhoto).filter(ThreadPhoto.thread_id == t.id).first()
        out.append({"id": t.id, "lat": t.place.latitude, "lng": t.place.longitude,
                    "is_offtop": t.is_offtop,
                    "comments": t.comments_count,
                    "has_photo": cover is not None,
                    "cover_url": f"/uploads/{cover.file_name}" if cover else None})
    return out


@router.get("/{place_id}")
def get_place(place_id: int, db: Session = Depends(get_db)):
    p = db.get(GeoPlace, place_id)
    if not p:
        from fastapi import HTTPException
        raise HTTPException(404, "Место не найдено")
    return _out(p)
