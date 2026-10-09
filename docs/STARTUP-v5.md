# Закоулки v5 — запуск

Стек: FastAPI + PostgreSQL + Next.js. Сервисы systemd (юзерские):

```bash
systemctl --user status zakoulki-backend.service zakoulki-frontend.service
# backend :8000, frontend :3001
```

## С нуля

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # DATABASE_URL, SECRET_KEY
createdb zakoulki
alembic upgrade head
# тестовый юзер + данные:
python -c "from app.db.session import SessionLocal; from app.models.user import User; from app.core.security import hash_password; db=SessionLocal(); db.add(User(username='tester',email='test@test.ru',password_hash=hash_password('test1234'),role='admin')); db.commit()"
python -m app.db.seed_v5

cd ../frontend
npm install
cp .env.local.example .env.local  # NEXT_PUBLIC_YANDEX_MAPS_API_KEY
npm run dev    # :3000, либо systemd :3001
```

## API v5 (Swagger: http://127.0.0.1:8000/docs)

```
POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
GET /api/threads?search=&tag=&author_id=&has_geo=&sort=new|top&before_id=&limit=
POST /api/threads {title?, body_md, place_id?, category_ids[]}
GET /api/threads/{id}  POST /api/threads/{id}/comments  POST /api/threads/{id}/like
POST /api/threads/{id}/photos (multipart, до 5, 10МБ)
POST /api/threads/{id}/report {reason, text?}
GET /api/threads/notifications/mine
GET /api/geo-places/search?q=  POST /api/geo-places
GET /api/geo-places/nearby?lat=&lng=&radius=  GET /api/geo-places/map-points?north=&south=&east=&west=
GET /api/users/by-username/{username}
GET /api/admin/users  PATCH /api/admin/users/{id} {role}  GET /api/admin/reports  DELETE /api/admin/threads/{id}
GET /api/cities  GET /api/categories (справочники, наследие v1)
```

Разметка текста: `@[id:name]` пользователи, `+[id:name]` места, `#тег` (+авто-теги по словарю).

## Экраны

`/` лента · `/map` карта с кластерами · `/create` · `/thread/[id]` · `/tag/[tag]` ·
`/user/[username]` · `/profile` · `/admin` · `/login` `/register`
