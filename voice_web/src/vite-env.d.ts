/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string
  readonly VITE_ICE_SERVERS_JSON?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
