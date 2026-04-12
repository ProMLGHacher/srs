import axios from "axios"
import { SRS_APP, srsEip } from "./constants"
import { logWebrtcTiming, shortPeerId } from "./timingLog"

export async function postSdp(path: "/srs/rtc/v1/whip/" | "/srs/rtc/v1/whep/", streamId: string, sdp: string): Promise<string> {
  const kind = path.includes("whip") ? "WHIP" : "WHEP"
  const t0 = performance.now()
  const params = new URLSearchParams({
    app: SRS_APP,
    stream: streamId,
    eip: srsEip(),
  })
  const url = `${path}?${params.toString()}`
  try {
    const res = await axios.post<string>(url, sdp, {
      headers: { "Content-Type": "application/sdp" },
      responseType: "text",
      transformResponse: (r) => (typeof r === "string" ? r : String(r)),
    })
    const ms = Math.round((performance.now() - t0) * 10) / 10
    logWebrtcTiming(`${kind}_http`, "axios_post_done", {
      stream: shortPeerId(streamId),
      ms,
      status: res.status,
      sdpOfferChars: sdp.length,
      sdpAnswerChars: typeof res.data === "string" ? res.data.length : 0,
    })
    return res.data
  } catch (e) {
    const ms = Math.round((performance.now() - t0) * 10) / 10
    logWebrtcTiming(`${kind}_http`, "axios_post_error", {
      stream: shortPeerId(streamId),
      ms,
      message: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}
