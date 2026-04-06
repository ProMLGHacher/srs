import { logRoomData } from "@/app/logging/kvtAppLog"
import {
  hasH264InCodecList,
  reorderVideoCodecsH264First,
  type VideoCodecCapability,
} from "../../domain/sdp/videoCodecOrder"

export type PublishRole = "publish" | "subscribe"

/** Порядок кодеков для transceiver (H.264 первым, где доступно). */
export function h264VideoCodecPreferences(role: PublishRole) {
  const sender = RTCRtpSender.getCapabilities?.("video")?.codecs ?? []
  const recv = RTCRtpReceiver.getCapabilities?.("video")?.codecs ?? []
  try {
    if (role === "publish") {
      if (hasH264InCodecList(sender as VideoCodecCapability[]))
        return reorderVideoCodecsH264First(sender)
      return []
    }
    if (hasH264InCodecList(recv as VideoCodecCapability[])) return reorderVideoCodecsH264First(recv)
    if (hasH264InCodecList(sender as VideoCodecCapability[])) return reorderVideoCodecsH264First(sender)
    return []
  } catch {
    return []
  }
}

export function applyH264VideoOnly(transceiver: RTCRtpTransceiver, role: PublishRole): void {
  const codecs = h264VideoCodecPreferences(role)
  if (!codecs.length || !transceiver?.setCodecPreferences) return
  try {
    transceiver.setCodecPreferences(codecs)
  } catch (e) {
    logRoomData.warn("H.264 setCodecPreferences failed", e)
  }
}
