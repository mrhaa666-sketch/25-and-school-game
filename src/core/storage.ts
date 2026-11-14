/**
 * 存储后端。网页调试用 localStorage；
 * 之后 Electron 版在 preload 里注入 window.gameStorage（写入用户目录的 JSON 文件），这里会自动改用它。
 */
export interface StorageBackend {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

declare global {
  interface Window {
    gameStorage?: StorageBackend;
  }
}

const memory = new Map<string, string>();

const localBackend: StorageBackend = {
  read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

export function getStorage(): StorageBackend {
  return (typeof window !== 'undefined' && window.gameStorage) || localBackend;
}
