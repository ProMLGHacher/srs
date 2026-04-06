import type { ReactNode } from "react"
import type { RoomPageSnapshot } from "../../domain/model/roomPageSnapshot"

type RoomDebugPanelProps = {
  snap: RoomPageSnapshot
  localPeerId: string
}

function diagRows(label: string, d: RoomPageSnapshot["publishPeer"]): ReactNode {
  if (!d) {
    return (
      <p className="text-[var(--kvt-color-on-surface-variant)]">
        {label}: <span className="text-[var(--kvt-color-on-surface)]">—</span>
      </p>
    )
  }
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2 font-mono text-xs">
      <p className="font-sans text-[10px] uppercase tracking-wide text-[var(--kvt-color-on-surface-variant)]">
        {label} ({d.role}) {d.targetPeerId.slice(0, 8)}…
      </p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-[var(--kvt-color-on-surface-variant)]">connection</dt>
        <dd>{d.connectionState}</dd>
        <dt className="text-[var(--kvt-color-on-surface-variant)]">ice</dt>
        <dd>{d.iceConnectionState}</dd>
        <dt className="text-[var(--kvt-color-on-surface-variant)]">iceGather</dt>
        <dd>{d.iceGatheringState}</dd>
        <dt className="text-[var(--kvt-color-on-surface-variant)]">signaling</dt>
        <dd>{d.signalingState}</dd>
      </dl>
    </div>
  )
}

export function RoomDebugPanel({ snap, localPeerId }: RoomDebugPanelProps) {
  return (
    <details className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4 text-sm open:bg-white/[0.07]">
      <summary className="cursor-pointer font-medium text-[var(--kvt-color-on-surface)]">
        Состояние соединений (отладка)
      </summary>
      <div className="mt-4 space-y-4 text-[var(--kvt-color-on-surface)]">
        <div className="rounded-md border border-white/10 bg-black/20 p-3 font-mono text-xs">
          <p className="mb-2 font-sans text-[11px] font-medium text-[var(--kvt-color-primary)]">WebSocket сигналинг</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-[var(--kvt-color-on-surface-variant)]">wsReady</dt>
            <dd>{String(snap.wsReady)}</dd>
            <dt className="text-[var(--kvt-color-on-surface-variant)]">readyState</dt>
            <dd>{snap.wsReadyState}</dd>
            <dt className="text-[var(--kvt-color-on-surface-variant)]">URL</dt>
            <dd className="break-all">{snap.signalingWsUrl || "—"}</dd>
          </dl>
        </div>

        <div className="rounded-md border border-white/10 bg-black/20 p-3 font-mono text-xs">
          <p className="mb-2 font-sans text-[11px] font-medium text-[var(--kvt-color-primary)]">Комната / медиа</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-[var(--kvt-color-on-surface-variant)]">localPeer</dt>
            <dd className="break-all">{localPeerId}</dd>
            <dt className="text-[var(--kvt-color-on-surface-variant)]">isPublishing</dt>
            <dd>{String(snap.isPublishing)}</dd>
            <dt className="text-[var(--kvt-color-on-surface-variant)]">mediaEpoch</dt>
            <dd>{snap.mediaEpoch}</dd>
            <dt className="text-[var(--kvt-color-on-surface-variant)]">remotePeerIds</dt>
            <dd className="break-all">{snap.remotePeerIds.length ? snap.remotePeerIds.join(", ") : "—"}</dd>
          </dl>
        </div>

        {diagRows("Публикация (WHIP)", snap.publishPeer)}

        <div>
          <p className="mb-2 text-xs font-medium text-[var(--kvt-color-on-surface-variant)]">
            Подписки (WHEP), шт. {snap.subscribePeers.length}
          </p>
          <div className="space-y-2">
            {snap.subscribePeers.length === 0 ? (
              <p className="text-xs text-[var(--kvt-color-on-surface-variant)]">Нет активных подписок</p>
            ) : (
              snap.subscribePeers.map((p) => (
                <div key={p.targetPeerId}>{diagRows(`Участник ${p.targetPeerId.slice(0, 8)}…`, p)}</div>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-[var(--kvt-color-on-surface-variant)]">JSON снимка</p>
          <pre className="max-h-48 overflow-auto rounded-md border border-white/10 bg-black/40 p-2 text-[10px] leading-relaxed text-[var(--kvt-color-on-surface-variant)]">
            {JSON.stringify(snap, null, 2)}
          </pre>
        </div>
      </div>
    </details>
  )
}
