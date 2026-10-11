from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HubModerator(Base):
    """Модераторы раздела: автор раздела и назначенные им (или админом) жители."""

    __tablename__ = "hub_moderators"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    hub_id: Mapped[int] = mapped_column(ForeignKey("threads.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
