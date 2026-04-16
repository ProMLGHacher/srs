/** Фильтр в консоли DevTools: `webrtc-timing` */

export const WEBRTC_TIMING_FILTER = "webrtc-timing"

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Короткий id для логов (не светим полный UUID). */
export function shortPeerId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`
}

/**
 * Цепочка замеров внутри одной операции: `stepMs` — от предыдущего маркера, `totalMs` — от начала сессии.
 */
export function startWebrtcTiming(scope: string, ctx?: Record<string, unknown>) {
  const t0 = performance.now()
  let last = t0
  const base = ctx ?? {}
  return {
    mark(phase: string, extra?: Record<string, unknown>) {
      const now = performance.now()
      const stepMs = round1(now - last)
      const totalMs = round1(now - t0)
      last = now
      console.info(`[${WEBRTC_TIMING_FILTER}]`, scope, phase, { stepMs, totalMs, ...base, ...extra })
    },
    end(phase = "DONE", extra?: Record<string, unknown>) {
      const totalMs = round1(performance.now() - t0)
      console.info(`[${WEBRTC_TIMING_FILTER}]`, scope, phase, { totalMs, ...base, ...extra })
    },
  }
}

/** Разовый лог без сессии. */
export function logWebrtcTiming(scope: string, phase: string, extra?: Record<string, unknown>): void {
  console.info(`[${WEBRTC_TIMING_FILTER}]`, scope, phase, extra ?? {})
}
