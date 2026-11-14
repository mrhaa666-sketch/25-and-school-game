# 音效清单

把找到的音效放进 `assets/audio/`，**文件名就是下表的「文件」**（扩展名用 `.ogg`、`.mp3`、`.wav`、`.m4a` 都可以），然后重启 `npm run dev`。
缺哪个，游戏里那个地方就是安静的，不会报错。

## 0. 找素材的规则

### 授权（重要）

| 授权 | 能不能用 | 要做什么 |
|---|---|---|
| **CC0 / 公有领域** | ✅ 首选 | 不用署名（建议还是记进 `CREDITS.md`） |
| **CC BY** | ✅ | **必须署名**：作者、原链接、授权，写进 `CREDITS.md` |
| Pixabay Content License | ✅ | 可以用在游戏里，不能把音效单独再分发 |
| **CC BY-NC**（非商业） | ⚠️ 同人非商业可以用，但以后想卖就不行 | 署名 |
| CC BY-SA / BY-ND | ❌ 不建议 | 会给整个游戏带来额外的分享 / 不得修改的要求 |
| 没写授权、从视频或游戏里扒的 | ❌ | — |

每用一个文件，就在 `CREDITS.md` 里记一行（文件名、作者、来源链接、授权）。

### 去哪里找

- **Freesound**（freesound.org）：最全。左侧筛选 License 选 **Creative Commons 0**。需要注册才能下载。
- **OpenGameArt**（opengameart.org）：搜索后在 License 里勾选 CC0。
- **Kenney**（kenney.nl/assets，分类 Audio）：全部 CC0，脚步、开门、撞击都有。
- **Pixabay**（pixabay.com/sound-effects）：免注册，授权见上表。
- **Sonniss GDC 免费包**（sonniss.com/gameaudiogdc）：专业音效库，免版税可商用。

### 处理

- 用 Audacity 剪掉前后的空白；**循环音**（标了 🔁 的）要让首尾能接上，听不出断点。
- 统一导出为 `.ogg`（品质 5 左右即可），单个文件尽量小于 1MB，循环音 10~30 秒就够。
- 音量不用太准，游戏里每个声音都有默认音量（在 `src/systems/audio.ts` 的 `SOUNDS` 里，可以调）。

---

## 1. 环境音 🔁

| 文件 | 用在哪里 | 要什么样的声音 | 搜索关键词 |
|---|---|---|---|
| `amb_hum` | 一~四周目的学校里（底噪） | 日光灯管的电流嗡鸣，低沉、持续，偶尔有一点不稳的滋滋声 | fluorescent light hum, electrical buzz, flickering tube |
| `amb_quiet` | 终周目 | 深夜空荡荡的建筑，几乎听不到东西，只有很轻的空气声 | empty building room tone, night silence, quiet interior |
| `amb_night` | 第一幕（校门外）、终周目的校门口 | 深夜的户外，远处的风，没有人声 | night ambience wind distant, rural night quiet |
| `amb_pipe` | 第七幕的管道 | 金属管道 / 通风管里的低沉回响和风声 | metal duct ambience, ventilation shaft, pipe resonance drone |
| `amb_harsh` | 第八幕的音乐室 | 刺耳、不和谐的钢琴，混着失真的噪音，让人想捂住耳朵 | dissonant piano, atonal piano horror, distorted piano noise |
| `amb_choir` | 第九幕的邀请 | 诡异、轻柔的合唱，像小孩子或很多人在远处一起哼 | eerie choir, creepy children choir humming, ghostly voices |
| `amb_dawn` | 结局 10 尾声 | 清晨的空地，远处的鸟叫，安静、平和 | dawn birds ambience, early morning field |
| `heartbeat` | 精神值很低（≤25）时 | 缓慢、闷闷的心跳 | heartbeat slow, heart beat muffled |
| `whisper` | 三周目，粉色的门后 | 听不清内容的窃窃私语、闷在门后的说话声 | whispers unintelligible, muffled voices behind door |
| `clock_tick` | 第五幕考场 | 挂钟的秒针，一秒一下 | clock ticking, wall clock tick |

## 2. 脚步

每次播放时游戏会随机改一点音高，所以**每种只需要一步**（一个短声音）。

| 文件 | 要什么样的声音 | 搜索关键词 |
|---|---|---|
| `step_walk` | 在旧木地板上走路的一步，轻 | footstep wood floor single, footstep school hallway |
| `step_run` | 奔跑的一步，更重更快 | footstep run wood single |
| `crawl` | 在金属管道里爬：衣服蹭过金属、膝盖碰一下 | crawling metal duct, clothes rustle metal |

## 3. 事件（单次）

| 文件 | 用在哪里 | 要什么样的声音 | 搜索关键词 |
|---|---|---|---|
| `metronome` | 四周目，每一拍 | 机械节拍器「嗒」的一声 | metronome click single, metronome tick |
| `cart` | 第二幕，第一次走进四楼走廊时 | 远处的医用推车 / 手推车滚过地面 | hospital cart rolling distant, trolley rolling |
| `roar` | 怪物出现（追逐战 1、第四幕楼上） | 不像人的嘶吼、尖叫，带一点回响 | monster roar horror, creature scream, ghost shriek |
| `door_bang` | 有东西在撞门 | 重物撞在木门上的闷响 | door banging heavy, door slam knock wood |
| `door_burst` | 门被撞开 | 门被猛地撞开、撞到墙上 | door burst open, door kicked open |
| `door_open` | 进出房间 | 旧拉门 / 木门打开 | old door open creak, sliding door school |
| `door_lock` | 锁门（教室门、铁门） | 金属门锁咔哒一声 | door lock click, metal latch |
| `scissors` | 剪断绳子 | 剪刀剪断粗绳的一下 | scissors cut rope, snip |
| `rope_creak` | 攀爬时被往上拉 | 绳子被拉紧时吱呀作响 | rope creak tension, rope stretch |
| `fall_crash` | 掉下去 / 怪物摔下去 | 重物从高处摔在地上 | body fall heavy, thud impact ground |
| `plaster_break` | 二周目：石膏像摔碎 | 石膏 / 陶瓷碎裂 | plaster break, ceramic shatter |
| `piano_crash` | 四周目：钢琴摔碎 | 钢琴摔碎，琴弦一起乱响 | piano crash, piano strings slam, piano fall |
| `glass_crack` | 第八幕：奏碎开 | 玻璃裂开、碎掉 | glass crack shatter |
| `paper` | 拿到材料、被乐谱割到 | 拿起 / 翻动一张纸 | paper rustle, paper pick up |
| `scribble` | 结局 5：试卷自己写满 | 铅笔在纸上飞快地写 | pencil writing fast, scribble paper |
| `phone_fail` | 手机：发送失败 | 短促的错误提示音 | phone error beep, message failed |
| `phone_dial` | 手机：打电话（之后没有声音） | 拨号音，一两声就好 | phone dial tone, calling tone |
| `sting` | 镜子里的人影、小女孩回头、「不同意」被吃掉 | 短促的惊吓音效 | horror stinger, jump scare hit |
| `sanity_drop` | 精神值下降 | 低沉的一下，像耳鸣或闷响 | low boom, deep hit dark, tinnitus |
| `gate_open` | 推开学校大门 | 厚重的铁门 / 大门被推开 | heavy gate open, iron gate creak |
| `ending_hit` | 每个结局出现时 | 低沉、拖长的一声 | dark drone hit, cinematic boom low |

---

还没用上的：文档里提到的「声音失真」目前是整体降调实现的；如果之后想要更像收音机坏掉的效果，可以再加滤镜。
