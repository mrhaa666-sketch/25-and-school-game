/**
 * 文本查找。所有台词都在 src/data/text/zh-CN.json。
 * t('act02.mirror') 依次查找：当前周目覆盖（c2.act02.mirror / final.act02.mirror）→ common.act02.mirror。
 */
import textJson from '../data/text/zh-CN.json';
import type { CycleId } from './types';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const TEXT = textJson as unknown as Record<string, Json>;

function dig(root: Json | undefined, path: string): Json | undefined {
  let node: Json | undefined = root;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
    node = (node as Record<string, Json>)[part];
  }
  return node;
}

function overrideRoot(cycle: CycleId): string {
  return cycle === 'final' ? 'final' : `c${cycle}`;
}

/** 查找剧情文本，返回字符串或字符串数组（多行对白）。 */
export function tStory(key: string, cycle: CycleId): string | string[] {
  const v = dig(TEXT[overrideRoot(cycle)], key) ?? dig(TEXT.common, key);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(String);
  console.warn(`[text] 缺少文本：${key}`);
  return `【${key}】`;
}

export function tLines(key: string, cycle: CycleId): string[] {
  const v = tStory(key, cycle);
  return Array.isArray(v) ? v : [v];
}

/** UI 等不随周目变化的文本 */
export function tUi(key: string): string {
  const v = dig(TEXT.ui, key);
  return typeof v === 'string' ? v : `【ui.${key}】`;
}

export function tUiList(key: string): string[] {
  const v = dig(TEXT.ui, key);
  return Array.isArray(v) ? v.map(String) : [];
}

export function tRaw<T = unknown>(key: string): T {
  return dig(TEXT as unknown as Json, key) as T;
}

export function cycleCountLabel(n: number): string {
  const numerals = tUiList('cycleCountNumerals');
  const num = n < numerals.length ? numerals[n] : String(n);
  return tUi('cycleCountFormat').replace('{n}', num);
}
