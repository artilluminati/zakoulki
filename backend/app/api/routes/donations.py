"""Донаты. Пока только ЮKassa и только поддержка проекта / размещение рекомендации.

Поток: фронт просит создать донат → бэк создаёт платёж в ЮKassa и отдаёт ссылку
на оплату → пользователь оплачивает → ЮKassa шлёт вебхук → бэк подтверждает
оплату (сверяясь с самим платежом в API), выдаёт бейдж и, если была заявка
на рекомендацию, создаёт её на модерацию.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user
from app.core.config import settings
from app.db.session import get_db
from app.models.badge import BADGE_SPONSOR
from app.models.donation import (
    PURPOSE_LABELS,
    PURPOSE_PROJECT,
    PURPOSE_RECOMMENDATION,
    STATUS_FAILED,
    STATUS_PAID,
    STATUS_PENDING,
    Donation,
)
from app.models.recommendation import REC_PENDING, Recommendation
from app.models.user import User
from app.services import badges as badge_service
from app.services import email_notify, yookassa
from app.services.yookassa import YooKassaError

log = logging.getLogger("zakoulki.donations")

router = APIRouter(prefix="/donations", tags=["donations"])


class RecommendationPayload(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    contact: str = Field(min_length=3, max_length=150)
    url: str | None = Field(default=None, max_length=255)
    topic: str = Field(default="other", pattern="^(zhkh|repair|law|transport|other)$")


class DonationCreate(BaseModel):
    amount: int = Field(ge=1, le=1_000_000)
    purpose: str = Field(default=PURPOSE_PROJECT, pattern="^(project|recommendation)$")
    message: str | None = Field(default=None, max_length=1000)
    donor_name: str | None = Field(default=None, max_length=120)
    recommendation: RecommendationPayload | None = None


def _donation_out(d: Donation) -> dict:
    return {
        "id": d.id,
        "amount": d.amount,
        "currency": d.currency,
        "purpose": d.purpose,
        "purpose_label": PURPOSE_LABELS.get(d.purpose, d.purpose),
        "message": d.message,
        "status": d.status,
        "badge_granted": d.badge_granted,
        "receipt_url": d.receipt_url,
        "recommendation_id": d.recommendation_id,
        "created_at": d.created_at,
        "paid_at": d.paid_at,
    }


@router.post("", status_code=201)
async def create_donation(data: DonationCreate, db: Session = Depends(get_db),
                          user: User | None = Depends(get_optional_user)):
    """Создаёт платёж в ЮKassa и отдаёт ссылку на оплату."""
    if not settings.YOOKASSA_ENABLED:
        raise HTTPException(503, "Приём платежей пока не настроен")
    if data.amount < settings.DONATION_MIN or data.amount > settings.DONATION_MAX:
        raise HTTPException(400, f"Сумма доната — от {settings.DONATION_MIN} до {settings.DONATION_MAX} ₽")
    if data.purpose == PURPOSE_RECOMMENDATION:
        # Раздел «Кто поможет» пока в разработке: принимаем только донаты на проект.
        raise HTTPException(503, "Раздел рекомендаций пока в разработке — сейчас можно поддержать только проект")

    donation = Donation(
        user_id=user.id if user else None,
        amount=data.amount,
        purpose=data.purpose,
        message=data.message,
        donor_name=data.donor_name or (user.username if user else None),
        donor_email=user.email if user else None,
        status=STATUS_PENDING,
        recommendation_payload=data.recommendation.model_dump() if data.recommendation else None,
    )
    db.add(donation)
    db.flush()

    return_url = settings.YOOKASSA_RETURN_URL or f"{settings.SITE_URL}/donate?paid=1"
    description = f"Поддержка проекта «Закоулки» — {data.amount} ₽"
    if data.purpose == PURPOSE_RECOMMENDATION:
        description = "Размещение рекомендации в разделе «Кто поможет»"

    try:
        payment = await yookassa.create_payment(
            amount=data.amount,
            description=description,
            return_url=return_url,
            metadata={"donation_id": donation.id, "purpose": data.purpose, "user_id": user.id if user else ""},
            idempotency_key=f"donation-{donation.id}",
        )
    except YooKassaError as exc:
        db.delete(donation)
        db.commit()
        raise HTTPException(502, f"Платёж не создан: {exc}")

    donation.provider_payment_id = payment.get("id")
    db.commit()
    db.refresh(donation)

    return {
        **_donation_out(donation),
        "confirmation_url": yookassa.confirmation_url(payment),
        "provider": "yookassa",
    }


@router.post("/webhook")
async def yookassa_webhook(payload: dict, background: BackgroundTasks,
                            db: Session = Depends(get_db)):
    """Вебхук ЮKassa. Платёж дополнительно сверяется с API провайдера."""
    event = payload.get("event") or ""
    obj = payload.get("object") or {}
    payment_id = obj.get("id")
    if not payment_id:
        return {"ok": True}

    donation = db.query(Donation).filter(Donation.provider_payment_id == payment_id).first()
    if donation is None:
        meta = obj.get("metadata") or {}
        raw_id = meta.get("donation_id")
        if raw_id:
            try:
                donation = db.get(Donation, int(raw_id))
            except (TypeError, ValueError):
                donation = None
    if donation is None:
        return {"ok": True}

    if event == "payment.succeeded":
        payment = await yookassa.get_payment(payment_id)
        if not yookassa.is_paid(payment):
            return {"ok": False, "detail": "платёж не подтверждён провайдером"}
        try:
            paid_amount = float((payment.get("amount") or {}).get("value") or 0)
        except (TypeError, ValueError):
            paid_amount = 0.0
        if abs(paid_amount - float(donation.amount)) > 0.01:
            return {"ok": False, "detail": "сумма платежа не совпадает с суммой доната"}

        if donation.status != STATUS_PAID:
            donation.status = STATUS_PAID
            donation.paid_at = datetime.now(timezone.utc)
            donation.receipt_url = yookassa.receipt_url(payment)

            donor = None
            if donation.user_id:
                donor = db.get(User, donation.user_id)
            elif donation.donor_email:
                donor = db.query(User).filter(User.email == donation.donor_email).first()

            if donor and donation.amount >= settings.DONATION_BADGE_MIN:
                # Денежный бейдж один — «Спонсор проекта», без младших ступеней.
                badge_service.grant_badge(
                    db, donor.id, BADGE_SPONSOR, meta={"amount": donation.amount, "purpose": donation.purpose}
                )
                donation.badge_granted = True

            if donation.purpose == PURPOSE_RECOMMENDATION and donation.recommendation_payload:
                payload_rec = donation.recommendation_payload
                rec = Recommendation(
                    user_id=donation.user_id,
                    title=payload_rec.get("title", "Рекомендация"),
                    description=payload_rec.get("description"),
                    contact=payload_rec.get("contact", ""),
                    url=payload_rec.get("url"),
                    topic=payload_rec.get("topic", "other"),
                    status=REC_PENDING,
                    donation_id=donation.id,
                )
                db.add(rec)
                db.flush()
                donation.recommendation_id = rec.id

            db.commit()

            if donor:
                background and background.add_task(
                    email_notify.notify_donation, donor, donation.amount,
                    PURPOSE_LABELS.get(donation.purpose, donation.purpose),
                )

    elif event in ("payment.canceled", "payment.failed"):
        if donation.status == STATUS_PENDING:
            donation.status = STATUS_FAILED
            db.commit()

    return {"ok": True}


@router.get("/mine")
def my_donations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = db.query(Donation).filter(Donation.user_id == user.id).order_by(Donation.id.desc()).limit(50).all()
    return [_donation_out(d) for d in items]


@router.get("/{donation_id}")
def get_donation(donation_id: int, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    d = db.get(Donation, donation_id)
    if not d:
        raise HTTPException(404, "Донат не найден")
    if d.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Нет доступа")
    return _donation_out(d)
