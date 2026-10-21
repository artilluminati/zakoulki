"""Клиент ЮKassa (REST API). Работает и в тестовом, и в боевом режиме —
разница только в shop_id/secret_key."""
import logging
from decimal import Decimal

import httpx

from app.core.config import settings

log = logging.getLogger("zakoulki.yookassa")

API_BASE = "https://api.yookassa.ru/v3"


class YooKassaError(Exception):
    pass


def _auth() -> tuple[str, str]:
    if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
        raise YooKassaError("ЮKassa не настроена: задайте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY")
    return settings.YOOKASSA_SHOP_ID, settings.YOOKASSA_SECRET_KEY


async def create_payment(
    amount: int,
    description: str,
    return_url: str,
    metadata: dict | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """Создаёт платёж и возвращает его карточку (в т.ч. confirmation_url)."""
    payload = {
        "amount": {"value": f"{Decimal(amount):.2f}", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": description[:128],
    }
    if metadata:
        payload["metadata"] = {str(k): str(v) for k, v in metadata.items()}

    headers = {"Idempotence-Key": idempotency_key} if idempotency_key else {}
    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.post(
            f"{API_BASE}/payments",
            json=payload,
            auth=_auth(),
            headers=headers,
        )
    if resp.status_code >= 400:
        log.warning("ЮKassa отклонила платёж: %s %s", resp.status_code, resp.text[:400])
        raise YooKassaError(f"ЮKassa: {resp.status_code} {resp.text[:200]}")
    return resp.json()


async def get_payment(payment_id: str) -> dict | None:
    """Карточка платежа. None — если платёжа нет или провайдер недоступен."""
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.get(f"{API_BASE}/payments/{payment_id}", auth=_auth())
    except Exception as exc:  # noqa: BLE001
        log.warning("не удалось получить платёж %s: %s", payment_id, exc)
        return None
    if resp.status_code != 200:
        return None
    return resp.json()


def is_paid(payment: dict | None) -> bool:
    return bool(payment) and payment.get("status") == "succeeded"


def confirmation_url(payment: dict) -> str | None:
    conf = payment.get("confirmation") or {}
    return conf.get("confirmation_url")


def receipt_url(payment: dict) -> str | None:
    return payment.get("receipt_url") or payment.get("voucher_code")
