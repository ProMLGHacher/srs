import axios from "axios"
import { SRS_APP, srsEip } from "./constants"

export async function postSdp(path: "/srs/rtc/v1/whip/" | "/srs/rtc/v1/whep/", streamId: string, sdp: string): Promise<string> {
  const params = new URLSearchParams({
    app: SRS_APP,
    stream: streamId,
    eip: srsEip(),
  })
  const url = `${path}?${params.toString()}`
  const res = await axios.post<string>(url, sdp, {
    headers: { "Content-Type": "application/sdp" },
    responseType: "text",
    transformResponse: (r) => (typeof r === "string" ? r : String(r)),
  })
  return res.data
}
