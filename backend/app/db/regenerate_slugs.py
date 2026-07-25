"""Пересчитывает slug для уже существующих мест на латиницу.

Нужен для мест, созданных до того, как slugify() научился транслитерации —
у них slug остался кириллическим и ломался в URL. Безопасно запускать
повторно: места, у которых slug уже латинский и не меняется, пропускаются.

Запуск: python -m app.db.regenerate_slugs
"""
from app.db.session import SessionLocal
from app.models.place import Place
from app.api.routes.places import slugify


def regenerate_slugs():
    db = SessionLocal()
    changed = 0
    try:
        places = db.query(Place).order_by(Place.created_at).all()
        existing_slugs = {p.slug for p in places}

        for place in places:
            base_slug = slugify(place.title)
            if base_slug == place.slug:
                continue

            slug = base_slug
            i = 1
            while slug in existing_slugs and slug != place.slug:
                i += 1
                slug = f"{base_slug}-{i}"

            existing_slugs.discard(place.slug)
            existing_slugs.add(slug)

            if slug != place.slug:
                print(f"  {place.slug!r} -> {slug!r}")
                place.slug = slug
                changed += 1

        db.commit()
        print(f"Готово: обновлено {changed} из {len(places)} мест.")
    finally:
        db.close()


if __name__ == "__main__":
    regenerate_slugs()
