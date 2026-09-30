/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Socket server override (see `src/config.ts`). */
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
