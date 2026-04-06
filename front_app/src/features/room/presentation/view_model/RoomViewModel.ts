import { logRoomPresentation } from "@/app/logging/kvtAppLog"
import { Inject, type ViewModel } from "@kvt/runtime"
import type { RoomPageSnapshot } from "../../domain/model/roomPageSnapshot"
import { RoomSessionRepository } from "../../domain/repository/RoomSessionRepository"
import { TabPeerIdRepository } from "../../domain/repository/TabPeerIdRepository"

export class RoomViewModel implements ViewModel<RoomPageSnapshot> {
  constructor(
    @Inject(RoomSessionRepository) private readonly _repo: RoomSessionRepository,
    @Inject(TabPeerIdRepository) private readonly _peer: TabPeerIdRepository,
  ) {}

  get state() {
    return this._repo.state
  }

  init = (): (() => void) => {
    logRoomPresentation.debug("RoomViewModel init")
    return () => {
      logRoomPresentation.debug("RoomViewModel dispose (unmount)")
      this._repo.dispose()
    }
  }

  attachRoom(roomId: string): void {
    logRoomPresentation.info("attachRoom", { roomId })
    this._repo.dispose()
    this._repo.initialize(roomId, this._peer.getOrCreatePeerId())
  }

  getPeerId(): string {
    return this._peer.getOrCreatePeerId()
  }

  startPublish(): Promise<void> {
    logRoomPresentation.info("startPublish requested")
    return this._repo.startPublishing()
  }

  stopPublish(): void {
    logRoomPresentation.info("stopPublish requested")
    this._repo.stopPublishing()
  }

  getRemoteStream(peerId: string): MediaStream | undefined {
    return this._repo.getRemoteStream(peerId)
  }

  getLocalPreviewStream(): MediaStream | null {
    return this._repo.getLocalPreviewStream()
  }
}
