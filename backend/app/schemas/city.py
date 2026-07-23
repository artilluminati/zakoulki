from pydantic import BaseModel, ConfigDict


class CityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    country: str | None = None
    center_lat: float
    center_lng: float
    default_zoom: int
