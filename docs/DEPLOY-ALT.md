# Развертывание на другой машине (Windows / MySQL)

## Вариант 1 — локально на ПК с OpenServer (MySQL)

1. Установить Python 3.11+ (python.org) и Node.js LTS (nodejs.org).
2. Запустить OpenServer, создать БД `zakoulki` (кодировка utf8mb4).
3. Скопировать проект.
4. Backend:
   - `cd backend`
   - `python -m venv venv`
   - `venv\Scripts\activate`
   - `pip install -r requirements.txt`
   - Создать `.env` из `.env.example`, указать `DATABASE_URL=mysql+pymysql://root:@127.0.0.1:3306/zakoulki?charset=utf8mb4`
   - `alembic upgrade head`
   - `python -m app.db.seed_v5` (тестовые данные)
   - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
5. Frontend:
   - `cd frontend`
   - `npm install`
   - Создать `.env.local` с `NEXT_PUBLIC_YANDEX_MAPS_API_KEY=...`
   - `npm run build && npm start` (порт 3001) или `npm run dev`

## Вариант 2 — чистая Windows, без программ

1. Установить Python и Node.js (как выше). PostgreSQL можно не ставить — использовать SQLite для демо:
   - `DATABASE_URL=sqlite:///./zakoulki.db`
2. Запустить backend и frontend как в варианте 1.
3. Для публичного доступа через serveo:
   - `ssh -R 80:localhost:3001 serveo.net` (или свой поддомен: `ssh -R zakoulki-test:80:localhost:3001 serveo.net`)
   - Обновить `SITE_URL`/`API_URL` в `.env` на публичный URL.
4. Подготовить аккаунты: admin `test@test.ru` / `test1234`, несколько обычных пользователей.

## Перехват домена serveo

Если нужен другой поддомен (например `zakoulki-test`), запустить:
`ssh -R zakoulki-test:80:localhost:3001 serveo.net`
и обновить ссылки в `.env`.

## Примечания

- Для MySQL миграции могут потребовать корректировки (postgresql.TIMESTAMP → TIMESTAMP). Рекомендуется использовать PostgreSQL для продакшена.
- Фото хранятся локально в `backend/uploads` — перенести папку при миграции.
