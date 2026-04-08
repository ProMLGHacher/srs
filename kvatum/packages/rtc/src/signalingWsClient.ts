import type { SignalingInbound } from "./types"

export type SignalingWsClientOptions = {
  url: string
  onMessage: (msg: SignalingInbound) => void
  onStateChange?: (readyState: number) => void
}

export function createSignalingWsClient(opts: SignalingWsClientOptions) {
  let ws: WebSocket | null = null
  return {
    connect() {
      ws = new WebSocket(opts.url)
      ws.onopen = () => opts.onStateChange?.(ws?.readyState ?? WebSocket.CLOSED)
      ws.onclose = () => opts.onStateChange?.(WebSocket.CLOSED)
      ws.onmessage = (event) => {
        const parsed = JSON.parse(String(event.data)) as SignalingInbound
        opts.onMessage(parsed)
      }
    },
    send(payload: unknown) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
    },
    close() {
      ws?.close()
      ws = null
    },
  }
}
