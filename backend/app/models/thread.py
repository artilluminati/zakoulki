from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Integer, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

thread_categories = Table(
    "thread_categories",
    Base.metadata,
    Column("thread_id", Integer, ForeignKey("threads.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


class Thread(Base):
    """Один тред v5: вопрос (с точкой) или оффтоп (без). Без жестких kind."""

    __tablename__ = "threads"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)  # опционально, Q3: большинство без заголовка
    body_md: Mapped[str] = mapped_column(Text)
    body_html: Mapped[str] = mapped_column(Text, default="")
    is_offtop: Mapped[bool] = mapped_column(Boolean, default=True)
    # важные посты: по умолчанию все оффтоп; автор жмет «Важный пост» -> на рассмотрении;
    # N голосов пользователей -> автоматически важный
    is_important: Mapped[bool] = mapped_column(Boolean, default=False)
    important_pinned: Mapped[bool] = mapped_column(Boolean, default=False)  # принудительно от админа, голоса не снимают
    important_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    important_votes: Mapped[int] = mapped_column(Integer, default=0)
    place_id: Mapped[int | None] = mapped_column(ForeignKey("geo_places.id"), nullable=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author = relationship("User", back_populates="threads")
    place = relationship("GeoPlace")
    categories = relationship("Category", secondary=thread_categories)
    comments = relationship("ThreadComment", back_populates="thread", cascade="all, delete-orphan")
