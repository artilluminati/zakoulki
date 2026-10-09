from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    center_lat: Mapped[float] = mapped_column(Float)
    center_lng: Mapped[float] = mapped_column(Float)
    default_zoom: Mapped[int] = mapped_column(Integer, default=13)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
