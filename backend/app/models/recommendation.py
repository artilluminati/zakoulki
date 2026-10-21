from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

REC_PENDING = "pending"
REC_PUBLISHED = "published"
REC_REJECTED = "rejected"
REC_EXPIRED = "expired"

REC_TOPICS = {
    "zhkh": "ЖКХ",
    "repair": "Ремонт",
    "law": "Юридическая помощь",
    "transport": "Транспорт",
    "other": "Другое",
}


class Recommendation(Base):
    """Рекомендация в блоке «Кто поможет» — оплачивается донатом."""

    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact: Mapped[str] = mapped_column(String(150))
    url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    topic: Mapped[str] = mapped_column(String(30), default="other", index=True)
    status: Mapped[str] = mapped_column(String(20), default=REC_PENDING, index=True)
    donation_id: Mapped[int | None] = mapped_column(ForeignKey("donations.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
