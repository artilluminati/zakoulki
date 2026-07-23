# Закоулки — MVP

Минимальный рабочий проект: FastAPI backend + Next.js frontend с картой на Leaflet.

## Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # поправьте DATABASE_URL/SECRET_KEY при необходимости

# создаём postgres-базу milnitsa заранее (createdb milnitsa)

alembic revision --autogenerate -m "init"
alembic upgrade head

python -m app.db.seed       # наполняет города и категории

uvicorn app.main:app --reload
```

Backend поднимется на `http://localhost:8000`, документация — `http://localhost:8000/docs`.

## Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend — `http://localhost:3000`. Главная страница показывает список городов
(из сида — Казань/Москва/Санкт-Петербург), клик ведёт на `/map/[citySlug]`
с интерактивной картой на Leaflet, маркерами мест и фильтром по категориям.

## Что уже готово

- **Backend**: модели (users, cities, categories, places, posts, photos),
  JWT-регистрация/логин, полный CRUD для places/posts/photos, фильтры
  по городу/категории/поиску/радиусу, загрузка фото через Pillow, Alembic-миграции.
- **Frontend**: главная страница с выбором города, `/map/[citySlug]` — рабочая
  Leaflet-карта с маркерами и попапами, фильтр категорий через query-параметр.

## Что дальше расширять

- страницы `/place/[slug]`, `/create/place`, `/create/post`, `/profile`, `/login`, `/register`
- форму загрузки фото и авторизацию на фронте (сохранение JWT, интерцептор уже есть в `lib/api.ts`)
- заменить bounding-box фильтр радиуса на PostGIS `ST_DWithin`, когда база вырастет
- кастомные пиксельные SVG-иконки маркеров вместо стандартных Leaflet-пинов (под стиль Cyber Brutalism / Windows XP)
