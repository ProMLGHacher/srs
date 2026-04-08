# Enterprise Design System Migration

## Scope

- `tokens`: color, spacing, typography, radius, semantic states.
- `themes`: baseline dark theme + contracts for future light/high-contrast.
- `primitives`: `Button`, `Toast` as initial stable API.
- `composites`: `ControlBar` as first domain-agnostic composition.
- `icons`: SVG-first icon pipeline replacing emoji usage.

## Product-agnostic API rules

- Компоненты не принимают room/lobby domain-модели.
- Компоненты принимают DTO/props только UI-уровня.
- Тексты и локализация всегда приходят извне.
- Внутри DS нет зависимости на app router/state и продуктовые env.

## Current integration status

- `front_app/src/app/presentation/ui/Toast.tsx` переведен на facade поверх `@kvatum/ui`.
- `front_app/src/app/presentation/styles/index.css` импортирует `@kvatum/ui/styles.css`.

## Next extractions

1. `ConferenceBottomBar` -> `ControlBar` + action button primitives.
2. `ParticipantTile` -> `MediaTile` + presence badges.
3. `ParticipantsDrawer` -> `Drawer` + virtualized participant list.
4. `PreJoinModal`/`MediaSettingsModal` -> `media-ui` layer (phase 2).
