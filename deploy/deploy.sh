#!/usr/bin/env bash
# Обновление проекта на сервере: rsync кода -> миграции -> сборка фронта -> рестарт.
# Запускается по ssh с машины разработчика (или вручную на сервере).
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/zakoulki}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/zakoulki}
KEEP_BACKUPS=${KEEP_BACKUPS:-10}

cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "== бэкап базы перед обновлением =="
mkdir -p "$BACKUP_DIR"
DB_NAME=$(grep -E '^DATABASE_URL=' "$APP_DIR/backend/.env" | sed -E 's|.*/([^/?]+)\?*.*|\1|')
if [ -n "${DB_NAME:-}" ]; then
  sudo -u postgres pg_dump "$DB_NAME" | gzip > "$BACKUP_DIR/db-$(date +%F-%H%M).sql.gz"
  ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
fi

echo "== копируем код =="
rsync -az --delete \
  --exclude 'venv' --exclude '.env' --exclude 'node_modules' --exclude '.next' \
  --exclude '.env.local' --exclude '.env.production' \
  --exclude '__pycache__' --exclude '*.pyc' --exclude 'backend/app/uploads/' \
  --exclude '*.db' --exclude '.git' \
  "$ROOT/" "$APP_DIR/"

echo "== бэкенд: зависимости и миграции =="
cd "$APP_DIR/backend"
./venv/bin/pip install -q -r requirements.txt
./venv/bin/python -m alembic upgrade head

echo "== фронтенд: сборка =="
cd "$APP_DIR/frontend"
npm ci --silent
npm run build

echo "== рестарт =="
systemctl restart zakoulki-backend zakoulki-frontend
sleep 4

echo "== проверка =="
curl -fsS http://127.0.0.1:8000/health && echo
curl -fsS -o /dev/null -w "фронт: %{http_code}\n" http://127.0.0.1:3001/

echo "Готово."
