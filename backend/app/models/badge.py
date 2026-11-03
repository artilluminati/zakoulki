from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Типы бейджей. У пользователя их может быть несколько одновременно.
BADGE_OFFICIAL = "official"   # официальная организация (верификация админом)
BADGE_SPONSOR = "sponsor"     # поддержал проект деньгами (единственный денежный бейдж)
BADGE_OP = "op"               # автор ветки / раздела

BADGE_LABELS = {
    BADGE_OFFICIAL: "Официальная организация",
    BADGE_SPONSOR: "Спонсор проекта",
    BADGE_OP: "Автор раздела",
}

BADGE_ICONS = {
    BADGE_OFFICIAL: "shield",
    BADGE_SPONSOR: "star",
    BADGE_OP: "crown",
}


class UserBadge(Base):
    """Бейдж пользователя. Несколько бейджей могут быть одновременно."""

    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "kind", name="uq_user_badges_user_kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    label: Mapped[str | None] = mapped_column(String(80), nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    granted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
