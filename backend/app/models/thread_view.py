from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ThreadView(Base):
    """Дедуп просмотров: один зритель — один засчитанный просмотр в 24 часа."""

    __tablename__ = "thread_views"

    thread_id: Mapped[int] = mapped_column(ForeignKey("threads.id", ondelete="CASCADE"), primary_key=True)
    viewer: Mapped[str] = mapped_column(String(64), primary_key=True)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
