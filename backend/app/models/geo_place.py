from datetime import datetime, timezone

from sqlalchemy import String, Float, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GeoPlace(Base):
    """Место v5: адрес/орга из Яндекс.Карт или своя точка. НЕ Place v1."""

    __tablename__ = "geo_places"

    id: Mapped[int] = mapped_column(primary_key=True)
    yandex_kind: Mapped[str] = mapped_column(String(20), default="self")  # address|org|geo|self
    yandex_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    district: Mapped[str | None] = mapped_column(String(200), nullable=True)
    street: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # иерархия для глобального фильтра: район → город/округ → регион → страна (с индексами под масштаб)
    city: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    region: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    # территория: полигон [[lat, lng], ...] минимум 3 точки (JSON). Центр — в lat/lng.
    area_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now(timezone.utc))

    author = relationship("User", back_populates="places")
