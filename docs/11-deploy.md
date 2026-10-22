# Выкладка на сервер (VPS)

Полная инструкция: что купить, как поднять, как обновлять, как откатить.
Всё лежит в папке `deploy/` этого репозитория — скрипты можно копировать как есть.

## 1. Что нужно на сервере

| Что | Минимум | Зачем |
|---|---|---|
| VPS | 2 vCPU, 2 ГБ RAM, 20 ГБ SSD | фронт (Next.js) + бэк (FastAPI) + PostgreSQL |
| ОС | Ubuntu 22.04 / 24.04 | ставится nginx, python, node из репозитория |
| Домен | 1 шт. | адрес сайта и SSL |
| PostgreSQL | 15+ | база |

Провайдеры, где берут VPS для учебного проекта: Timeweb, reg.ru, Selectel, Aéza.
Минимальная цена (1–2 ГБ RAM) — вполне подходит.

## 2. Один раз: первичная установка

```bash
# на сервере
sudo bash deploy/install.sh
```

Скрипт: создаст пользователя `zakoulki` и папку `/opt/zakoulki`, поставит
`python3-venv`, `postgresql`, `nginx`, `rsync`, создаст базу и пользователя БД,
поднимет `venv`, применит миграции, соберет фронт, установит systemd-юниты и nginx-конфиг,
включит ежедневный бэкап базы по таймеру.

После скрипта обязательно:

1. Отредактировать `/opt/zakoulki/backend/.env` (реквизиты БД, `SECRET_KEY`, `SITE_URL`,
   почта, ЮKassa) — см. `deploy/backend.env.example` и `docs/09-mail.md`, `docs/10-yookassa.md`.
2. Отредактировать `/opt/zakoulki/frontend/.env.production`:
   ```
   NEXT_PUBLIC_API_URL=/api
   NEXT_PUBLIC_YANDEX_MAPS_API_KEY=ключ
   ```
   (ключ Яндекс-Карт лежит в локальном `frontend/.env.local` — скопируй его.)
3. Пересобрать фронт с новым ключом и перезапустить:
   ```bash
   cd /opt/zakoulki/frontend && npm run build
   sudo systemctl restart zakoulki-frontend zakoulki-backend
   ```
4. Проверить:
   ```bash
   curl -s http://127.0.0.1:8000/health
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/
   ```

## 3. Домен и HTTPS

В панели VPS пропиши домен на IP сервера (A-запись), потом в `/etc/nginx/sites-available/zakoulki`
замени `example.ru` на свой домен и включи сертификат:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d твой-домен.ru -d www.твой-домен.ru
```

Certbot сам поправит конфиг и добавит редирект на HTTPS. После этого
`SITE_URL` и `API_URL` в `.env` должны быть с `https://`.

## 4. Обновление проекта (после каждого коммита)

Локально:

```bash
cd /home/artilluminati/projects/zakoulki
bash deploy/deploy.sh            # выполнит rsync + миграции + сборку + рестарт
```

`deploy.sh` сам: снимет бэкап базы, скопирует код (без `venv`, `.env`, `node_modules`),
поставит зависимости, применит миграции, пересоберёт фронт, перезапустит сервисы
и проверит `/health`.

Через GitHub Actions: репозиторий → вкладка **Actions** → **Deploy** → **Run workflow**,
указать `host` (например `zakoulki@123.45.67.89`) и `path` (`/opt/zakoulki`).
Секрет `VPS_SSH_KEY` добавляется в **Settings → Secrets and variables → Actions**.

## 5. Бэкапы

- `deploy/backup.sh` — дамп базы в `/var/backups/zakoulki`, ротация 14 копий;
- по умолчанию запускается таймером `zakoulki-backup.timer` каждый день в 04:30;
- перед каждым обновлением бэкап снимается автоматически.

Восстановление из бэкапа:

```bash
gunzip -c /var/backups/zakoulki/db-2026-11-05-0430.sql.gz | sudo -u postgres psql zakoulki
```

## 6. Если что-то сломалось

```bash
sudo systemctl status zakoulki-backend zakoulki-frontend   # состояние
sudo journalctl -u zakoulki-backend -n 100 --no-pager      # логи бэка
sudo tail -n 100 /opt/zakoulki/backend/storage/logs/*.log   # логи приложения (если есть)
```

Откат на прошлую версию: `git log` → найти нужный коммит → на сервере
`git checkout <коммит>` в папке `/opt/zakoulki` → `bash deploy/deploy.sh`.

## 7. Чек-лист после выкладки

- [ ] `/health` отвечает `{"status":"ok"}`, `mail":"on"`, `payments":"on"`
- [ ] главная, карта, создание, тред, раздел, профиль, админка — открываются
- [ ] регистрация → вход → создать тред → ответить → письмо пришло на почту
- [ ] восстановление пароля: запрос → письмо → новый пароль → вход
- [ ] донат: оплата в тестовом режиме → бейдж в профиле → донат в админке
- [ ] загрузка фото в тред работает
- [ ] на телефоне (360px) всё читаемо, нижний таббар не перекрывает контент
