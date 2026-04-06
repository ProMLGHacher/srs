/** Стабильный peer id на вкладку (sessionStorage). */
export abstract class TabPeerIdRepository {
  abstract getOrCreatePeerId(): string
}
