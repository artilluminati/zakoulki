"""Отправка писем через SMTP.

Почта включается флагом MAIL_ENABLED. Пока выключена — письма не уходят,
но письма-уведомления считаются «неотправленными» и в интерфейсе это видно.
"""
import asyncio
import logging
import re
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger("zakoulki.mail")


def _plain(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&laquo;", "«").replace("&raquo;", "»")
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _send_sync(to: str, subject: str, html: str) -> None:
    sender = settings.MAIL_FROM or settings.MAIL_USER
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.MAIL_FROM_NAME} <{sender}>"
    msg["To"] = to
    msg.set_content(_plain(html))
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.MAIL_HOST, settings.MAIL_PORT, timeout=settings.MAIL_TIMEOUT) as smtp:
        if settings.MAIL_USE_TLS:
            smtp.starttls(context=ssl.create_default_context())
        smtp.login(settings.MAIL_USER, settings.MAIL_PASSWORD)
        smtp.send_message(msg)


async def send_email(to: str | None, subject: str, html: str) -> bool:
    """Отправляет письмо. Возвращает True, если письмо ушло."""
    if not to:
        return False
    if not settings.MAIL_ENABLED or not settings.MAIL_USER:
        log.info("почта выключена — письмо «%s» на %s не отправлено", subject, to)
        return False
    try:
        await asyncio.to_thread(_send_sync, to, subject, html)
        log.info("письмо «%s» отправлено на %s", subject, to)
        return True
    except Exception as exc:  # noqa: BLE001 — письмо не должно ронять основной запрос
        log.warning("не удалось отправить письмо на %s: %s", to, exc)
        return False
