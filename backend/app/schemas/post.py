from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.photo import PhotoOut


class PostCreate(BaseModel):
    place_id: int
    title: str
    text: str


class PostUpdate(BaseModel):
    title: str | None = None
    text: str | None = None


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    place_id: int
    author_id: int
    title: str
    text: str
    created_at: datetime
    photos: list[PhotoOut] = []
