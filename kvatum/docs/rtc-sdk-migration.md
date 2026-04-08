# RTC SDK Migration

## Extraction phases

1. **Helpers first (done)**  
   Перенесены `mediaMutex`, `iceGathering`, `sanitizeWhepAnswerSdp`, `videoCodecOrder` в `@kvatum/rtc`.

2. **Unified SDK package (scaffolded)**  
   Создан единый пакет `@kvatum/rtc`, который содержит типы, signaling и transport adapters.

3. **React bindings (scaffolded)**  
   Создан `@kvatum/rtc-react` как отдельный слой интеграции.

## App compatibility

- `front_app/src/features/room/data/repository/RoomSessionRepositoryImpl.ts` уже использует helper API из `@kvatum/rtc`.
- Текущая реализация `RoomSessionRepositoryImpl` оставлена как compatibility layer для поэтапного выноса orchestration.

## Next implementation tasks

- Вынести WS heartbeat/reconnect orchestration в `@kvatum/rtc`.
- Вынести `_postSdp` и retry/timeout policy в `@kvatum/rtc`.
- Вынести publish/subscribe lifecycle в единый session engine внутри `@kvatum/rtc`.
