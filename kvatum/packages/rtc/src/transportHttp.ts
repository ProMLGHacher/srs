export type PostSdpOptions = {
  baseUrl: string
  path: "/api/rtc/whip" | "/api/rtc/whep"
  peerId: string
  sdp: string
  signal?: AbortSignal
}

export async function postSdp({ baseUrl, path, peerId, sdp, signal }: PostSdpOptions): Promise<string> {
  const url = `${baseUrl}${path}?peer=${encodeURIComponent(peerId)}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: sdp,
    signal,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text}`)
  return text
}
