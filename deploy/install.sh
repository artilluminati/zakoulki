#!/usr/bin/env bash
# Первый запуск на сервере: ставит зависимости, создаёт базу, собирает фронт.
# Запускать ОДИН раз на чистом VPS от пользователя с sudo.
set -euo pipefail

APP_DIR=/opt/zakoulki
APP_USER=zakoulki

echo "== 1. пользователь и папки =="
id -u "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "== 2. системные пакеты =="
apt-get update
apt-get install -y python3-venv python3-pip postgresql nginx rsync curl unzip

echo "== 3. база данных =="
sudo -u postgres psql <<'SQL'
CREATE USER zakoulki WITH PASSWORD 'пароль-замени';
CREATE DATABASE zakoulki OWNER zakoulki;
SQL

echo "== 4. бэкенд =="
cd "$APP_DIR/backend"
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
  echo "!! Отредактируй $APP_DIR/backend/.env и перезапусти скрипт"
  exit 1
fi
./venv/bin/python -m alembic upgrade head
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "== 5. фронтенд =="
cd "$APP_DIR/frontend"
cp .env.local.example .env.production 2>/dev/null || true
npm ci
npm run build

echo "== 6. systemd + nginx =="
cp "$APP_DIR/deploy/systemd/zakoulki-backend.service" /etc/systemd/system/
cp "$APP_DIR/deploy/systemd/zakoulki-frontend.service" /etc/systemd/system/
cp "$APP_DIR/deploy/nginx/zakoulki.conf" /etc/nginx/sites-available/zakoulki
ln -sf /etc/nginx/sites-available/zakoulki /etc/nginx/sites-enabled/zakoulki
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl daemon-reload
systemctl enable --now zakoulki-backend zakoulki-frontend

echo "== 7. бэкапы по таймеру =="
install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/zakoulki-backup
cat > /etc/systemd/system/zakoulki-backup.timer <<'TIMER'
[Unit]
Description=Ежедневный бэкап базы «Закоулков»

[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true

[Install]
WantedBy=timers.target
TIMER
cat > /etc/systemd/system/zakoulki-backup.service <<'SVC'
[Unit]
Description=Бэкап базы «Закоулков»

[Service]
Type=oneshot
ExecStart=/usr/local/bin/zakoulki-backup
SVC
systemctl daemon-reload
systemctl enable --now zakoulki-backup.timer

echo "Готово. Проверка: curl -s http://127.0.0.1:8000/health"
