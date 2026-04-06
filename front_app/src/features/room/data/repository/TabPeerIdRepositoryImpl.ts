import { logRoomData } from "@/app/logging/kvtAppLog"
import { TabPeerIdRepository } from "../../domain/repository/TabPeerIdRepository"

const STORAGE_KEY = "srs-room-peer"

export class TabPeerIdRepositoryImpl extends TabPeerIdRepository {
  override getOrCreatePeerId(): string {
    let id = sessionStorage.getItem(STORAGE_KEY)
    const created = !id
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(STORAGE_KEY, id)
    }
    logRoomData.debug("TabPeerId", { created, idPrefix: id.slice(0, 8) })
    return id
  }
}
