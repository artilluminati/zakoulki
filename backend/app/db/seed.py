"""Наполняет базу стартовыми городами и категориями.

Запуск: python -m app.db.seed
"""
from app.db.session import SessionLocal
from app.models.city import City
from app.models.category import Category

CITIES = [
    {"name": "Казань", "slug": "kazan", "country": "Россия", "center_lat": 55.7963, "center_lng": 49.1064, "default_zoom": 13},
    {"name": "Москва", "slug": "moscow", "country": "Россия", "center_lat": 55.7558, "center_lng": 37.6173, "default_zoom": 12},
    {"name": "Санкт-Петербург", "slug": "saint-petersburg", "country": "Россия", "center_lat": 59.9343, "center_lng": 30.3351, "default_zoom": 12},
]

CATEGORIES = [
    {"name": "Архитектура", "slug": "architecture", "icon": "building"},
    {"name": "Стрит-арт", "slug": "street-art", "icon": "spray"},
    {"name": "Заброшенные места", "slug": "abandoned", "icon": "ghost"},
    {"name": "Дворы", "slug": "yard", "icon": "door"},
    {"name": "Природа", "slug": "nature", "icon": "leaf"},
    {"name": "Памятники", "slug": "monument", "icon": "statue"},
    {"name": "Другое", "slug": "other", "icon": "star"},
]


def seed():
    db = SessionLocal()
    try:
        for c in CITIES:
            if not db.query(City).filter_by(slug=c["slug"]).first():
                db.add(City(**c))
        for c in CATEGORIES:
            if not db.query(Category).filter_by(slug=c["slug"]).first():
                db.add(Category(**c))
        db.commit()
        print("База наполнена стартовыми данными ✅")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
