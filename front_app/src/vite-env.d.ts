/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIGNAL_URL?: string
  readonly VITE_SIGNAL_WS?: string
  readonly VITE_SRS_EIP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
