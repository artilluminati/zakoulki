#!/usr/bin/env bash
# Ежечасный бэкап базы «Закоулков» на Windows-HDD.
# Хранит не более 1 бэкапа в день, всего за последнюю неделю (7 копий).
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/zakoulki/backend/.env}
BACKUP_ROOT=${BACKUP_ROOT:-"/windows/Users/ArtIlluminati/OneDrive/Документы/Проекты/Закоулки/бэкапы"}
KEEP_DAYS=${KEEP_DAYS:-7}

mkdir -p "$BACKUP_ROOT"

DB_NAME=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's|.*/([^/?]+)\?*.*|\1|')
DB_USER=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's|.*://([^:]+):.*|\1|')
DB_PASS=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's|.*@([^:/]+).*|\1|')

TODAY=$(date +%F)
TODAY_FILE="$BACKUP_ROOT/db-$TODAY.sql.gz"

# не более 1 бэкапа в день
if [ -f "$TODAY_FILE" ]; then
  echo "бэкап за $TODAY уже есть — пропускаем"
  exit 0
fi

PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$TODAY_FILE"
echo "бэкап создан: $TODAY_FILE ($(du -h "$TODAY_FILE" | cut -f1))"

# удалить бэкапы старше KEEP_DAYS дней
find "$BACKUP_ROOT" -maxdepth 1 -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "очистка старше ${KEEP_DAYS} дней выполнена"
echo "всего бэкапов: $(ls -1 "$BACKUP_ROOT"/db-*.sql.gz 2>/dev/null | wc -l)"
