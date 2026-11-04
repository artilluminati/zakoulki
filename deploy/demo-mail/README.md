# Демо-почта для локального стенда

Только для стенда, где сеть блокирует исходящий SMTP. На боевом сервере
используется обычный SMTP Яндекса — см. `docs/09-mail.md`, раздел 2.

Что поднимается:

- `zakoulki-mailpit.service` — Mailpit: SMTP `127.0.0.1:1025`, веб-интерфейс `127.0.0.1:8025` (наружу не выставляется);
- `zakoulki-mailbox.service` — клиент `backend/app/mailbox.py` на `127.0.0.1:8090`: вход по логину/паролю сайта, каждый видит письма только на свой email;
- `zakoulki-mail-tunnel.service` — serveo-туннель клиента: `https://zakoulki-mail.serveousercontent.com`.

Установка (пользовательские юниты, пути через `%h`):

```bash
mkdir -p ~/.local/share/mailpit
curl -sL -o /tmp/mailpit.tar.gz https://github.com/axllent/mailpit/releases/latest/download/mailpit-linux-amd64.tar.gz
tar xzf /tmp/mailpit.tar.gz -C /tmp mailpit
install -m 755 /tmp/mailpit ~/.local/bin/mailpit

cp deploy/demo-mail/zakoulki-mail*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now zakoulki-mailpit.service zakoulki-mailbox.service zakoulki-mail-tunnel.service
```

Настройки бэкенда для стенда — в `docs/09-mail.md`, раздел 6.
