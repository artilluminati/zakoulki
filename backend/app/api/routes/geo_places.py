from fastapi import APIRouter, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.geo_place import GeoPlace
from app.models.thread import Thread

router = APIRouter(prefix="/geo-places", tags=["geo-places-v5"])


class GeoPlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    latitude: float
    longitude: float
    area: list[list[float]] | None = Field(default=None, description="полигон [[lat,lng],...], минимум 3 точки")
    city: str | None = None
    region: str | None = None
    country: str | None = None
    yandex_kind: str = "self"
    yandex_id: str | None = None
    address: str | None = None
    district: str | None = None
    street: str | None = None
    preview_url: str | None = None


def _out(p: GeoPlace) -> dict:
    import os as _os
    from app.core.config import settings as _settings
    from app.services.mapshot import preview_name as _pv
    _map_pv = _pv(p.id)
    has_map = _os.path.exists(_os.path.join(_settings.UPLOAD_DIR, _map_pv))
    import json as _json2
    area = None
    try:
        area = _json2.loads(p.area_json) if p.area_json else None
    except Exception:
        area = None
    return {"id": p.id, "name": p.name, "address": p.address, "district": p.district,
            "street": p.street, "lat": p.latitude, "lng": p.longitude,
            "area": area, "city": p.city, "region": p.region, "country": p.country,
            "yandex_kind": p.yandex_kind, "preview_url": p.preview_url,
            "map_preview": f"/uploads/{_map_pv}" if has_map else None}


@router.get("/search")
def search_places(q: str = Query(min_length=2), lat: float | None = None, lng: float | None = None,
                  db: Session = Depends(get_db)):
    """Своя база + бесплатный HTTP Геокодер (адреса). Организаций у Яндекса бесплатно нет."""
    from app.services import citydata as _cd
    items = db.query(GeoPlace).filter(
        (GeoPlace.name.ilike(f"%{q}%")) | (GeoPlace.address.ilike(f"%{q}%")) | (GeoPlace.street.ilike(f"%{q}%"))
    ).limit(10).all()
    out = [_out(p) for p in items]
    if len(out) < 10:
        try:
            for g in _cd.yandex_search(q, limit=5):
                out.append({"id": 0, **g, "yandex_kind": "address", "preview_url": None})
                if len(out) >= 10:
                    break
        except Exception:
            pass
    # Nominatim (OpenStreetMap) — бесплатный геокодер без ключа, 1 req/s
    if len(out) < 10:
        try:
            for g in _cd.nominatim_search(q, limit=5):
                out.append({"id": 0, **g, "yandex_kind": "address", "preview_url": None})
                if len(out) >= 10:
                    break
        except Exception:
            pass
    return out


@router.post("", status_code=201)
def create_place(data: GeoPlaceCreate, background: BackgroundTasks, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    import json as _json
    area = None
    if data.area:
        pts = [[float(p[0]), float(p[1])] for p in data.area if len(p) >= 2]
        if len(pts) >= 3:
            area = _json.dumps(pts)
    payload = data.model_dump(exclude={"area"})
    p = GeoPlace(**payload, area_json=area, created_by=user.id)
    db.add(p); db.commit(); db.refresh(p)
    # превью карты — фоном, чтобы не тормозить ответ
    from app.services.mapshot import render_preview, preview_name
    from app.core.config import settings as _settings
    import os as _os
    import json as _json3
    pid, plat, plng = p.id, p.latitude, p.longitude
    try:
        parea = _json3.loads(area) if area else None
    except Exception:
        parea = None
    updir = _settings.UPLOAD_DIR
    background.add_task(render_preview, plat, plng, _os.path.join(updir, preview_name(pid)), parea)
    return _out(p)


@router.get("/reverse")
def reverse_geocode(lat: float, lng: float):
    """Координаты -> человеческий адрес (Nominatim, бесплатно). Для превью геолокации."""
    from app.services import citydata as _cd
    try:
        r = _cd.nominatim_reverse(lat, lng)
        if r:
            return r
    except Exception:
        pass
    return {"name": "Точка на карте", "address": None, "district": None, "street": None, "lat": lat, "lng": lng}


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
               district: str | None = None, city: str | None = None,
               region: str | None = None, country: str | None = None,
               geo_any: list[str] | None = Query(None),
               limit: int = Query(200, le=500), db: Session = Depends(get_db)):
    """Легковесные точки для кластеризации на карте."""
    from sqlalchemy import or_ as _or2
    from app.models.thread_photo import ThreadPhoto
    items = (db.query(Thread).join(GeoPlace, Thread.place_id == GeoPlace.id)
             .filter(GeoPlace.latitude.between(south, north))
             .filter(GeoPlace.longitude.between(west, east)))
    if geo_any:
        vals = [v for v in geo_any if v]
        items = items.filter(_or2(GeoPlace.city.in_(vals), GeoPlace.district.in_(vals), GeoPlace.region.in_(vals)))
    if district:
        items = items.filter(GeoPlace.district == district)
    if city:
        items = items.filter(GeoPlace.city == city)
    if region:
        items = items.filter(GeoPlace.region == region)
    if country:
        items = items.filter(GeoPlace.country == country)
    items = (items.order_by(Thread.comments_count.desc(), Thread.id.desc()).limit(limit).all())
    out = []
    for t in items:
        cover = db.query(ThreadPhoto).filter(ThreadPhoto.thread_id == t.id).first()
        cover_url = None
        if cover:
            import os as _os
            from app.core.config import settings as _settings
            pv = f"pv_{cover.file_name}"
            cover_url = f"/uploads/{pv}" if _os.path.exists(_os.path.join(_settings.UPLOAD_DIR, pv)) else f"/uploads/{cover.file_name}"
        import json as _json
        try:
            area = _json.loads(t.place.area_json) if t.place.area_json else None
        except Exception:
            area = None
        out.append({"id": t.id, "lat": t.place.latitude, "lng": t.place.longitude,
                    "is_offtop": t.is_offtop,
                    "comments": t.comments_count,
                    "has_photo": cover is not None,
                    "cover_url": cover_url,
                    "area": area})
    return out


@router.get("/suggest")
def suggest_places(level: str = Query(pattern="^(district|city|region|country)$"),
                   q: str = Query("", max_length=100),
                   parent: str | None = Query(None, description="город для районов / страна для городов"),
                   limit: int = Query(10, le=30), db: Session = Depends(get_db)):
    """Иерархия для глобального фильтра: район -> город -> регион -> страна."""
    from sqlalchemy import func
    col = {"district": GeoPlace.district, "city": GeoPlace.city,
           "region": GeoPlace.region, "country": GeoPlace.country}[level]
    query = db.query(col, func.count(GeoPlace.id)).filter(col.isnot(None))
    if q:
        query = query.filter(col.ilike(f"%{q}%"))
    if parent and level == "district":
        query = query.filter((GeoPlace.city == parent) | (GeoPlace.region == parent) | (GeoPlace.country == parent))
    if parent and level == "city":
        query = query.filter((GeoPlace.region == parent) | (GeoPlace.country == parent))
    if parent and level == "region":
        query = query.filter(GeoPlace.country == parent)
    rows = query.group_by(col).order_by(func.count(GeoPlace.id).desc()).limit(limit).all()
    return [{"name": name, "count": count} for name, count in rows]


@router.get("/resolve")
def resolve_scope(name: str = Query(min_length=2, max_length=200), db: Session = Depends(get_db)):
    """Умное поле: по названию города/района вернуть всю иерархию.
    Точное совпадение с городом важнее района."""
    from sqlalchemy import func
    city_row = (db.query(GeoPlace.city, GeoPlace.region, GeoPlace.country, func.count(GeoPlace.id).label("c"))
                .filter(GeoPlace.city.ilike(name))
                .group_by(GeoPlace.city, GeoPlace.region, GeoPlace.country)
                .order_by(func.count(GeoPlace.id).desc()).first())
    if city_row and city_row[0]:
        return {"district": None, "city": city_row[0], "region": city_row[1], "country": city_row[2] or "Россия"}
    row = (db.query(GeoPlace.district, GeoPlace.city, GeoPlace.region, GeoPlace.country,
                    func.count(GeoPlace.id).label("c"))
           .filter(GeoPlace.district.ilike(name))
           .group_by(GeoPlace.district, GeoPlace.city, GeoPlace.region, GeoPlace.country)
           .order_by(func.count(GeoPlace.id).desc()).first())
    if not row or not row[0]:
        return {"district": None, "city": None, "region": None, "country": "Россия"}
    return {"district": row[0], "city": row[1], "region": row[2], "country": row[3] or "Россия"}


@router.get("/{place_id}")
def get_place(place_id: int, db: Session = Depends(get_db)):
    p = db.get(GeoPlace, place_id)
    if not p:
        from fastapi import HTTPException
        raise HTTPException(404, "Место не найдено")
    return _out(p)
