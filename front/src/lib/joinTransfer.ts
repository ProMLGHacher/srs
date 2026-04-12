/** Несериализуемый перенос MediaStream с лобби в комнату (в пределах одной вкладки). */
let pendingStream: MediaStream | null = null

export function setPendingJoinStream(stream: MediaStream | null): void {
  pendingStream = stream
}

export function takePendingJoinStream(): MediaStream | null {
  const s = pendingStream
  pendingStream = null
  return s
}

/** Остановить и сбросить поток, если комната не открылась (невалидный id, уход со страницы). */
export function releasePendingJoinStream(): void {
  const s = pendingStream
  pendingStream = null
  s?.getTracks().forEach((t) => {
    try {
      t.stop()
    } catch {
      /* ignore */
    }
  })
}
