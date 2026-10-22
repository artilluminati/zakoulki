"""Письма-уведомления. Отправка не должна ломать основной запрос —
все ошибки гасятся внутри mailer."""
import logging

from app.models.user import User
from app.services import mail_templates
from app.services.mailer import send_email

log = logging.getLogger("zakoulki.notify")


def _wants_mail(user) -> bool:
    """Принимает и User, и простой словарь {email, username}."""
    if user is None:
        return False
    if isinstance(user, dict):
        return bool(user.get("email"))
    return bool(user.email and getattr(user, "email_notifications", True))


async def notify_mention(user, author_name: str, thread_title: str | None,
                         snippet: str, thread_id: int) -> None:
    if not _wants_mail(user):
        return
    subject, html = mail_templates.mention(author_name, thread_title or "", snippet, thread_id)
    await send_email(user["email"] if isinstance(user, dict) else user.email, subject, html)


async def notify_reply(user, author_name: str, thread_title: str | None,
                       snippet: str, thread_id: int) -> None:
    if not _wants_mail(user):
        return
    subject, html = mail_templates.reply(author_name, thread_title or "", snippet, thread_id)
    await send_email(user["email"] if isinstance(user, dict) else user.email, subject, html)


async def notify_donation(user: User | None, amount: int, purpose_label: str) -> None:
    if not user:
        return
    subject, html = mail_templates.donation_thanks(amount, purpose_label)
    await send_email(user.email, subject, html)


async def notify_welcome(user: User | None) -> None:
    if not user or not user.email:
        return
    subject, html = mail_templates.welcome(user.username)
    await send_email(user.email, subject, html)
