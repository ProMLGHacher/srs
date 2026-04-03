# Комнаты WebRTC на [SRS](https://github.com/ossrs/srs) (SFU)

Публикация — **WHIP**, просмотр — **WHEP**. Сигналинг — **нативный WebSocket** (`/ws`), JSON-сообщения: `join`, `publishing`, `unpublish`, ответы `state`, `peer-publish`, `peer-unpublish`.

## Docker (всё сразу)

```bash
docker compose up --build -d
```

Откройте **http://localhost:3080** или с телефона `http://192.168.x.x:3080` (`APP_HOST_PORT` по умолчанию 3080).

### Доступ с других устройств через [ngrok](https://ngrok.com/)

1. Зарегистрируйтесь, возьмите **Authtoken** в [дашборде](https://dashboard.ngrok.com/get-started/your-authtoken).
2. Скопируйте `.env.example` → `.env`, вставьте `NGROK_AUTHTOKEN=...`.
3. Для **телефона в той же Wi‑Fi**, что и Mac с Docker, в `.env` укажите **`SRS_CANDIDATE_IP=<LAN-IP Mac>`** (например `192.168.1.248`), иначе ICE к **UDP 8000** не сойдётся, хотя страница по ngrok откроется.
4. Запуск:

```bash
docker compose --profile ngrok up -d --build
docker compose logs -f ngrok
```

В логах ngrok будет строка вида `url=https://xxxx.ngrok-free.app` — откройте её в браузере/телефоне. WebSocket и `/api` идут через тот же хост (фронт уже использует относительные URL).

**Ограничение:** ngrok здесь — **HTTP(S)**-туннель. **Медиа WebRTC (UDP)** по-прежнему идёт на **`SRS_CANDIDATE_IP:8000`** в вашей сети. С **мобильного интернета** (не Wi‑Fi как у Mac) без **TURN** звонок, как правило, не заработает — для этого нужен отдельный relay-сервер.

### macOS и доступ по Wi‑Fi

**502** при открытии URL обычно не из‑за «закрытых портов»: ответ уже пришёл с сервера. Если страница **не открывается вообще** (таймаут), проверьте **Системные настройки → Сеть → Брандмауэр**: разрешите входящие для **Docker** (или временно отключите брандмауэр для проверки). Порты **3080** (HTTP приложения), **1985** (API SRS), **8000/udp** (WebRTC) должны быть проброшены compose’ом на хост.

Сервисы: **srs** (1985, 8080, **8000/udp**) и **app** (сборка из корневого `Dockerfile`). См. [WebRTC | SRS](https://ossrs.io/lts/en-us/docs/v5/doc/webrtc).

**ICE / `SRS_CANDIDATE_IP`** и **`SRS_EIP`** в compose совпадают по смыслу: IP, который браузер реально может достичь по UDP 8000 (часто `127.0.0.1` или LAN‑IP хоста).

Если **502**, смотрите логи и `curl -sS http://127.0.0.1:1985/api/v1/versions`. После правок: `docker compose up --build -d`.

### WebRTC: `iceconnectionstate` failed / disconnected

Если в SDP у SRS есть кандидат **`172.x.x.x`** (Docker bridge), а браузер на **хосте**, ICE часто рвётся. В `srs/rtc.conf` отключено авто‑добавление таких адресов; задайте **`SRS_CANDIDATE_IP`**: для браузера на том же компьютере, что и Docker, обычно **`127.0.0.1`** (значение по умолчанию в compose). Если заходите **с другого устройства в LAN**, укажите **LAN‑IP машины с Docker**, например:  
`SRS_CANDIDATE_IP=192.168.1.248 docker compose up -d`

## Локальная разработка

Терминал 1 — SRS (или `docker compose up -d srs`):

Терминал 2:

```bash
cd server && npm install && npm start
```

Терминал 3:

```bash
cd front && npm install && npm run dev
```

Vite на **5173** проксирует `/api` и `/ws` на **3001** (локальный `npm start` в `server`).

## Структура

| Путь | Назначение |
|------|------------|
| `Dockerfile` | multi-stage: сборка `front`, образ с `server` + `public/` |
| `srs/rtc.conf` | RTC для SRS |
| `server/` | Express, WHIP/WHEP → SRS, WebSocket `/ws` |
| `front/` | React + Vite |

Для отдельного хоста API задайте при сборке фронта `VITE_SIGNAL_URL` и `VITE_SIGNAL_WS` (полный URL `wss://.../ws`).
