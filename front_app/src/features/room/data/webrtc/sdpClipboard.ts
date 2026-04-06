import { logRoomData } from "@/app/logging/kvtAppLog"

export async function copyLocalSdpToClipboard(sdp: string | undefined, label: string): Promise<void> {
  if (!sdp) return
  const text = `--- WebRTC local SDP [${label}] ---\n${sdp}`
  try {
    await navigator.clipboard.writeText(text)
    logRoomData.info("SDP скопирован в буфер", { label })
  } catch (e) {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.setAttribute("readonly", "")
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      logRoomData.info("SDP скопирован (fallback)", { label })
    } catch (e2) {
      logRoomData.warn("SDP: буфер обмена недоступен", e, e2)
    }
  }
}
