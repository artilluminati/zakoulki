#!/usr/bin/env bash
# Бэкап базы «Закоулков». Ставится по таймеру (systemd timer, см. install.sh).
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/var/backups/zakoulki}
KEEP_BACKUPS=${KEEP_BACKUPS:-14}
ENV_FILE=${ENV_FILE:-/opt/zakoulki/backend/.env}

mkdir -p "$BACKUP_DIR"
DB_NAME=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's|.*/([^/?]+)\?*.*|\1|')
if [ -z "${DB_NAME:-}" ]; then
  echo "не найден DATABASE_URL в $ENV_FILE" >&2
  exit 1
fi

FILE="$BACKUP_DIR/db-$(date +%F-%H%M).sql.gz"
sudo -u postgres pg_dump "$DB_NAME" | gzip > "$FILE"
ls -1t "$BACKUP_DIR"/db-*.sql.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
echo "бэкап: $FILE ($(du -h "$FILE" | cut -f1))"
