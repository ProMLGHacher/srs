/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  /** Optional JSON array of RTCIceServer for TURN / extra STUN (LAN-MVP+). */
  readonly VITE_ICE_SERVERS_JSON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
