/// <reference types="vite/client" />

declare module 'virtual:asset-list' {
  /** assets/ 下实际存在的音频文件（相对路径，例如 "audio/amb_hum.ogg"） */
  export const audioFiles: string[];
}
