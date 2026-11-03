"""Проверки ключевых сценариев: аккаунты, бейджи, пароль, админка, донаты."""
from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.models.password_reset import PasswordResetToken
from app.models.user import User

from tests.conftest import auth_header, make_user


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("ok", "degraded")
    assert "mail" in body and "payments" in body


def test_register_login_and_me(client, db):
    resp = client.post("/api/auth/register", json={
        "username": "novichok", "email": "novichok@example.ru", "password": "test1234"})
    assert resp.status_code == 201
    assert resp.json()["email"] == "novichok@example.ru"

    resp = client.post("/api/auth/login", json={"email": "novichok@example.ru", "password": "test1234"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = client.get("/api/auth/me", headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["username"] == "novichok"


def test_several_badges_at_once(client, db):
    """Бейджи не исключают друг друга: официальная организация + за донат."""
    admin = make_user(db, "admin", "admin@example.ru", role="admin")
    user = make_user(db, "org", "org@example.ru")

    token = client.post("/api/auth/login", json={"email": "admin@example.ru", "password": "test1234"}).json()["access_token"]

    resp = client.post(f"/api/admin/users/{user.id}/badges",
                       json={"kind": "official", "label": "Администрация района"}, headers=auth_header(token))
    assert resp.status_code == 201

    resp = client.post(f"/api/admin/users/{user.id}/badges",
                       json={"kind": "sponsor", "meta": {"amount": 500}}, headers=auth_header(token))
    assert resp.status_code == 201

    resp = client.get(f"/api/users/{user.id}")
    kinds = {b["kind"] for b in resp.json()["badges"]}
    assert kinds == {"official", "sponsor"}

    # снятие одного бейджа не убирает второй
    badge_id = next(b["id"] for b in resp.json()["badges"] if b["kind"] == "sponsor")
    resp = client.delete(f"/api/admin/users/{user.id}/badges/{badge_id}", headers=auth_header(token))
    assert resp.status_code == 204
    resp = client.get(f"/api/users/{user.id}")
    assert [b["kind"] for b in resp.json()["badges"]] == ["official"]


def test_forgot_password_and_reset(client, db):
    make_user(db, "petya", "petya@example.ru", password="old1234")

    resp = client.post("/api/auth/forgot-password", json={"email": "petya@example.ru"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    token_row = db.query(PasswordResetToken).first()
    assert token_row is not None

    resp = client.post("/api/auth/reset-password", json={"token": token_row.token, "password": "new1234"})
    assert resp.status_code == 200

    resp = client.post("/api/auth/login", json={"email": "petya@example.ru", "password": "new1234"})
    assert resp.status_code == 200

    # токен одноразовый
    resp = client.post("/api/auth/reset-password", json={"token": token_row.token, "password": "another1"})
    assert resp.status_code == 400


def test_forgot_password_never_leaks_account_existence(client):
    resp = client.post("/api/auth/forgot-password", json={"email": "nobody@example.ru"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_email_notification_preference(client, db):
    make_user(db, "settings", "settings@example.ru")
    token = client.post("/api/auth/login", json={"email": "settings@example.ru", "password": "test1234"}).json()["access_token"]

    resp = client.patch("/api/users/me", json={"email_notifications": False}, headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["email_notifications"] is False


def test_admin_requires_admin_role(client, db):
    make_user(db, "simple", "simple@example.ru")
    token = client.post("/api/auth/login", json={"email": "simple@example.ru", "password": "test1234"}).json()["access_token"]

    resp = client.get("/api/admin/users", headers=auth_header(token))
    assert resp.status_code == 403


def test_admin_category_crud(client, db):
    make_user(db, "boss", "boss@example.ru", role="admin")
    token = client.post("/api/auth/login", json={"email": "boss@example.ru", "password": "test1234"}).json()["access_token"]

    resp = client.post("/api/admin/categories", json={"name": "Парковки"}, headers=auth_header(token))
    assert resp.status_code == 201
    cat_id = resp.json()["id"]
    assert resp.json()["slug"]

    resp = client.get("/api/admin/categories", headers=auth_header(token))
    assert any(c["id"] == cat_id for c in resp.json())

    resp = client.patch(f"/api/admin/categories/{cat_id}", json={"name": "Парковки и гаражи"}, headers=auth_header(token))
    assert resp.json()["name"] == "Парковки и гаражи"

    resp = client.delete(f"/api/admin/categories/{cat_id}", headers=auth_header(token))
    assert resp.status_code == 204


def test_donations_disabled_answers_503(client, db):
    make_user(db, "donor", "donor@example.ru")
    token = client.post("/api/auth/login", json={"email": "donor@example.ru", "password": "test1234"}).json()["access_token"]

    resp = client.post("/api/donations", json={"amount": 500, "purpose": "project"}, headers=auth_header(token))
    assert resp.status_code == 503
    assert "не настроен" in resp.json()["detail"]


def test_donation_webhook_ignores_unknown_payment(client):
    resp = client.post("/api/donations/webhook", json={"event": "payment.succeeded", "object": {"id": "unknown"}})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_recommendations_are_public(client, db):
    resp = client.get("/api/recommendations")
    assert resp.status_code == 200
    assert resp.json() == []


def test_admin_can_publish_recommendation(client, db):
    from app.models.recommendation import Recommendation
    admin = make_user(db, "moder", "moder@example.ru", role="admin")
    rec = Recommendation(title="Сантехник", description="Дёшево и быстро", contact="+7 900 000-00-00",
                         topic="zhkh", status="pending")
    db.add(rec)
    db.commit()
    db.refresh(rec)

    token = client.post("/api/auth/login", json={"email": "moder@example.ru", "password": "test1234"}).json()["access_token"]
    resp = client.patch(f"/api/admin/recommendations/{rec.id}", json={"status": "published"}, headers=auth_header(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"

    resp = client.get("/api/recommendations")
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "Сантехник"


def test_expired_reset_token_is_rejected(client, db):
    user = make_user(db, "old", "old@example.ru")
    row = PasswordResetToken(user_id=user.id, token="expired-token",
                             expires_at=datetime.now(timezone.utc) - timedelta(hours=1))
    db.add(row)
    db.commit()

    resp = client.post("/api/auth/reset-password", json={"token": "expired-token", "password": "new1234"})
    assert resp.status_code == 400
