/// <reference types="vite/client" />

/** 明確宣告本專案用到的環境變數，避免在程式裡對 import.meta.env 做型別斷言 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
