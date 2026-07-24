from datetime import datetime

from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, Table, Column, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

place_categories = Table(
    "place_categories",
    Base.metadata,
    Column("place_id", Integer, ForeignKey("places.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    city = relationship("City", back_populates="places")
    author = relationship("User", back_populates="places")
    categories = relationship("Category", secondary=place_categories)
    posts = relationship(
        "Post",
        back_populates="place",
        cascade="all, delete-orphan",
        order_by="Post.created_at",
    )

    @property
    def cover_photo(self):
        """Первая фотография первой публикации — используется как превью
        места в балуне на карте. По правилам сервиса первая публикация
        всегда создаётся хотя бы с одной фотографией, но на случай, если
        она когда-нибудь окажется без фото, ищем дальше по остальным постам."""
        for post in self.posts:
            if post.photos:
                return post.photos[0]
        return None
