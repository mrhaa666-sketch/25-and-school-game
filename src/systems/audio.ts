/**
 * 音效。
 *
 * 文件放在 assets/audio/<名字>.ogg（也可以是 .mp3 / .wav / .m4a），名字见 SOUNDS。
 * 缺少的文件不会加载、不会报错，对应的地方就是安静的。清单与搜索建议见 docs/sound-list.md。
 */
import Phaser from 'phaser';
import { audioFiles } from 'virtual:asset-list';

export interface SoundDef {
  /** 默认音量 0~1 */
  vol: number;
  loop?: boolean;
}

/** 所有用到的声音（名字 = 文件名，不带扩展名） */
export const SOUNDS = {
  // ---- 环境（循环）
  amb_hum: { vol: 0.35, loop: true }, // 灯管的电流嗡鸣，学校里的底噪
  amb_quiet: { vol: 0.35, loop: true }, // 空荡荡的建筑、深夜（终周目）
  amb_night: { vol: 0.4, loop: true }, // 校外的夜：远处的风（第一幕、终周目校门口）
  amb_pipe: { vol: 0.45, loop: true }, // 金属管道里的低沉回响（第七幕）
  amb_harsh: { vol: 0.5, loop: true }, // 刺耳、不和谐的钢琴与噪音（第八幕）
  amb_choir: { vol: 0.45, loop: true }, // 诡异的合唱（第九幕）
  amb_dawn: { vol: 0.35, loop: true }, // 清晨：远处的鸟叫（结局 10 尾声）
  heartbeat: { vol: 0.5, loop: true }, // 心跳（精神值档位 4）
  whisper: { vol: 0.35, loop: true }, // 门后听不清的说话声（三周目）
  clock_tick: { vol: 0.3, loop: true }, // 挂钟的秒针（考场；补充周目的提示时更响）
  // ---- 脚步
  step_walk: { vol: 0.25 }, // 在旧木地板上走路的一步
  step_run: { vol: 0.3 }, // 奔跑的一步
  crawl: { vol: 0.3 }, // 在金属管道里爬（衣服摩擦金属）
  // ---- 事件
  metronome: { vol: 0.4 }, // 节拍器的一下（四周目）
  cart: { vol: 0.35 }, // 远处推车滚过的声音
  roar: { vol: 0.6 }, // 怪物的嘶吼
  door_bang: { vol: 0.6 }, // 有东西在撞门
  door_burst: { vol: 0.7 }, // 门被撞开
  door_open: { vol: 0.35 }, // 推开 / 拉开教室门
  door_lock: { vol: 0.45 }, // 锁门（金属）
  scissors: { vol: 0.6 }, // 剪刀剪断绳子
  rope_creak: { vol: 0.45 }, // 绳子被拉紧、吱呀作响
  fall_crash: { vol: 0.6 }, // 重物从高处摔下
  plaster_break: { vol: 0.6 }, // 石膏碎裂
  piano_crash: { vol: 0.6 }, // 钢琴摔碎，琴弦乱响一声
  glass_crack: { vol: 0.6 }, // 玻璃裂开、碎掉（奏碎开）
  paper: { vol: 0.4 }, // 翻动 / 拿起纸
  scribble: { vol: 0.35 }, // 铅笔快速写字（试卷自己写满）
  phone_fail: { vol: 0.35 }, // 发送失败的提示音
  phone_dial: { vol: 0.3 }, // 拨号音（之后是一片寂静）
  sting: { vol: 0.55 }, // 惊吓的一下（镜子里的人影）
  sanity_drop: { vol: 0.35 }, // 精神值下降时低沉的一下
  gate_open: { vol: 0.5 }, // 厚重的大门被推开
  ending_hit: { vol: 0.5 }, // 结局出现时低沉的一声
} satisfies Record<string, SoundDef>;

export type SoundKey = keyof typeof SOUNDS;

const fileOf = new Map<string, string>();
for (const f of audioFiles) {
  const name = f.replace(/^audio\//, '').replace(/\.[^.]+$/, '');
  if (name in SOUNDS && !fileOf.has(name)) fileOf.set(name, f);
}

/** Boot 场景里调用：只加载实际存在的文件 */
export function preloadAudio(scene: Phaser.Scene): void {
  for (const [name, file] of fileOf) scene.load.audio(`snd:${name}`, file);
}

const MUTE_KEY = '25-and-school/muted';

class AudioImpl {
  private game?: Phaser.Game;
  private channels = new Map<string, { key: SoundKey; sound: Phaser.Sound.BaseSound }>();
  private distorted = false;

  init(game: Phaser.Game): void {
    this.game = game;
    try {
      game.sound.mute = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* 读不到就默认有声音 */
    }
  }

  get muted(): boolean {
    return this.game?.sound.mute ?? false;
  }

  toggleMute(): void {
    if (!this.game) return;
    this.game.sound.mute = !this.game.sound.mute;
    try {
      localStorage.setItem(MUTE_KEY, this.game.sound.mute ? '1' : '0');
    } catch {
      /* 存不了也没关系 */
    }
  }

  private has(key: SoundKey): boolean {
    return !!this.game && this.game.cache.audio.exists(`snd:${key}`);
  }

  /** 播放一次。rate / detune 可以让重复的声音（脚步）不那么机械 */
  play(key: SoundKey, opts: { volume?: number; rate?: number; detune?: number } = {}): void {
    if (!this.has(key)) return;
    const def = SOUNDS[key] as SoundDef;
    this.game!.sound.play(`snd:${key}`, {
      volume: (opts.volume ?? 1) * def.vol,
      rate: opts.rate ?? 1,
      detune: (opts.detune ?? 0) + (this.distorted ? -150 : 0),
    });
  }

  /**
   * 某个通道上循环播放（环境音、心跳……）。同一通道换声音时淡出旧的、淡入新的。
   * key 为 null 时淡出并停止。
   */
  loop(channel: string, key: SoundKey | null, fadeMs = 1200, volume = 1): void {
    const cur = this.channels.get(channel);
    if (cur && cur.key === key) return;
    if (cur) {
      this.channels.delete(channel);
      this.fade(cur.sound, 0, fadeMs, true);
    }
    if (!key || !this.has(key) || !this.game) return;
    const def = SOUNDS[key] as SoundDef;
    const sound = this.game.sound.add(`snd:${key}`, { loop: true, volume: 0 });
    sound.play();
    this.fade(sound, def.vol * volume, fadeMs, false);
    this.channels.set(channel, { key, sound });
  }

  /** 停掉所有循环（回到标题等） */
  stopAll(fadeMs = 800): void {
    for (const ch of [...this.channels.keys()]) this.loop(ch, null, fadeMs);
  }

  /** 精神值档位 4：音频失真（整体降调） */
  setDistorted(on: boolean): void {
    if (this.distorted === on) return;
    this.distorted = on;
    for (const { sound } of this.channels.values()) (sound as Phaser.Sound.WebAudioSound).setDetune?.(on ? -150 : 0);
  }

  private fade(sound: Phaser.Sound.BaseSound, to: number, ms: number, stopAfter: boolean): void {
    const s = sound as Phaser.Sound.WebAudioSound;
    const from = s.volume ?? 0;
    const start = performance.now();
    const step = () => {
      // 淡入淡出途中声音已经被销毁（换场景、换频道）：直接停下
      if (!s.manager || s.pendingRemove) return;
      const k = Math.min(1, (performance.now() - start) / Math.max(1, ms));
      s.setVolume?.(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
      else if (stopAfter) {
        s.stop();
        s.destroy();
      }
    };
    step();
  }
}

export const Audio = new AudioImpl();
