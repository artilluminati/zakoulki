from fastapi import APIRouter, Depends, Query
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
    """Своя база + бесплатный HTTP Геокодер (адреса). Организаций у Яндекса бесплатно нет."""
    items = db.query(GeoPlace).filter(
        (GeoPlace.name.ilike(f"%{q}%")) | (GeoPlace.address.ilike(f"%{q}%")) | (GeoPlace.street.ilike(f"%{q}%"))
    ).limit(10).all()
    out = [_out(p) for p in items]
    key = settings.YANDEX_GEOCODER_KEY
    if key and len(out) < 10:
        try:
            import urllib.parse
            import urllib.request
            import json as _json
            params = urllib.parse.urlencode({"apikey": key, "geocode": q, "format": "json", "results": 5, "lang": "ru_RU"})
            with urllib.request.urlopen(f"https://geocode-maps.yandex.ru/v1/?{params}", timeout=5) as r:
                data = _json.load(r)
            for f in data.get("response", {}).get("GeoObjectCollection", {}).get("featureMember", []):
                g = f.get("GeoObject", {})
                pos = g.get("Point", {}).get("pos", "").split()
                if len(pos) != 2:
                    continue
                meta = g.get("metaDataProperty", {}).get("GeocoderMetaData", {})
                out.append({
                    "id": 0, "name": g.get("name", q),
                    "address": meta.get("text"),
                    "district": None,
                    "street": None,
                    "lat": float(pos[1]), "lng": float(pos[0]),
                    "yandex_kind": "address", "preview_url": None,
                })
                if len(out) >= 10:
                    break
        except Exception:
            pass
    # Nominatim (OpenStreetMap) — бесплатный геокодер без ключа, 1 req/s
    if len(out) < 10:
        try:
            import urllib.parse
            import urllib.request
            import json as _json
            params = urllib.parse.urlencode({"q": q, "format": "json", "limit": 5, "accept-language": "ru", "countrycodes": "ru"})
            req = urllib.request.Request(
                f"https://nominatim.openstreetmap.org/search?{params}",
                headers={"User-Agent": "zakoulki-app/1.0"},
            )
            with urllib.request.urlopen(req, timeout=5) as r:
                data = _json.load(r)
            for item in data:
                addr = item.get("address", {})
                out.append({
                    "id": 0, "name": item.get("display_name", q).split(",")[0],
                    "address": item.get("display_name"),
                    "district": addr.get("city") or addr.get("town") or addr.get("district"),
                    "street": addr.get("road"),
                    "lat": float(item.get("lat", 0)), "lng": float(item.get("lon", 0)),
                    "yandex_kind": "address", "preview_url": None,
                })
                if len(out) >= 10:
                    break
        except Exception:
            pass
    return out


@router.post("", status_code=201)
def create_place(data: GeoPlaceCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = GeoPlace(**data.model_dump(), created_by=user.id)
    db.add(p); db.commit(); db.refresh(p)
    return _out(p)


@router.get("/reverse")
def reverse_geocode(lat: float, lng: float):
    """Координаты -> человеческий адрес (Nominatim, бесплатно). Для превью геолокации."""
    try:
        import urllib.parse
        import urllib.request
        import json as _json
        params = urllib.parse.urlencode({"lat": lat, "lon": lng, "format": "json", "accept-language": "ru"})
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={"User-Agent": "zakoulki-app/1.0"},
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            data = _json.load(r)
        addr = data.get("address", {})
        disp = data.get("display_name", "")
        return {
            "name": addr.get("road", addr.get("suburb", addr.get("city", disp.split(",")[0] if disp else "Точка на карте"))),
            "address": disp or None,
            "district": addr.get("city") or addr.get("town") or addr.get("borough"),
            "street": addr.get("road"),
            "lat": lat, "lng": lng,
        }
    except Exception:
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
        cover_url = None
        if cover:
            import os as _os
            from app.core.config import settings as _settings
            pv = f"pv_{cover.file_name}"
            cover_url = f"/uploads/{pv}" if _os.path.exists(_os.path.join(_settings.UPLOAD_DIR, pv)) else f"/uploads/{cover.file_name}"
        out.append({"id": t.id, "lat": t.place.latitude, "lng": t.place.longitude,
                    "is_offtop": t.is_offtop,
                    "comments": t.comments_count,
                    "has_photo": cover is not None,
                    "cover_url": cover_url})
    return out


@router.get("/{place_id}")
def get_place(place_id: int, db: Session = Depends(get_db)):
    p = db.get(GeoPlace, place_id)
    if not p:
        from fastapi import HTTPException
        raise HTTPException(404, "Место не найдено")
    return _out(p)
