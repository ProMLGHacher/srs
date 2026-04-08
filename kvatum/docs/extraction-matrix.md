# Extraction Matrix: front_app -> kvatum packages

Ниже зафиксирована финальная матрица выноса с признаком `refactor-before-extract`.

## Design System

| Source | Target package | Action | Refactor before extract |
|---|---|---|---|
| `front_app/src/app/presentation/ui/Toast.tsx` | `@kvatum/ui` | Move as `Toast`, добавить variant API | No |
| `front_app/src/app/presentation/styles/index.css` | `@kvatum/ui` | Replace with DS styles import | Yes |
| `front_app/src/features/room/presentation/view/ConferenceBottomBar.tsx` | `@kvatum/ui` | Split into product-agnostic `ControlBar` | Yes |
| `front_app/src/features/room/presentation/view/ParticipantTile.tsx` | `@kvatum/ui` | Extract visual shell as `MediaTile` | Yes |
| `front_app/src/features/room/presentation/view/ParticipantsDrawer.tsx` | `@kvatum/ui` | Extract generic list/drawer composition | Yes |
| `front_app/src/features/room/presentation/view/PreJoinModal.tsx` | `@kvatum/ui` (phase 2) | Move as media-specific composite | Yes |
| `front_app/src/features/lobby/presentation/view/MediaSettingsModal.tsx` | `@kvatum/ui` (phase 2) | Move as media settings composite | Yes |
| `front_app/src/app/presentation/layout/RootLayout.tsx` | `@kvatum/ui` (phase 2) | Derive `AppShell` from app layout | Yes |

## RTC SDK

| Source | Target package | Action | Refactor before extract |
|---|---|---|---|
| `front_app/src/features/room/domain/repository/RoomSessionRepository.ts` | `@kvatum/rtc` | Introduce framework-agnostic session contracts | Yes |
| `front_app/src/features/room/domain/model/roomSessionInit.ts` | `@kvatum/rtc` | Move to SDK config/options model | No |
| `front_app/src/features/room/domain/model/roomDiagnostics.ts` | `@kvatum/rtc` | Move diagnostics types | No |
| `front_app/src/features/room/domain/model/signalingInbound.ts` | `@kvatum/rtc` | Move inbound WS protocol types | No |
| `front_app/src/features/room/data/webrtc/mediaMutex.ts` | `@kvatum/rtc` | Move helper as-is | No |
| `front_app/src/features/room/data/webrtc/iceGathering.ts` | `@kvatum/rtc` | Move helper as-is | No |
| `front_app/src/features/room/data/webrtc/sanitizeWhepAnswerSdp.ts` | `@kvatum/rtc` | Move helper as-is | No |
| `front_app/src/features/room/domain/sdp/videoCodecOrder.ts` | `@kvatum/rtc` | Move helper as-is | No |
| `front_app/src/features/room/data/repository/RoomSessionRepositoryImpl.ts` | `@kvatum/rtc` + adapters | Keep compatibility layer in app, extract orchestration by stages | Yes |

## Compatibility strategy

- Stage A: move pure helpers and UI primitives first.
- Stage B: replace imports in `front_app` with `@kvatum/*`.
- Stage C: keep compatibility adapter for `RoomSessionRepository` while SDK API stabilizes.
- Stage D: remove duplicated local helpers after parity tests pass.
