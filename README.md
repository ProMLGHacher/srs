# Комнаты WebRTC на [SRS](https://github.com/ossrs/srs) (SFU)

Публикация — **WHIP**, просмотр — **WHEP**. Сигналинг — **WebSocket** (`/ws`), JSON: `join` (с `nickname`), `state` с массивом **`members`**, `presence` / `peer-presence`, `publishing` / `unpublish`, `peer-publish` / `peer-unpublish`, `peer-join` / `peer-leave`, `ping` / `pong`.

Приложение: **`backend/`** (Go) — HTTP API, прокси RTC, статика SPA, WebSocket-хаб.

## Docker (всё сразу)

```bash
docker compose up --build -d
```

Откройте **http://localhost:3080** или с телефона `http://192.168.x.x:3080` (`APP_HOST_PORT` по умолчанию 3080). Образ собирается из корневого **`Dockerfile`**: сборка `front_app` → встраивание `dist` в Go-бинарник.

### Доступ по HTTPS / с телефона (кратко)

SPA рассчитана на **относительные** URL (`/api`, `/ws`) — удобно за обратным прокси или туннелем ([ngrok](https://ngrok.com/) и т.п.). Для **телефона в той же Wi‑Fi**, что и хост с Docker, задайте **`SRS_CANDIDATE_IP=<LAN-IP машины>`** — иначе ICE к **UDP 8000** не сойдётся.

**Ограничение:** HTTP(S)-туннель не заменяет **UDP** для медиа. С **мобильного интернета** без **TURN** звонок обычно не заработает.

### macOS и доступ по Wi‑Fi

**502** при открытии URL обычно не из‑за «закрытых портов»: ответ уже пришёл с сервера. Если страница **не открывается вообще** (таймаут), проверьте **Системные настройки → Сеть → Брандмауэр**: разрешите входящие для **Docker** (или временно отключите брандмауэр для проверки). Порты **3080** (HTTP приложения), **1985** (API SRS), **8000/udp** (WebRTC) должны быть проброшены compose’ом на хост.

Сервисы: **srs** (1985, 8080, **8000/udp**) и **app** (образ из `Dockerfile`, внутри контейнера порт **3001**). См. [WebRTC | SRS](https://ossrs.io/lts/en-us/docs/v5/doc/webrtc).

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

Терминал 3 — фронт (Vite проксирует `/api` и `/ws` на **http://127.0.0.1:3001**):

```bash
cd front_app
npm install
npm run dev
```

Для отдельного URL API при сборке фронта задайте `VITE_SIGNAL_URL` и при необходимости `VITE_SIGNAL_WS` (полный URL `wss://.../ws`).

## Структура репозитория

| Путь | Назначение |
|------|------------|
| `Dockerfile` | multi-stage: `front_app` → Go, embed `dist` в бинарник |
| `docker-compose.yml` | SRS + приложение |
| `backend/` | Go: WHIP/WHEP, `/ws`, `/api/health`, `/api/rooms`, статика |
| `front_app/` | SPA (React, kvt), лобби и комната |
| `srs/rtc.conf` | RTC для SRS |
