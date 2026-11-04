"""Демо-почтовый ящик: каждый пользователь «Закоулок» видит письма на свой email.

Зачем: на стенде боевой SMTP недоступен (сеть блокирует исходящие письма),
поэтому письма складываются в локальный Mailpit. Наружу отдаём только этот
сервис: он пускает по логину и паролю «Закоулок» и показывает письма,
адресованные email этого пользователя. Сам Mailpit остаётся на localhost.

Запуск: uvicorn app.mailbox:app --host 127.0.0.1 --port 8090
"""
import html
import os
import secrets
import time
from datetime import datetime

import httpx
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.core.security import verify_password
from app.db.session import SessionLocal
from app.models.user import User

MAILPIT_API = os.getenv("MAILPIT_API", "http://127.0.0.1:8025").rstrip("/")
SESSION_TTL = 12 * 3600  # 12 часов
COOKIE = "zk_mail"

app = FastAPI(title="Закоулки — демо-почта", docs_url=None, redoc_url=None, openapi_url=None)

# Простые сессии в памяти процесса: после рестарта сервиса нужно войти заново.
_sessions: dict[str, dict] = {}


# --------------------------------------------------------------------------
# Простая вёрстка страниц
# --------------------------------------------------------------------------

PAGE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Закоулки</title>
<style>
  :root {{ color-scheme: light dark; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: #f1f5f9; color: #0f172a;
         font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
  a {{ color: #047857; }}
  .wrap {{ max-width: 720px; margin: 0 auto; padding: 20px 14px 48px; }}
  .top {{ display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }}
  .logo {{ display: inline-flex; width: 32px; height: 32px; border-radius: 10px;
           background: #a3e635; color: #0f172a; font-weight: 800;
           align-items: center; justify-content: center; }}
  .top b {{ font-size: 16px; }}
  .top .out {{ margin-left: auto; font-size: 13px; }}
  .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 18px;
           padding: 16px; box-shadow: 0 1px 2px rgba(15,23,42,.05); }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  .muted {{ color: #64748b; font-size: 13px; }}
  label {{ display: block; margin: 12px 0 4px; font-weight: 600; font-size: 13px; }}
  input {{ width: 100%; height: 44px; border: 1px solid #cbd5e1; border-radius: 12px;
           padding: 0 12px; font-size: 15px; background: #f8fafc; }}
  button {{ height: 46px; width: 100%; margin-top: 16px; border: 0; border-radius: 12px;
            background: #059669; color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; }}
  button:hover {{ background: #047857; }}
  .err {{ background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
          border-radius: 12px; padding: 10px 12px; font-size: 14px; margin-top: 12px; }}
  .note {{ background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46;
           border-radius: 12px; padding: 10px 12px; font-size: 13px; margin-bottom: 14px; }}
  .mail {{ display: block; padding: 12px 14px; border-bottom: 1px solid #e2e8f0;
           text-decoration: none; color: inherit; }}
  .mail:last-child {{ border-bottom: 0; }}
  .mail:hover {{ background: #f8fafc; }}
  .mail .subj {{ font-weight: 700; }}
  .mail .from {{ color: #64748b; font-size: 13px; }}
  .mail .when {{ color: #94a3b8; font-size: 12px; }}
  .meta {{ margin: 0 0 14px; padding: 0; list-style: none; font-size: 13px; color: #475569; }}
  .meta li {{ margin: 2px 0; }}
  iframe {{ width: 100%; min-height: 65vh; border: 0; border-radius: 12px; background: #fff; }}
  @media (prefers-color-scheme: dark) {{
    body {{ background: #0f172a; color: #e2e8f0; }}
    .card, .mail:hover {{ background: #1e293b; border-color: #334155; }}
    .mail {{ border-color: #334155; }}
    input {{ background: #0f172a; border-color: #475569; color: #e2e8f0; }}
    .muted, .mail .from, .mail .when, .meta {{ color: #94a3b8; }}
  }}
</style>
</head>
<body><div class="wrap">{body}</div></body>
</html>"""


def _page(title: str, body: str, status_code: int = 200) -> HTMLResponse:
    return HTMLResponse(PAGE.format(title=title, body=body), status_code=status_code)


def _header(email: str | None) -> str:
    out = f'<a class="out" href="/logout">Выйти</a>' if email else ""
    return (
        '<div class="top"><span class="logo">З</span><b>Демо-почта</b>'
        f'<span class="muted">{email or ""}</span>{out}</div>'
    )


# --------------------------------------------------------------------------
# Сессии
# --------------------------------------------------------------------------

def _session_email(request: Request) -> str | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    data = _sessions.get(token)
    if not data:
        return None
    if data["exp"] < time.time():
        _sessions.pop(token, None)
        return None
    return data["email"]


def _login_page(error: str | None = None) -> HTMLResponse:
    err = f'<div class="err">{html.escape(error)}</div>' if error else ""
    body = _header(None) + (
        '<div class="card">'
        '<h1>Демо-почта «Закоулок»</h1>'
        '<p class="muted">Войдите тем же логином и паролем, что и на сайте, — '
        'покажем письма, которые пришли на ваш email.</p>'
        '<form method="post" action="/login">'
        '<label for="login">Email или ник</label>'
        '<input id="login" name="login" autocomplete="username" required autofocus>'
        '<label for="password">Пароль</label>'
        '<input id="password" name="password" type="password" autocomplete="current-password" required>'
        f'{err}'
        '<button type="submit">Войти</button>'
        '</form></div>'
    )
    return _page("Вход", body)


# --------------------------------------------------------------------------
# Работа с Mailpit
# --------------------------------------------------------------------------

def _mailpit(path: str) -> dict:
    with httpx.Client(timeout=10) as client:
        resp = client.get(f"{MAILPIT_API}{path}")
        resp.raise_for_status()
        return resp.json()


def _recipients(msg: dict) -> list[str]:
    return [str(t.get("Address", "")).lower() for t in (msg.get("To") or [])]


def _when(iso: str | None) -> str:
    if not iso:
        return ""
    try:
        return datetime.fromisoformat(iso).strftime("%d.%m.%Y %H:%M")
    except ValueError:
        return iso


# --------------------------------------------------------------------------
# Роуты
# --------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "mailbox"}


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    email = _session_email(request)
    return RedirectResponse("/inbox" if email else "/login", status_code=303)


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if _session_email(request):
        return RedirectResponse("/inbox", status_code=303)
    return _login_page()


@app.post("/login")
def login(request: Request, login: str = Form(...), password: str = Form(...)):
    account = login.strip()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == account.lower()).first()
        if not user:
            user = db.query(User).filter(User.username == account).first()
        if not user or not verify_password(password, user.password_hash):
            return _login_page("Неверный логин или пароль")
        email = user.email
        username = user.username
    finally:
        db.close()

    token = secrets.token_urlsafe(32)
    _sessions[token] = {"email": email, "username": username, "exp": time.time() + SESSION_TTL}
    resp = RedirectResponse("/inbox", status_code=303)
    resp.set_cookie(COOKIE, token, max_age=SESSION_TTL, httponly=True, samesite="lax")
    return resp


@app.get("/logout")
def logout(request: Request):
    token = request.cookies.get(COOKIE)
    if token:
        _sessions.pop(token, None)
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(COOKIE)
    return resp


@app.get("/inbox", response_class=HTMLResponse)
def inbox(request: Request):
    email = _session_email(request)
    if not email:
        return RedirectResponse("/login", status_code=303)

    try:
        data = _mailpit("/api/v1/messages?limit=300")
    except Exception:  # noqa: BLE001 — демо-сервис не должен падать
        return _page("Ошибка", _header(email) + '<div class="card">Почтовый сервер недоступен. Попробуйте позже.</div>')

    letters = [m for m in (data.get("messages") or []) if email in _recipients(m)]
    if letters:
        rows = "".join(
            f'<a class="mail" href="/message/{html.escape(str(m.get("ID", "")))}">'
            f'<div class="subj">{html.escape(str(m.get("Subject") or "(без темы)"))}</div>'
            f'<div class="from">{html.escape((m.get("From") or {}).get("Name") or (m.get("From") or {}).get("Address") or "")}</div>'
            f'<div class="when">{_when(m.get("Created"))}</div></a>'
            for m in letters
        )
    else:
        rows = (
            '<div class="mail"><div class="subj">Писем пока нет</div>'
            '<div class="from">Как только на этот адрес что-то придёт — оно появится здесь.</div></div>'
        )

    body = _header(email) + (
        '<div class="note">Это демонстрационный ящик: письма «Закоулок» не уходят в интернет, '
        'а складываются сюда. Видны только письма на ваш email.</div>'
        f'<div class="card">{rows}</div>'
    )
    return _page("Входящие", body)


@app.get("/message/{message_id}", response_class=HTMLResponse)
def message(request: Request, message_id: str):
    email = _session_email(request)
    if not email:
        return RedirectResponse("/login", status_code=303)

    try:
        msg = _mailpit(f"/api/v1/message/{message_id}")
    except Exception:  # noqa: BLE001
        return _page("Ошибка", _header(email) + '<div class="card">Письмо не найдено.</div>', status_code=404)

    # Чужое письмо по угаданному ID не отдаём.
    if email not in _recipients(msg):
        return _page("Нет доступа", _header(email) + '<div class="card">Это письмо адресовано другому ящику.</div>', status_code=403)

    sender = msg.get("From") or {}
    to = ", ".join(str(t.get("Address", "")) for t in (msg.get("To") or []))
    body_html = msg.get("HTML") or ""
    text = msg.get("Text") or ""
    if not body_html:
        body_html = f"<pre style='white-space:pre-wrap;font:14px/1.5 monospace'>{html.escape(text)}</pre>"

    body = _header(email) + (
        '<p class="muted"><a href="/inbox">← Все письма</a></p>'
        '<div class="card">'
        f'<h1>{html.escape(str(msg.get("Subject") or "(без темы)"))}</h1>'
        '<ul class="meta">'
        f'<li>От: {html.escape(str(sender.get("Name") or ""))} {html.escape(str(sender.get("Address") or ""))}</li>'
        f'<li>Кому: {html.escape(to)}</li>'
        f'<li>{_when(msg.get("Created"))}</li>'
        '</ul>'
        f'<iframe sandbox srcdoc="{html.escape(body_html, quote=True)}" title="Письмо"></iframe>'
        '</div>'
    )
    return _page(str(msg.get("Subject") or "Письмо"), body)
