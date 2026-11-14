"""把下载的 CC0 素材剪辑成游戏需要的文件。python3 -I build_audio.py <素材目录> <输出目录>"""
import subprocess, sys, os, json
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
K_IMP = f'{SRC}/k_impact-sounds/Audio'
K_RPG = f'{SRC}/k_rpg-audio/Audio'
K_UI = f'{SRC}/k_interface-sounds/Audio'
O = f'{SRC}/oga'
credits = []

def ff(args):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr)

def enc(name):
    return ['-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '4', f'{OUT}/{name}.ogg']

def one(name, src, flt='', credit=None):
    """单个文件 + 可选滤镜"""
    ff(['-i', src] + (['-af', flt] if flt else []) + enc(name))
    if credit: credits.append((name, *credit))

def mix(name, srcs, flt_each, post='', credit=None):
    """多个文件叠在一起"""
    args = []
    for s in srcs: args += ['-i', s]
    fc = ''.join(f'[{i}]{f}[a{i}];' for i, f in enumerate(flt_each))
    fc += ''.join(f'[a{i}]' for i in range(len(srcs))) + f'amix=inputs={len(srcs)}:normalize=0:duration=longest'
    fc += (',' + post if post else '') + '[o]'
    ff(args + ['-filter_complex', fc, '-map', '[o]'] + enc(name))
    if credit: credits.append((name, *credit))

def loop(name, src, start, length, xf=2.0, flt='', credit=None):
    """无缝循环：取 [start, start+length]，再把紧接着的 xf 秒淡出后叠到开头（开头同时淡入），首尾就接上了。
    同一个文件作为两个输入分别裁剪（asplit 后各自 atrim 会因缓冲出错）。"""
    pre = (flt + ',') if flt else ''
    fc = (f'[0]{pre}atrim={start}:{start + length},asetpts=PTS-STARTPTS,afade=t=in:d={xf}[head];'
          f'[1]{pre}atrim={start + length}:{start + length + xf},asetpts=PTS-STARTPTS,afade=t=out:d={xf}[tail];'
          f'[head][tail]amix=inputs=2:normalize=0:duration=first[o]')
    ff(['-i', src, '-i', src, '-filter_complex', fc, '-map', '[o]'] + enc(name))
    if credit: credits.append((name, *credit))

def synth(name, expr_args, flt='', note='用 ffmpeg 合成（本项目原创，无外部素材）'):
    ff(['-f', 'lavfi'] + expr_args + (['-af', flt] if flt else []) + enc(name))
    credits.append((name, '—', '—', note))

KEN = ('Kenney', 'https://kenney.nl/assets/{}', 'CC0')
def ken(pack): return (KEN[0], KEN[1].format(pack), KEN[2])
def oga(slug, author): return (author, f'https://opengameart.org/content/{slug}', 'CC0')

# ---------------- 脚步
one('step_walk', f'{K_IMP}/footstep_wood_001.ogg', 'volume=0.9', ken('impact-sounds'))
one('step_run', f'{K_IMP}/footstep_wood_003.ogg', 'volume=1.2,atempo=1.15', ken('impact-sounds'))
mix('crawl', [f'{K_RPG}/cloth2.ogg', f'{K_IMP}/impactMetal_light_001.ogg'], ['volume=1', 'volume=0.35,adelay=80'], credit=('Kenney', 'https://kenney.nl/assets/rpg-audio , https://kenney.nl/assets/impact-sounds', 'CC0'))
# ---------------- 门、撞击
one('door_open', f'{K_RPG}/doorOpen_1.ogg', '', ken('rpg-audio'))
one('door_lock', f'{K_RPG}/metalLatch.ogg', '', ken('rpg-audio'))
one('door_bang', f'{K_IMP}/impactWood_heavy_000.ogg', 'volume=1.3,lowpass=f=2500', ken('impact-sounds'))
mix('door_burst', [f'{K_IMP}/impactWood_heavy_002.ogg', f'{K_IMP}/impactPlank_medium_001.ogg', f'{K_IMP}/impactWood_heavy_004.ogg'], ['volume=1.3', 'volume=1,adelay=60', 'volume=0.9,adelay=180'], credit=ken('impact-sounds'))
one('scissors', f'{K_RPG}/knifeSlice2.ogg', 'asetrate=44100*1.15,aresample=44100', ken('rpg-audio'))
one('rope_creak', f'{K_RPG}/creak1.ogg', 'volume=1.2', ken('rpg-audio'))
mix('fall_crash', [f'{K_IMP}/impactSoft_heavy_001.ogg', f'{K_IMP}/impactWood_heavy_003.ogg'], ['volume=1.3', 'volume=0.8,adelay=40'], 'lowpass=f=3000', ken('impact-sounds'))
one('plaster_break', f'{K_IMP}/impactPlate_heavy_001.ogg', 'volume=1.2', ken('impact-sounds'))
mix('piano_crash', [f'{K_IMP}/impactWood_heavy_001.ogg', f'{K_IMP}/impactBell_heavy_002.ogg', f'{K_IMP}/impactMetal_heavy_003.ogg'], ['volume=1.2', 'asetrate=44100*0.6,aresample=44100,volume=0.8', 'volume=0.6,adelay=50'], credit=ken('impact-sounds'))
mix('glass_crack', [f'{K_IMP}/impactGlass_heavy_000.ogg', f'{K_IMP}/impactGlass_medium_002.ogg'], ['volume=1.1', 'volume=0.8,adelay=120'], credit=ken('impact-sounds'))
one('paper', f'{K_RPG}/bookFlip2.ogg', '', ken('rpg-audio'))
one('scribble', f'{K_UI}/scratch_003.ogg', 'volume=0.9', ken('interface-sounds'))
one('phone_fail', f'{K_UI}/error_004.ogg', '', ken('interface-sounds'))
one('metronome', f'{K_UI}/tick_001.ogg', 'volume=1.3', ken('interface-sounds'))
mix('gate_open', [f'{K_RPG}/creak3.ogg', f'{K_RPG}/doorOpen_2.ogg'], ['asetrate=44100*0.7,aresample=44100,volume=1.2', 'asetrate=44100*0.75,aresample=44100,adelay=250'], 'aecho=0.8:0.6:120:0.3', credit=ken('rpg-audio'))
# 挂钟：一秒一下
ff(['-i', f'{K_UI}/tick_002.ogg', '-af', 'apad=whole_dur=1,atrim=0:1,volume=1.2'] + enc('clock_tick'))
credits.append(('clock_tick', 'Kenney', 'https://kenney.nl/assets/interface-sounds', 'CC0'))

# ---------------- 恐怖音效（OpenGameArt）
one('roar', f'{O}/cc0-deep-monster-roar/monster_roar.wav', 'atrim=0.15:3.4,afade=t=out:st=2.6:d=0.65', oga('cc0-deep-monster-roar', 'trazzz123'))
one('sting', f'{O}/excited-horror-sound/excited_horror_sound.wav', 'atrim=0:3,afade=t=out:st=2.2:d=0.8', oga('excited-horror-sound', 'remaxim'))
one('ending_hit', f'{O}/muffled-distant-explosion/NenadSimic_-_Muffled_Distant_Explosion.wav', 'atrim=0:3,lowpass=f=900,afade=t=out:st=1.6:d=1.4', oga('muffled-distant-explosion', 'nenadsimic'))
one('sanity_drop', f'{O}/muffled-distant-explosion/NenadSimic_-_Muffled_Distant_Explosion.wav', 'atrim=0:1.2,asetrate=44100*0.75,aresample=44100,lowpass=f=600,volume=0.8,afade=t=out:st=0.6:d=0.7', oga('muffled-distant-explosion', 'nenadsimic'))
loop('heartbeat', f'{O}/heartbeat-sounds/heartbeat_slow_reverb.wav', 0, 1.6, 0.15, credit=oga('heartbeat-sounds', 'bart'))
# 门后的说话声：把诡异的低语闷在门后（低通 + 混响）
chants = [f'{O}/creepy-incoherent-chanting/unz/chant{i}.wav' for i in (3, 6, 7, 12, 18)]
args = []
for c in chants: args += ['-i', c]
fc = ''.join(f'[{i}]aresample=44100,aformat=channel_layouts=mono[c{i}];' for i in range(len(chants)))
fc += ''.join(f'[c{i}]' for i in range(len(chants))) + f'concat=n={len(chants)}:v=0:a=1,lowpass=f=650,aecho=0.8:0.7:60:0.4,volume=1.6[w]'
ff(args + ['-filter_complex', fc, '-map', '[w]', '-ac', '1', '-ar', '44100', f'{SRC}/whisper_raw.wav'])
loop('whisper', f'{SRC}/whisper_raw.wav', 0, 22, 2, credit=oga('creepy-incoherent-chanting', 'owlishmedia'))
# 合唱：缥缈的吟唱接起来
ch2 = [f'{O}/creepy-incoherent-chanting/unz/ethereal_chant_Subclip {n:02d}_{n:02d}.wav' for n in (3, 6, 11, 14, 17, 19)]
args = []
for c in ch2: args += ['-i', c]
fc = ''.join(f'[{i}]aresample=44100,aformat=channel_layouts=mono[c{i}];' for i in range(len(ch2)))
fc += ''.join(f'[c{i}]' for i in range(len(ch2))) + f'concat=n={len(ch2)}:v=0:a=1,aecho=0.8:0.6:200:0.35[w]'
ff(args + ['-filter_complex', fc, '-map', '[w]', '-ac', '1', '-ar', '44100', f'{SRC}/choir_raw.wav'])
loop('amb_choir', f'{SRC}/choir_raw.wav', 0, 45, 3, credit=oga('creepy-incoherent-chanting', 'owlishmedia'))
# ---------------- 环境音
loop('amb_night', f'{O}/park-ambiences/park_ambience_wind.wav', 30, 40, 3, 'lowpass=f=1800,volume=1.4', oga('park-ambiences', 'thimras'))
loop('amb_dawn', f'{O}/ambient-bird-sounds/birds-isaiah658_0.ogg', 0, 27, 3, '', oga('ambient-bird-sounds', 'isaiah658'))
loop('amb_pipe', f'{O}/ambient-horror/ambient_horror_0.ogg', 1, 18, 2.5, 'lowpass=f=1200,aecho=0.8:0.7:90:0.4', oga('ambient-horror', 'techiew'))
loop('amb_quiet', f'{O}/droning-sound-effects/drone53.wav', 10, 40, 4, 'lowpass=f=500,volume=0.6', oga('droning-sound-effects', 'bretbernhoft'))
loop('amb_harsh', f'{O}/a-detuned-memory/creepy_piano_0.mp3', 20, 30, 2, 'acrusher=bits=8:mode=log:aa=1:samples=2,volume=1.2', oga('a-detuned-memory', 'tarush-singhal'))
# 灯管嗡鸣：合成（120Hz 及谐波 + 少量噪声 + 不稳的颤动）
synth('amb_hum', ['-i', 'aevalsrc=0.10*sin(2*PI*120*t)+0.05*sin(2*PI*240*t)+0.025*sin(2*PI*360*t)+0.015*sin(2*PI*600*t)*(0.6+0.4*sin(2*PI*0.5*t)):s=44100:d=20'], 'volume=1.4')
# 拨号音：440 + 480 Hz，两声
synth('phone_dial', ['-i', "aevalsrc=0.18*(sin(2*PI*440*t)+sin(2*PI*480*t))*lt(mod(t\\,3)\\,1.2):s=44100:d=3.2"], 'afade=t=out:st=2.9:d=0.3')
# 远处的推车：低沉的滚动声 + 轮子的小碰撞
ff(['-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.6:d=3.5', '-i', f'{K_IMP}/impactMetal_light_002.ogg', '-i', f'{K_IMP}/impactMetal_light_004.ogg',
    '-filter_complex', '[0]lowpass=f=260,afade=t=in:d=1.2,afade=t=out:st=2.2:d=1.3,volume=1.6[r];[1]volume=0.25,adelay=900[m1];[2]volume=0.2,adelay=2100[m2];[r][m1][m2]amix=inputs=3:normalize=0[o]',
    '-map', '[o]'] + enc('cart'))
credits.append(('cart', 'Kenney（轮子的碰撞声）+ ffmpeg 合成的滚动声', 'https://kenney.nl/assets/impact-sounds', 'CC0'))

# ---------------- 统一音量（按测得的平均响度调整，单位 dB）
GAIN = {'sting': 22, 'amb_night': 10, 'amb_choir': 6, 'paper': 12, 'heartbeat': 4, 'amb_quiet': -10, 'amb_harsh': -8, 'amb_dawn': 3}
for n, g in GAIN.items():
    tmp = f'{SRC}/_gain.ogg'
    ff(['-i', f'{OUT}/{n}.ogg', '-af', f'volume={g}dB,alimiter=limit=0.95'] + ['-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '4', tmp])
    os.replace(tmp, f'{OUT}/{n}.ogg')

json.dump(credits, open(f'{SRC}/credits.json', 'w'), ensure_ascii=False, indent=1)
print('built', len(credits))
