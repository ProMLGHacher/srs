export const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

export const SRS_APP = "live"

export function srsEip(): string {
  const env = import.meta.env.VITE_SRS_EIP as string | undefined
  if (env?.trim()) return env.trim()
  if (typeof window !== "undefined" && window.location.hostname) return window.location.hostname
  return "127.0.0.1"
}
