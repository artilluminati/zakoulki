"""Заявки администраций и организаций на официальный аккаунт."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

ORG_ADMINISTRATION = "administration"
ORG_ORGANIZATION = "organization"

ORG_KINDS = {
    ORG_ADMINISTRATION: "Администрация",
    ORG_ORGANIZATION: "Организация",
}

APP_PENDING = "pending"
APP_APPROVED = "approved"
APP_REJECTED = "rejected"

APP_STATUSES = {
    APP_PENDING: "на проверке",
    APP_APPROVED: "одобрена",
    APP_REJECTED: "отклонена",
}

ACCOUNT_NEW = "new"          # аккаунт создаётся прямо в форме
ACCOUNT_EXISTING = "existing"  # у заявителя уже есть аккаунт


class OrgApplication(Base):
    """Заявка на верификацию: администрация или организация хочет официальный аккаунт."""

    __tablename__ = "org_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30), default=ORG_ORGANIZATION, index=True)
    org_name: Mapped[str] = mapped_column(String(150))
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    contact_name: Mapped[str] = mapped_column(String(120))
    contact_email: Mapped[str] = mapped_column(String(255), index=True)
    contact_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)

    account_mode: Mapped[str] = mapped_column(String(20), default=ACCOUNT_NEW)
    existing_account: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    status: Mapped[str] = mapped_column(String(20), default=APP_PENDING, index=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
