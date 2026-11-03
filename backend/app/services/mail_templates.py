"""Шаблоны писем. Один стиль на все письма, чтобы выглядело одним продуктом."""
from app.core.config import settings

GREEN = "#047857"
DARK = "#0f172a"
MUTED = "#64748b"
BORDER = "#e2e8f0"


def _wrap(title: str, body: str, cta: str = "", cta_url: str = "") -> str:
    button = ""
    if cta and cta_url:
        button = f"""
        <p style="margin:26px 0">
          <a href="{cta_url}" style="background:{GREEN};color:#ffffff;text-decoration:none;
             padding:12px 22px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block">
            {cta}
          </a>
        </p>
        <p style="margin:0;color:{MUTED};font-size:12px">Если кнопка не работает — скопируйте ссылку:<br>
          <span style="color:{DARK}">{cta_url}</span>
        </p>"""

    return f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid {BORDER};border-radius:18px;overflow:hidden">
        <tr><td style="padding:22px 28px;border-bottom:1px solid {BORDER}">
          <span style="font-size:18px;font-weight:800;color:{DARK}">Закоулки</span>
          <span style="font-size:13px;color:{MUTED}"> · рядом обсуждают то, что важно</span>
        </td></tr>
        <tr><td style="padding:26px 28px">
          <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:{DARK}">{title}</h1>
          {body}
          {button}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid {BORDER};
                    color:{MUTED};font-size:12px;line-height:1.5">
          Вы получили это письмо, потому что зарегистрировались на {settings.SITE_URL}
          или подписались на уведомления.<br>
          <a href="{settings.SITE_URL}/about" style="color:{MUTED}">О проекте</a> ·
          <a href="{settings.SITE_URL}/data" style="color:{MUTED}">Источники данных</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def password_reset(user_name: str, token: str) -> tuple[str, str]:
    url = f"{settings.SITE_URL}/reset-password?token={token}"
    body = f"""
      <p style="margin:0 0 12px;color:{DARK};font-size:15px;line-height:1.6">
        {user_name}, для вашего аккаунта запрошено восстановление пароля.
        Нажмите кнопку — задайте новый пароль. Ссылка действует 1 час.
      </p>
      <p style="margin:0;color:{MUTED};font-size:14px;line-height:1.6">
        Если вы этого не делали — просто проигнорируйте письмо, пароль не изменится.
      </p>"""
    return ("Восстановление пароля — Закоулки", _wrap("Восстановление пароля", body, "Сменить пароль", url))


def mention(author: str, thread_title: str, snippet: str, thread_id: int) -> tuple[str, str]:
    url = f"{settings.SITE_URL}/thread/{thread_id}"
    body = f"""
      <p style="margin:0 0 12px;color:{DARK};font-size:15px;line-height:1.6">
        <b>{author}</b> упомянул(а) вас в обсуждении
        {f'<b>«{thread_title}»</b>' if thread_title else ''}.
      </p>
      <p style="margin:0;padding:12px 14px;background:#f8fafc;border-left:3px solid {GREEN};
                color:{DARK};font-size:14px;line-height:1.5">{snippet}</p>"""
    return ("Вас упомянули — Закоулки", _wrap("Вас упомянули", body, "Открыть обсуждение", url))


def reply(author: str, thread_title: str, snippet: str, thread_id: int) -> tuple[str, str]:
    url = f"{settings.SITE_URL}/thread/{thread_id}"
    body = f"""
      <p style="margin:0 0 12px;color:{DARK};font-size:15px;line-height:1.6">
        <b>{author}</b> ответил(а) вам в вашем обсуждении
        {f'<b>«{thread_title}»</b>' if thread_title else ''}.
      </p>
      <p style="margin:0;padding:12px 14px;background:#f8fafc;border-left:3px solid {GREEN};
                color:{DARK};font-size:14px;line-height:1.5">{snippet}</p>"""
    return ("Новый ответ — Закоулки", _wrap("Вам ответили", body, "Прочитать ответ", url))


def donation_thanks(amount: int, purpose: str) -> tuple[str, str]:
    url = f"{settings.SITE_URL}/donate"
    body = f"""
      <p style="margin:0 0 12px;color:{DARK};font-size:15px;line-height:1.6">
        Спасибо! Мы получили вашу поддержку — <b>{amount} ₽</b>.
      </p>
      <p style="margin:0;color:{MUTED};font-size:14px;line-height:1.6">
        Назначение: {purpose}. Бейдж «Спонсор проекта» уже появился в вашем профиле.
        Если вы оплачивали размещение рекомендации — модератор опубликует её после проверки.
      </p>"""
    return ("Спасибо за поддержку — Закоулки", _wrap("Спасибо за поддержку", body, "Поддержать ещё раз", url))


def welcome(user_name: str) -> tuple[str, str]:
    url = f"{settings.SITE_URL}"
    body = f"""
      <p style="margin:0 0 12px;color:{DARK};font-size:15px;line-height:1.6">
        {user_name}, добро пожаловать в «Закоулки» — здесь обсуждают то, что происходит рядом:
        дворы, дороги, ЖКХ, городские новости.
      </p>
      <p style="margin:0;color:{MUTED};font-size:14px;line-height:1.6">
        Начните с карты или ленты — там видно, что происходит в вашем районе.
      </p>"""
    return ("Добро пожаловать в Закоулки", _wrap("Добро пожаловать", body, "Открыть ленту", url))
