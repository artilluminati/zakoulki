"""Сид реалистичных постов для демо: ~10 постов, 4 — Москва, остальные — регионы.
Запуск: python -m app.db.seed_realistic"""
from app.db.session import SessionLocal
from app.models.category import Category
from app.models.geo_place import GeoPlace
from app.models.thread import Thread, thread_categories
from app.models.thread_comment import ThreadComment
from app.models.user import User
from app.services.markdown import render_markdown
from sqlalchemy import insert

# --- пользователи (нормальные имена, не «tester») ---
USERS = [
    ("Алексей Морозов", "alexey.morozov@inbox.ru"),
    ("Наталья Соколова", "nat.sokolova@gmail.com"),
    ("Ольга Кузнецова", "olga.kuznetsova@yandex.ru"),
    ("Дмитрий Волков", "d.volkov@mail.ru"),
    ("Сергей Петров", "sergey.petrov@inbox.ru"),
    ("Айгуль Галиева", "aigul.galiev@yandex.ru"),
    ("Баярма Батуева", "bayarma.batueva@mail.ru"),
    ("Ирина Воробьёва", "irina.vorobieva@gmail.com"),
    ("Рустам Алиев", "rustam.aliev@inbox.ru"),
    ("Мария Орлова", "maria.orlova@yandex.ru"),
]

# --- посты: (заголовок, тело, имя автора, city places, категории, comments) ---
POSTS = [
    # ---- Москва ----
    {
        "title": "Отопление в подъезде на Покровке не работает вторую неделю",
        "body": "В подъезде №3 на Покровке, 14 уже вторую неделю холодные батареи. "
                "УК отвечает, что «всё по графику», но по факту ничего не работает. "
                "Кто-нибудь сталкивался? Что делать, куда жаловаться?\n\n+[1:ТЦ Галерея] #ЖКХ",
        "author": "Алексей Морозов",
        "place": "ТЦ Галерея",
        "cats": ["ЖКХ"],
        "comments": [
            ("Наталья Соколова", "У нас на Ленина та же история. Звонил в УК — сказали «настройки на котельной», но ничего не поменялось."),
            ("Дмитрий Волков", "Пишите в ГИС ЖКХ и в жилинспекцию. Мне помогло — через неделю включили."),
        ],
    },
    {
        "title": "Яма на дороге после ремонта — машины бьют диски",
        "body": "После ремонта дороги у остановки «Центральная» осталась глубокая яма, "
                "машины бьют диски и колёса. Звонил в диспетчерскую — сказали «передали», "
                "но неделя прошла, ямы как были. Кто-нибудь ещё замечал?\n\n+[2:Остановка Центральная] #Дороги",
        "author": "Наталья Соколова",
        "place": "Остановка Центральная",
        "cats": ["Дороги"],
        "comments": [
            ("Алексей Морозов", "Видел эту яму, объезжаю по встречке. Опасно — ночью её не видно."),
        ],
    },
    {
        "title": "Сломанная детская площадка во дворе — качели оторваны",
        "body": "На детской площадке у пруда оторваны качели и сломаны качалки. "
                "Дети играют на сломанном оборудовании, это опасно. Уже месяц как. "
                "Кто отвечает за ремонт и куда обращаться?\n\n+[3:Парк у пруда] #Благоустройство",
        "author": "Ольга Кузнецова",
        "place": "Парк у пруда",
        "cats": ["Благоустройство"],
        "comments": [
            ("Наталья Соколова", "У нас во дворе тоже площадку закрыли «на ремонт» и забыли. Писала в УК — тишина."),
        ],
    },
    {
        "title": "Мусор не вывозят третью неделю — контейнеры переполнены",
        "body": "Контейнеры у дома переполнены уже неделю, мусор стоит кучами. "
                "Звонил в УК — говорят «машина сломалась». Дети играют рядом с мусором. "
                "Куда жаловаться, кто сталкивался?\n\n+[3:Парк у пруда] #ЖКХ #Экология",
        "author": "Дмитрий Волков",
        "place": "Парк у пруда",
        "cats": ["ЖКХ", "Экология"],
        "comments": [],
    },
    # ---- Саяногорск ----
    {
        "title": "Холодные батареи в доме на Ленина, 15 — каждый год одно и то же",
        "body": "В доме на Ленина, 15 батареи едва тёплые, хотя отопление включили. "
                "УК говорит «настройки на котельной», но так каждый год. "
                "Кто-нибудь знает, как решить?\n\n+[18:Саяногорск] #ЖКХ",
        "author": "Сергей Петров",
        "place": "Саяногорск",
        "cats": ["ЖКХ"],
        "comments": [
            ("МэрСаяногорска", "Принято, передал в УК. Обещают проверить котельную на этой неделе."),
        ],
    },
    # ---- Казань ----
    {
        "title": "Не горит фонарь на ул. Баумана — вечером темно",
        "body": "На ул. Баумана, рядом с кремлём, третью неделю не горит фонарь. "
                "Вечером там темно, страшно идти. Обращался через портал — тишина. "
                "Кто знает, кому писать?\n\n+[20:Казанский кремль] #Безопасность #Благоустройство",
        "author": "Айгуль Галиева",
        "place": "Казанский кремль",
        "cats": ["Безопасность", "Благоустройство"],
        "comments": [
            ("Алексей Морозов", "В Москве такие обращения через mos.ru обычно решаются за 2 недели. Попробуйте написать в районную администрацию."),
        ],
    },
    # ---- Улан-Удэ ----
    {
        "title": "Автобус №12 ходит раз в час — люди не успевают на работу",
        "body": "Автобус №12 ходит раз в час, люди не успевают на работу. В час пик набиваются как селёдки. "
                "В администрации говорят «нет водителей». Кто-нибудь писал жалобу в минтранс?\n\n+[22:Площадь Советов] #Транспорт",
        "author": "Баярма Батуева",
        "place": "Площадь Советов",
        "cats": ["Транспорт"],
        "comments": [],
    },
    # ---- Пыть-Ях ----
    {
        "title": "Горячей воды нет уже 5 дней — никто не предупреждал",
        "body": "Горячей воды нет уже 5 дней, в УК говорят «ремонт котельной». "
                "Но никто не предупреждал. Как узнать, когда включат? Кто-нибудь дозвонился?\n\n+[27:городской округ Пыть-Ях] #ЖКХ",
        "author": "Ирина Воробьёва",
        "place": "городской округ Пыть-Ях",
        "cats": ["ЖКХ"],
        "comments": [],
    },
    # ---- Адыгея ----
    {
        "title": "Дорога к селу разбита — скорая не может проехать",
        "body": "Дорога к селу Краснооктябрьское разбита, машины застревают в грязи после дождя. "
                "Скорая не может проехать. Обращались в район — тишина. "
                "Кто-нибудь знает, куда ещё написать?\n\n+[8:Конь] #Дороги",
        "author": "Рустам Алиев",
        "place": "Конь",
        "cats": ["Дороги"],
        "comments": [],
    },
    # ---- Дмитров ----
    {
        "title": "Детская площадка разрушена — УК говорит «не на балансе»",
        "body": "Детская площадка рядом с домом разрушена: качели оторваны, горка с трещиной. "
                "Дети играют на сломанном. УК говорит «не на балансе». "
                "Кто отвечает за ремонт?\n\n+[5:Кучер] #Благоустройство",
        "author": "Мария Орлова",
        "place": "Кучер",
        "cats": ["Благоустройство"],
        "comments": [],
    },
]


def main():
    db = SessionLocal()

    # --- пользователи ---
    user_map = {}
    for name, email in USERS:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(username=name, email=email, password_hash=__import__("app.core.security", fromlist=["hash_password"]).hash_password("test1234"))
            db.add(u); db.flush()
        user_map[name] = u
    db.commit()

    # --- места (найти или создать) ---
    place_map = {}
    for p in db.query(GeoPlace).all():
        place_map[p.name] = p

    # --- категории ---
    cat_map = {c.name: c for c in db.query(Category).all()}

    # --- посты ---
    for post in POSTS:
        if db.query(Thread).filter(Thread.title == post["title"]).first():
            print("skip (уже есть):", post["title"][:60])
            continue
        place = place_map.get(post["place"])
        author = user_map[post["author"]]
        html, entities = render_markdown(post["body"])
        t = Thread(
            author_id=author.id,
            title=post["title"],
            body_md=post["body"],
            body_html=html,
            is_offtop=place is None,
            place_id=place.id if place else None,
            city=place.city if place else None,
            district=place.district if place else None,
            region=place.region if place else None,
            country=place.country if place else None,
        )
        db.add(t); db.flush()

        # категории
        for cname in post["cats"]:
            c = cat_map.get(cname)
            if c:
                db.execute(thread_categories.insert().values(thread_id=t.id, category_id=c.id))

        # теги из entities
        from app.models.thread_extra import Tag, ThreadTag
        for tag_name in entities.get("tag_names", []):
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name, slug=tag_name.lower().replace(" ", "-"))
                db.add(tag); db.flush()
            if not db.query(ThreadTag).filter(ThreadTag.thread_id == t.id, ThreadTag.tag_id == tag.id).first():
                db.add(ThreadTag(thread_id=t.id, tag_id=tag.id))

        # упоминания мест
        from app.models.thread_extra import ThreadMention
        for pid in entities.get("place_ids", []):
            db.add(ThreadMention(thread_id=t.id, kind="place", place_id=pid))

        # комментарии
        for cname, cbody in post["comments"]:
            cu = user_map.get(cname)
            if not cu:
                continue
            ch, _ = render_markdown(cbody)
            db.add(ThreadComment(thread_id=t.id, author_id=cu.id, body_md=cbody, body_html=ch))
            t.comments_count += 1

        db.commit()
        print("создан:", post["title"][:70])

    db.commit()
    print(f"\nГотово: threads={db.query(Thread).count()}, users={db.query(User).count()}, places={db.query(GeoPlace).count()}")




if __name__ == "__main__":
    main()
