# Public API Contracts

## Export rules

- Каждый пакет экспортирует API только через `src/index.ts`.
- Deep imports считаются внутренними и запрещены.
- Внешние потребители используют только `@kvatum/<package>`.

## Design System packages

- `@kvatum/ui`: tokens/themes/primitives/composites.
- `@kvatum/icons`: иконки и единый `Icon` API.

## RTC SDK packages

- `@kvatum/rtc`: типы, WebRTC helpers, WS client, WHIP/WHEP transport.
- `@kvatum/rtc-react`: React bindings без привязки к конкретному приложению.
