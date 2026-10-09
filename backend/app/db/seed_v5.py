"""Сид тестовых данных v5 (Q10): чтобы не было пусто. Запуск: python -m app.db.seed_v5."""
from app.db.session import SessionLocal
from app.models.geo_place import GeoPlace
from app.models.thread import Thread
from app.models.thread_comment import ThreadComment
from app.models.user import User
from app.services.markdown import render_markdown

PLACES = [
    {"name": "ТЦ Галерея", "address": "ул. Покровка, 14", "district": "Басманный район",
     "street": "Покровка", "latitude": 55.758, "longitude": 37.641, "yandex_kind": "org"},
    {"name": "Остановка Центральная", "address": "ул. Ленина, 1", "district": "Центр",
     "street": "Ленина", "latitude": 55.755, "longitude": 37.617, "yandex_kind": "address"},
    {"name": "Парк у пруда", "address": "Парковая, 5", "district": "Северный",
     "street": "Парковая", "latitude": 55.762, "longitude": 37.635, "yandex_kind": "geo"},
]

THREADS = [
    ("Когда включат отопление на Покровке?", "В подъезде холодно уже неделю +[1:ТЦ Галерея] #ЖКХ", 1),
    ("Яма на дороге у остановки", "Огромная яма, машины бьют колеса +[2:Остановка Центральная]", 2),
    ("Просто красивый закат сегодня", "без точки, оффтоп для проверки ленты", None),
]


def main():
    db = SessionLocal()
    user = db.query(User).first()
    if not user:
        print("нет юзеров — сначала зарегистрируйся через /api/auth/register")
        return
    places = []
    for p in PLACES:
        ex = db.query(GeoPlace).filter(GeoPlace.name == p["name"]).first()
        if not ex:
            ex = GeoPlace(**p, created_by=user.id); db.add(ex); db.flush()
        places.append(ex)
    for title, body, pidx in THREADS:
        if db.query(Thread).filter(Thread.title == title).first():
            continue
        html, _ = render_markdown(body)
        pid = places[pidx - 1].id if pidx else None
        t = Thread(author_id=user.id, title=title, body_md=body, body_html=html,
                   is_offtop=pid is None and len(body) <= 280, place_id=pid)
        db.add(t); db.flush()
        db.add(ThreadComment(thread_id=t.id, author_id=user.id,
                             body_md="Поддерживаю, тоже заметил",
                             body_html="<p>Поддерживаю, тоже заметил</p>"))
    db.commit()
    print(f"seed v5 ok: places={db.query(GeoPlace).count()} threads={db.query(Thread).count()}")


if __name__ == "__main__":
    main()
