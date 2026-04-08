# Комнаты WebRTC на [SRS](https://github.com/ossrs/srs) (SFU)

Публикация — **WHIP**, просмотр — **WHEP**. Сигналинг — **WebSocket** (`/api/ws`), JSON: `join` (с `nickname`), `state` с массивом **`members`**, `presence` / `peer-presence`, `publishing` / `unpublish`, `peer-publish` / `peer-unpublish`, `peer-join` / `peer-leave`, `ping` / `pong`.

Приложение: **`backend/`** (Go) — HTTP API и WebSocket-хаб. Входной HTTP-трафик проходит через отдельный **nginx**: `/` (SPA), `/api` (backend), `/srs` (SRS API/RTC).

## Docker (всё сразу)

```bash
docker compose up --build -d
```

Откройте **http://localhost:3080** или с телефона `http://192.168.x.x:3080` (`APP_HOST_PORT` по умолчанию 3080). Образ собирается из корневого **`Dockerfile`**: `front_app` собирается в `dist`, который отдаёт контейнер `nginx`.

### Доступ по HTTPS / с телефона (кратко)

SPA рассчитана на **относительные** URL (`/api`, `/api/ws`, `/srs`) — удобно за обратным прокси или туннелем ([ngrok](https://ngrok.com/) и т.п.). Для **телефона в той же Wi‑Fi**, что и хост с Docker, задайте **`SRS_CANDIDATE_IP=<LAN-IP машины>`** — иначе ICE к **UDP 8000** не сойдётся.

**Ограничение:** HTTP(S)-туннель не заменяет **UDP** для медиа. С **мобильного интернета** без **TURN** звонок обычно не заработает.

### macOS и доступ по Wi‑Fi

**502** при открытии URL обычно не из‑за «закрытых портов»: ответ уже пришёл с сервера. Если страница **не открывается вообще** (таймаут), проверьте **Системные настройки → Сеть → Брандмауэр**: разрешите входящие для **Docker** (или временно отключите брандмауэр для проверки). Порты **3080** (HTTP приложения), **1985** (API SRS), **8000/udp** (WebRTC) должны быть проброшены compose’ом на хост.

Сервисы: **nginx** (внешний HTTP), **app** (внутри сети: порт **3001**) и **srs** (внутри сети HTTP API, наружу проброшен **8000/udp** для WebRTC media). См. [WebRTC | SRS](https://ossrs.io/lts/en-us/docs/v5/doc/webrtc).

**ICE / `SRS_CANDIDATE_IP`** и **`SRS_EIP`** в compose совпадают по смыслу: IP, который браузер реально может достичь по UDP 8000 (часто `127.0.0.1` или LAN‑IP хоста).

Если **502**, смотрите логи и `curl -sS http://127.0.0.1:1985/api/v1/versions`. После правок: `docker compose up --build -d`.

### WebRTC: `iceconnectionstate` failed / disconnected

Если в SDP у SRS есть кандидат **`172.x.x.x`** (Docker bridge), а браузер на **хосте**, ICE часто рвётся. В `srs/rtc.conf` отключено авто‑добавление таких адресов; задайте **`SRS_CANDIDATE_IP`**: для браузера на том же компьютере, что и Docker, обычно **`127.0.0.1`** (значение по умолчанию в compose). Если заходите **с другого устройства в LAN**, укажите **LAN‑IP машины с Docker**, например:  
`SRS_CANDIDATE_IP=192.168.1.248 docker compose up -d`

## Локальная разработка

Терминал 1 — SRS (или `docker compose up -d srs`).

Терминал 2 — бэкенд Go (по умолчанию порт **3001**):

```bash
cd backend
go run ./cmd/server
```

Переменные: `PORT`, `SRS_HTTP`, `SRS_EIP` (см. `backend/internal/config/config.go`).

Терминал 3 — фронт (Vite проксирует `/api` и `/api/ws` на **http://127.0.0.1:3001**, а `/srs` на **http://127.0.0.1:1985**):

```bash
cd front_app
npm install
npm run dev
```

Для отдельного URL API при сборке фронта задайте `VITE_SIGNAL_URL` и при необходимости `VITE_SIGNAL_WS` (полный URL `wss://.../api/ws`).

### Деплой за nginx / другим reverse proxy

Маршруты SPA (`/room/<id>` и т.д.) не должны обрабатываться как каталоги на диске. В **nginx** не используйте `try_files $uri $uri/ /index.html` — вариант `$uri/` даёт **301** на путь вроде `/room/` и цикл редиректов. Используйте `try_files $uri /index.html` без `$uri/`. Текущий конфиг контейнера: [`deploy/nginx.conf`](deploy/nginx.conf), пример с пояснениями: [`deploy/nginx-spa.example.conf`](deploy/nginx-spa.example.conf).

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `Dockerfile` | multi-stage: сборка `front_app`, отдельные runtime-таргеты `app` (Go) и `nginx` |
| `docker-compose.yml` | `nginx` + `app` + `srs` |
| `backend/` | Go: `/api/health`, `/api/rooms`, `/api/ws` |
| `front_app/` | SPA (React, kvt), лобби и комната |
| `deploy/nginx.conf` | production reverse proxy (`/`, `/api`, `/srs`) |
| `srs/rtc.conf` | RTC для SRS |
