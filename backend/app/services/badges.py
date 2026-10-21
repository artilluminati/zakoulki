"""Выдача и снятие бейджей. У пользователя их может быть несколько."""
from sqlalchemy.orm import Session

from app.models.badge import (
    BADGE_DONOR,
    BADGE_LABELS,
    BADGE_OFFICIAL,
    BADGE_SPONSOR,
    UserBadge,
)
from app.models.user import User

ALL_KINDS = (BADGE_OFFICIAL, BADGE_DONOR, BADGE_SPONSOR, "op")


def grant_badge(
    db: Session,
    user_id: int,
    kind: str,
    granted_by: int | None = None,
    label: str | None = None,
    meta: dict | None = None,
) -> UserBadge:
    """Выдаёт бейдж. Повторная выдача того же вида — обновляет метку/метаданные."""
    if kind not in ALL_KINDS:
        raise ValueError(f"неизвестный вид бейджа: {kind}")
    badge = db.query(UserBadge).filter(UserBadge.user_id == user_id, UserBadge.kind == kind).first()
    if badge:
        badge.label = label or badge.label or BADGE_LABELS.get(kind)
        if meta is not None:
            badge.meta = meta
        return badge
    badge = UserBadge(
        user_id=user_id,
        kind=kind,
        label=label or BADGE_LABELS.get(kind),
        meta=meta,
        granted_by=granted_by,
    )
    db.add(badge)
    _sync_legacy_badge(db, user_id)
    _invalidate(db, user_id)
    return badge


def remove_badge(db: Session, user_id: int, badge_id: int) -> bool:
    badge = db.query(UserBadge).filter(UserBadge.id == badge_id, UserBadge.user_id == user_id).first()
    if not badge:
        return False
    db.delete(badge)
    db.flush()
    _sync_legacy_badge(db, user_id)
    _invalidate(db, user_id)
    return True


def _sync_legacy_badge(db: Session, user_id: int) -> None:
    """Старое поле users.badge держим в синхроне (его ещё читает часть кода)."""
    user = db.get(User, user_id)
    if not user:
        return
    has_official = db.query(UserBadge).filter(
        UserBadge.user_id == user_id, UserBadge.kind == BADGE_OFFICIAL
    ).first() is not None
    user.badge = BADGE_OFFICIAL if has_official else None


def badges_for_users(db: Session, user_ids: list[int]) -> dict[int, list[dict]]:
    """Бейджи сразу для нескольких пользователей — чтобы не делать запрос на каждый."""
    out: dict[int, list[dict]] = {uid: [] for uid in user_ids}
    if not user_ids:
        return out
    rows = db.query(UserBadge).filter(UserBadge.user_id.in_(user_ids)).order_by(UserBadge.id).all()
    for b in rows:
        out[b.user_id].append(_badge_out(b))
    return out


def _badge_out(b: UserBadge) -> dict:
    return {
        "id": b.id,
        "kind": b.kind,
        "label": b.label or BADGE_LABELS.get(b.kind, b.kind),
        "meta": b.meta or {},
        "created_at": b.created_at,
    }


def badges_out(db: Session, user_id: int) -> list[dict]:
    rows = db.query(UserBadge).filter(UserBadge.user_id == user_id).order_by(UserBadge.id).all()
    return [_badge_out(b) for b in rows]


def badges_map_cached(db: Session, user_ids: list[int]) -> dict[int, list[dict]]:
    """Бейджи сразу для нескольких пользователей. Кэш живёт в рамках сессии запроса,
    чтобы не делать запрос на каждый тред в ленте."""
    cache = db.info.setdefault("badges_cache", {})
    missing = [uid for uid in user_ids if uid not in cache]
    if missing:
        cache.update(badges_for_users(db, missing))
    return {uid: cache.get(uid, []) for uid in user_ids}


def _invalidate(db: Session, user_id: int) -> None:
    db.info.get("badges_cache", {}).pop(user_id, None)
