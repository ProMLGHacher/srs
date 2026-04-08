# Integration Rollout and Readiness

## Dual-path rollout

- Path A: текущие локальные реализации в `front_app`.
- Path B: реализации через `@kvatum/*`.
- Переключение делать по feature flags на уровне composition root.

## Smoke checklist

- Lobby join, pre-join preview, publish start/stop.
- Subscribe/unsubscribe peers on join/leave.
- Mute/unmute mic and camera while publishing.
- Reconnect after temporary signaling disconnect.
- Device switch and recovery from media errors.

## Regression controls

- Сравнивать снапшоты состояния (`members`, `remotePeerIds`, diagnostics).
- Логировать WS and SDP critical points во время миграции.
- Удалять legacy путь только после прохождения smoke на 2+ окружениях.

## Repo split readiness criteria

- Все импорты в `front_app` идут через `@kvatum/*` (без относительных путей в `kvatum`).
- Документированы public API и migration contracts.
- Пакеты имеют независимую сборку/typecheck.
