/** Правило входа: непустой trimmed room id → один сегмент path с encodeURIComponent. */
export class ResolveRoomNavigationUseCase {
  execute(raw: string): { ok: false } | { ok: true; pathSegment: string } {
    const trimmed = raw.trim()
    if (!trimmed) return { ok: false }
    return { ok: true, pathSegment: encodeURIComponent(trimmed) }
  }
}
