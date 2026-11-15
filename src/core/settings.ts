import { getStorage } from './storage';

/**
 * 玩家设置（和存档分开保存，换周目、删存档都不影响）。
 * - brightness：亮度 0 正常 / 1 亮一些 / 2 更亮（黑暗层变淡、身边的光变大）
 * - calm：减弱闪光和晃屏
 */
export interface Settings {
  brightness: 0 | 1 | 2;
  calm: boolean;
}

const KEY = '25-and-school/settings';

function load(): Settings {
  try {
    const raw = getStorage().read(KEY);
    if (raw) return { brightness: 0, calm: false, ...JSON.parse(raw) };
  } catch {
    /* 读不到就用默认 */
  }
  return { brightness: 0, calm: false };
}

export const settings: Settings = load();

export function saveSettings(): void {
  getStorage().write(KEY, JSON.stringify(settings));
}
