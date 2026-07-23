from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.category import CategoryOut
from app.schemas.post import PostOut


class PlaceCreate(BaseModel):
    city_id: int
    title: str
    latitude: float
    longitude: float
    category_ids: list[int] = []


class PlaceUpdate(BaseModel):
    title: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    category_ids: list[int] | None = None


class PlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    city_id: int
    created_by: int
    title: str
    slug: str
    latitude: float
    longitude: float
    is_verified: bool
    created_at: datetime
    categories: list[CategoryOut] = []


class PlaceDetailOut(PlaceOut):
    posts: list[PostOut] = []
