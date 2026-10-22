from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Куда уходят деньги
PURPOSE_PROJECT = "project"                # поддержка проекта просто так
PURPOSE_RECOMMENDATION = "recommendation"  # оплата размещения рекомендации («кто поможет»)

PURPOSE_LABELS = {
    PURPOSE_PROJECT: "На поддержку проекта",
    PURPOSE_RECOMMENDATION: "За рекомендацию в разделе «Кто поможет»",
}

STATUS_PENDING = "pending"
STATUS_PAID = "paid"
STATUS_FAILED = "failed"
STATUS_REFUNDED = "refunded"


class Donation(Base):
    """Донат через ЮKassa (провайдер сменимый)."""

    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    amount: Mapped[int] = mapped_column(Integer)  # рубли
    currency: Mapped[str] = mapped_column(String(8), default="RUB")
    purpose: Mapped[str] = mapped_column(String(30), default=PURPOSE_PROJECT, index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    donor_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    donor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    provider: Mapped[str] = mapped_column(String(30), default="yookassa")
    provider_payment_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=STATUS_PENDING, index=True)
    receipt_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    badge_granted: Mapped[bool] = mapped_column(Boolean, default=False)
    recommendation_id: Mapped[int | None] = mapped_column(
        ForeignKey("recommendations.id", ondelete="SET NULL", use_alter=True), nullable=True)
    # заготовка рекомендации, которую создадим после успешной оплаты
    recommendation_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
