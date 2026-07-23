import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.place import Place
from app.models.category import Category
from app.models.city import City
from app.models.user import User
from app.schemas.place import PlaceCreate, PlaceUpdate, PlaceOut, PlaceDetailOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/places", tags=["places"])


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    return re.sub(r"[\s_-]+", "-", text) or "mesto"


@router.get("", response_model=list[PlaceOut])
def list_places(
    city: str | None = Query(None, description="slug города"),
    category: str | None = Query(None, description="slug категории"),
    search: str | None = Query(None),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    radius: float | None = Query(None, description="радиус в километрах"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Place)
    if city:
        q = q.join(City).filter(City.slug == city)
    if category:
        q = q.join(Place.categories).filter(Category.slug == category)
    if search:
        q = q.filter(Place.title.ilike(f"%{search}%"))
    if lat is not None and lng is not None and radius is not None:
        # Приближённая фильтрация по bounding box — для MVP этого достаточно,
        # позже можно заменить на PostGIS ST_DWithin
        delta = radius / 111.0
        q = q.filter(Place.latitude.between(lat - delta, lat + delta))
        q = q.filter(Place.longitude.between(lng - delta, lng + delta))
    q = q.order_by(Place.created_at.desc())
    return q.offset((page - 1) * limit).limit(limit).all()


@router.get("/{place_id}", response_model=PlaceDetailOut)
def get_place(place_id: int, db: Session = Depends(get_db)):
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(404, "Место не найдено")
    return place


@router.post("", response_model=PlaceOut, status_code=201)
def create_place(
    data: PlaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_slug = slugify(data.title)
    slug = base_slug
    i = 1
    while db.query(Place).filter(Place.slug == slug).first():
        i += 1
        slug = f"{base_slug}-{i}"

    place = Place(
        city_id=data.city_id,
        created_by=current_user.id,
        title=data.title,
        slug=slug,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    if data.category_ids:
        place.categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()

    db.add(place)
    db.commit()
    db.refresh(place)
    return place


@router.patch("/{place_id}", response_model=PlaceOut)
def update_place(
    place_id: int,
    data: PlaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(404, "Место не найдено")
    if place.created_by != current_user.id:
        raise HTTPException(403, "Недостаточно прав")

    for field in ("title", "latitude", "longitude"):
        value = getattr(data, field)
        if value is not None:
            setattr(place, field, value)
    if data.category_ids is not None:
        place.categories = db.query(Category).filter(Category.id.in_(data.category_ids)).all()

    db.commit()
    db.refresh(place)
    return place


@router.delete("/{place_id}", status_code=204)
def delete_place(
    place_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(404, "Место не найдено")
    if place.created_by != current_user.id:
        raise HTTPException(403, "Недостаточно прав")
    db.delete(place)
    db.commit()
