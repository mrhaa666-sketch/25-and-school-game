# 美术素材提示词清单

给图片生成用（GPT 生图）。压缩包里的 `references/` 是参考图，每条提示词都注明了要一起上传哪几张。
生成后按「文件」一栏的路径放进游戏仓库的 `assets/`，M6 会按这些文件名读取，替换现在的色块占位。

---

## 0. 使用说明

### 0.1 两种画风

人物和场景是**两种画风**，每个条目标题后标了【人物】或【场景】：

- **【人物】**：Q 版小人（第 1 节，以及第 3 节里的「真冬们」）。已经过关，照第 0.3 节的限制继续。
- **【场景】**：偏写实的暗色手绘（第 2~7 节的其余所有条目）。照第 0.2 节的限制。

### 0.2 【场景】前缀（整段复制，放在每条提示词最前面）

```
【风格硬性规则——每一条都必须遵守】
1. 画风：偏写实的暗色手绘，厚涂油画笔触。不是卡通，不是动漫，不是赛璐璐，不是 Q 版，不是 3D 渲染，也不是照片。
2. 线条：完全没有描边、线稿和轮廓线。物体的边缘只靠明暗区分，边缘松散、略带晕染。
3. 色板：整体饱和度很低（不超过 20%）。暗部 #0D0F12～#1C1F24，中间调 #2F3439、#4A4F52、#5B554C，最亮的地方不超过 #B8B4A8。不出现纯白、纯黑以外的鲜艳颜色。
4. 光照：只有一个光源，从画面左上方照下来，是冷色的灯管光或月光。画面至少 70% 处在阴影里。没有补光，没有轮廓光，没有发光、辉光、光晕和镜头光斑。
5. 质感：整张图有明显的胶片颗粒和细小噪点，表面粗糙、陈旧、积灰。没有光滑的渐变，没有塑料感和金属高光。
6. 细节：只画出能辨认形状的大块明暗。缩小到 64 像素宽时，依然能一眼认出是什么。不画小装饰、花纹、文字、标志、数字。
7. 气氛：空旷、安静、陈旧，像褪色的旧照片，或者噩梦里记不清的地方。可怕来自黑暗和形状的不对劲，不来自血腥。
8. 输出：只生成一张图，只画一个主体。不要拼图、多视图、精灵表、边框、画框、签名、水印。

Negative: cartoon, anime, manga, chibi, cel shading, flat colors, line art, outlines, ink lines, cute, kawaii, vibrant colors, saturated colors, neon, glow, bloom, lens flare, HDR, 3D render, CGI, octane, unreal engine, photograph, photorealistic, glossy, plastic, clean gradient, text, letters, numbers, logo, watermark, signature, frame, border, collage, multiple views, sprite sheet, blood, gore, wound, corpse, skull
```

### 0.3 【人物】前缀（第 1 节与「真冬们」）

```
【风格硬性规则——每一条都必须遵守】
1. 画风和附图的 Q 版小人完全一致：约 2 头身，深色描边的粗细、上色方式、眼睛的画法都照附图。
2. 角色的发型、发色、发圈、衣服的款式和颜色，严格照附图，不增加任何新的配饰、图案或衣服。
3. 色调比附图暗一些、冷一些，像站在没开灯的走廊里，但不要改变固有色。
4. 全身入画，脚底在画面下方中央，人物大小和站位与附图里的小人相同（512×512 画布中，人物高约 320~430 像素）。
5. 透明背景。没有地面、没有投影、没有背景色块、没有特效。
6. 只生成一张图，只画一个角色，一个姿势。不要拼图、多视图、精灵表。
7. 画面里没有文字和水印。

Negative: realistic, semi-realistic, 3D, extra accessories, different hairstyle, different outfit, background, floor, shadow, text, watermark, multiple characters, multiple views, sprite sheet
```

### 0.4 各类素材的额外限制

| 类型 | 规格 | 额外限制 |
|---|---|---|
| **地图贴图** `tiles/` | 512×512，不透明 | **正俯视 90°**，完全平面，没有透视。必须**无缝平铺**：上下左右四条边接起来看不出接缝。画面里**只有材质本身**，没有任何物体、家具、人影、投影和光斑（光照由游戏处理），明暗均匀，不要暗角。墙面贴图是**正面平视**，只能横向平铺；墙上本来挂着的东西（画、缎带）可以有，但不能有家具和人影。 |
| **物件** `sprites/objects/` | 512×512，**透明** | **斜俯视约 45°**（和游戏镜头一致），所有物件用同一个角度；**例外**：挂在墙上的东西（黑板、窗户、挂钟、镜子）用正面平视。物件居中，占画面宽度的 60%~80%。**不画地面**，只允许物件正下方一小块接触阴影（不超过物件高度的 10%）。光从左上方来。不要暗角和边框。 |
| **怪物** `sprites/monsters/` | 512×512，**透明** | 全身，脚底在画面下方中央。**剪影优先**：只看黑色剪影也要能认出是什么、朝哪个方向。比附图的小人高大很多（人形怪物约为小人的 2 倍高）。不画地面、投影、特效。 |
| **成员场景** `sprites/scenes/` | 512×512，**透明** | 只用影子、剪影、背影、物件表现。**不出现脸部特写、伤口、血、身体细节**。没有地面以外的背景。 |
| **材料图** `ui/materials/` | 1200×880，不透明 | 背景是纯色深灰 #121417，没有桌面和环境。物品居中，占画面 50%~70%，像用手电筒从左上方照着。物品上的字迹必须**模糊到看不清**。 |
| **全屏背景** `ui/bg/` | 1920×1080，不透明 | 横构图。可以有暗角。画面下方 1/3 保持很暗（游戏会在那里放文字）。没有人物特写，人物只以远处的剪影出现。 |

### 0.5 保持一致的做法

1. **先定画风锚点**：第一张先生成 `tiles/floor_school.png`（走廊地板），你觉得画风对了，就把它当作「画风锚点」。
2. 之后每一条【场景】提示词都附上画风锚点，并在前缀后面加一句：**「画风、色调、颗粒感、笔触与附图（画风锚点）完全一致。」**
3. 尽量在**同一个对话里连续生成**同一类素材。换对话时，重新附上锚点图。
4. 一张图只画一个东西，我在代码里自己组合。

### 0.6 验收清单（每张图用之前对照一遍）

- [ ] 没有描边、线稿（【场景】）
- [ ] 不像卡通 / 动漫 / 3D 渲染
- [ ] 颜色够灰、够暗，没有鲜艳的颜色
- [ ] 光从左上方来，大部分画面在阴影里
- [ ] 有颗粒感，没有光滑的渐变
- [ ] 缩小到 64 像素还能认出是什么
- [ ] 没有任何文字、数字、水印、签名
- [ ] 背景该透明的透明了；贴图能无缝平铺
- [ ] 和画风锚点、已经通过的图放在一起不突兀

有一项不符合，就在原对话里说「重新生成，这一点不符合：……」，不要换对话重来。

### 0.7 内容边界（交接文档的创作原则）

- 成员场景要**克制**：只用影子、背影、空间和物件来暗示，**不画伤口、血迹、过程**。下面的提示词已经按这个写好。
- 不要出现瑞希×真冬向的画面或暗示。

### 0.8 参考图一览（`references/`）

| 文件 | 内容 |
|---|---|
| `mafuyu_chibi_walk_sheet.png` | 真冬小人，上排正面 6 帧，下排背面 6 帧 |
| `mafuyu_chibi_front.png` / `mafuyu_chibi_back.png` | 真冬小人单张正面 / 背面（透明背景） |
| `kanade_*` / `ena_*` / `mizuki_*` | 奏、绘名、瑞希的小人，同上 |
| `mafuyu_portrait_casual.png` | 真冬立绘：紫色侧马尾、橙色发圈、浅蓝开衫、条纹衬衫、米色阔腿裤 |
| `mafuyu_child_dress.png` | 幼年真冬：齐肩散发，白色短袖衬衫 + 蓝色千鸟格连衣裙 |
| `mafuyu_child_cardigan.png` | 稍大一点的童年真冬：马尾，米色开衫 + 白色圆领 + 深绿长裤 |

---

## 1. 角色【人物】

### 1.1 真冬（可操作角色）

> **方案 A（推荐，省事）**：参考图里的正面、背面 6 帧走路图可以直接用在游戏里，只需要生成下面标 ★ 的侧面图和特殊姿势。
> **方案 B**：全部重新生成成更阴暗的版本。那就把下面所有条目都生成一遍。

共同附图：`mafuyu_chibi_walk_sheet.png`、`mafuyu_chibi_front.png`

共同描述：**真冬，和参考图同一个小人：紫色长发扎侧马尾、橙色发圈、浅蓝开衫、米色阔腿裤、深色鞋子。表情改成无表情：嘴是一条平线，眼睛的高光很少，看起来有点空。**

| 文件 | 提示词 |
|---|---|
| ★ `sprites/characters/mafuyu_left.png` | 真冬小人，身体侧向画面左侧站立，看向左边，双手自然下垂，透明背景 |
| ★ `sprites/characters/mafuyu_left_walk.png` | 同上，迈出一步的走路姿势，只有腿和手臂的位置不同 |
| ★ `sprites/characters/mafuyu_right.png` | 真冬小人，身体侧向画面右侧站立，看向右边（就是左侧图的镜像，可以直接水平翻转），透明背景 |
| ★ `sprites/characters/mafuyu_right_walk.png` | 同上，迈出一步的走路姿势 |
| `sprites/characters/mafuyu_down.png` / `mafuyu_up.png` | （方案 B）真冬小人正面 / 背面站立，无表情，透明背景 |
| `sprites/characters/mafuyu_walk_down_1~6.png` / `mafuyu_walk_up_1~6.png` | （方案 B）照着参考图的 6 帧逐帧重画，无表情 |
| ★ `sprites/characters/mafuyu_crawl.png` | 真冬小人在狭窄的管道里朝画面右侧趴着往前爬，侧面，身体压得很低，透明背景 |
| ★ `sprites/characters/mafuyu_climb.png` | 真冬小人双手抓着一根竖直的绳子往下爬，从侧后方看，脚悬空，透明背景（不画绳子） |
| ★ `sprites/characters/mafuyu_sit_back.png` | 真冬小人背对镜头抱膝坐在地上，只看得到背影和侧马尾，身体缩着，透明背景（结局 6） |
| ★ `sprites/characters/mafuyu_fallen.png` | 真冬小人侧躺在地上，眼睛闭着，像晕倒了，透明背景（第一幕结尾） |

### 1.2 幼年真冬（第一幕的小女孩、结局 7、怪物群的一员）

附图：`mafuyu_child_dress.png`、`mafuyu_chibi_front.png`（画风）

共同描述：**画成和真冬小人同样画风、同样大小的 Q 版小人，但年纪更小：紫色齐肩散发（参考 `mafuyu_child_dress.png`），白色短袖衬衫配深蓝裙子，当作小学制服。**

| 文件 | 提示词 |
|---|---|
| ★ `sprites/characters/mafuyu_child_back.png` | 幼年真冬小人背对镜头站着，一动不动，双手垂在身侧，只看得到后脑和头发，透明背景 |
| ★ `sprites/characters/mafuyu_child_turned.png` | 同一个小女孩，身体仍然背对镜头，但头已经整个转了 180 度正对镜头。脸上是很大、很僵硬的微笑，眼睛没有高光，一边嘴角往下流一道细细的黑色石油状液体。诡异，但不要血腥和细节，透明背景 |
| ★ `sprites/characters/mafuyu_child_counting.png` | 幼年真冬小人面朝墙站着（背对镜头），肩膀很僵，头微微低着，透明背景（结局 7） |

### 1.3 奏、绘名、瑞希

附图：各自的 `*_chibi_walk_sheet.png` 和 `*_chibi_front.png`

> 这三人只在第一幕和终周目出现，站着不动，**直接用参考图的正面帧也可以**，不必生成。如果要生成：

| 文件 | 提示词 |
|---|---|
| `sprites/characters/kanade_side.png` | 奏的小人（和参考图同一个角色），身体侧向画面左边站着，看向左边，安静的神情，透明背景 |
| `sprites/characters/ena_side.png` | 绘名的小人，侧向左边站着，双手抱在胸前，略带不耐烦，透明背景 |
| `sprites/characters/mizuki_side.png` | 瑞希的小人，侧向左边站着，轻松的神情，透明背景 |

---

## 2. 成员场景（克制处理）【场景】

人物在这里只以影子、剪影、背影或物件出现，用场景风格来画，不画成 Q 版小人。

附图：对应角色的 `*_chibi_front.png`（**只参考发型、发色和衣服配色**，不参考画风）

| 文件 | 用于 | 提示词 |
|---|---|---|
| `sprites/scenes/floor3_hanged.png` | 一周目 三楼 | 斜俯视的昏暗教室一角。从天花板垂下一根绳子。墙上投着一个少女的长影子，影子的脚不着地，影子的发型是短发。地上整齐放着一双鞋。看不到人，只有影子和鞋。冷色月光，512×512，透明背景 |
| `sprites/scenes/floor3_canvas.png` | 二~四周目 三楼 | 一幅巨大的未完成油画立在画架上，画中是一个短发女孩的背影站在空房间里。画里的一根绳子越过画框边缘，垂到画外的地板上。颜料从画布上缓缓往下流。透明背景 |
| `sprites/scenes/floor3_canvas_cut.png` | 剪断后 | 同一幅画，画框外的绳子被剪断，画布上的颜料大片往下淌，画中人影被冲淡、看不清。透明背景 |
| `sprites/scenes/floor2_lying.png` | 一、二周目 二楼 | 斜俯视，粉色微光的房间地板上，一个粉色长发、侧边扎着深蓝蝴蝶结的少女侧身蜷着躺下，只看得到背影和头发，脸转向另一边看不见，一动不动，肤色苍白。没有血、没有伤口，只有安静和冷。透明背景 |
| `sprites/scenes/floor2_clothes.png` | 三、四周目 二楼 | 一把木椅上整齐叠着一套衣服（白色衬衫、浅蓝裙子、深蓝蝴蝶结），旁边立着一面落地镜，镜子被一块白布完全盖住。房间里没有人。透明背景 |
| `sprites/scenes/music_kanade_play.png` | 一~三周目 音乐室 | 一个银白色长发的少女背对镜头坐在三角钢琴前弹琴，头发长得垂到地上，身体前倾。周围漂浮着扭曲的黑色音符。透明背景 |
| `sprites/scenes/music_kanade_shatter.png` | 碎开的瞬间 | 同一个少女的轮廓像玻璃一样裂成许多碎片向外飞散，碎片之间是黑色的空洞。碎片里只有颜色，没有血肉。透明背景 |
| `sprites/scenes/music_kanade_blank.png` | 四周目 音乐室 | 同一个银白色长发的少女背对镜头一直在弹琴，谱架上是一张完全空白的乐谱。画面很安静。透明背景 |

---

## 3. 怪物【场景】（「真冬们」4 张是【人物】）

可怕，但细节少：用剪影、比例失调、空洞的眼睛来营造。都是 512×512、透明背景、全身。
除「真冬们」以外，都用场景风格：不描边、厚涂、颗粒感，像从黑暗里浮出来的东西。附图只用来**对比身高**（怪物要比小人高大很多），不参考画风。

| 文件 | 附图 | 提示词 |
|---|---|---|
| `sprites/monsters/nurse.png` | 任一 `*_chibi_front.png`（只对比身高） | 扭曲的护士鬼，比附图的小人高两倍，四肢细长、关节反向弯曲。旧护士服，头歪向一边，脸被垂下的黑发完全遮住，只露出一个咧开的黑色嘴巴。冲刺的姿势 |
| `sprites/monsters/plaster.png` | 同上 | 美术室的白色石膏人像，没有瞳孔，表面有几道裂纹，以人类不可能的角度扭着脖子站立，石膏的白色在黑暗里发灰 |
| `sprites/monsters/moving_door.png` | 同上 | 一扇独立的粉色教室门，门开了一条缝，缝里是全黑的，只有一只发白的眼睛往外看。门的边缘像活物一样微微弯曲 |
| `sprites/monsters/moving_door_folded.png` | 同上 | 同一扇粉色门，门板像纸一样折叠、卷成一卷 |
| `sprites/monsters/piano.png` | 同上 | 一架黑色立式钢琴，琴盖张开像一张嘴，琴键参差不齐像牙齿，整架钢琴微微前倾，像要扑过来 |
| `sprites/monsters/piano_strings.png` | 同上 | 同一架钢琴，从琴身里吐出一大把金属琴弦，琴弦往下垂 |
| `sprites/monsters/mafuyus_child.png`【人物】 | `mafuyu_child_dress.png` | 幼年真冬小人正面站着，脸上是不自然的固定微笑，嘴角咧得太开，眼睛不笑、没有高光 |
| `sprites/monsters/mafuyus_middle.png`【人物】 | `mafuyu_child_cardigan.png` | 初中生年纪的真冬小人（马尾、米色开衫），同样的固定微笑 |
| `sprites/monsters/mafuyus_high.png`【人物】 | `mafuyu_chibi_front.png` | 现在的真冬小人，同样的固定微笑 |
| `sprites/monsters/mafuyus_doctor.png`【人物】 | `mafuyu_chibi_front.png`、`mafuyu_portrait_casual.png` | 成年后的真冬小人，头发放下，穿白大褂、挂着听诊器，同样的固定微笑 |
| `sprites/monsters/faceless.png` | 任一小人 | 从画框里爬出来的瘦长人形，脸是一片被抹掉的空白颜料，双手在脸上摸索，像在找自己的脸 |
| `sprites/monsters/turned_back.png` | 任一小人 | 一个模糊的人影，背对镜头，看不出是谁，轮廓边缘像黑烟一样晕开 |
| `sprites/monsters/flying_score.png` | — | 一张在空中翻飞的乐谱纸，纸的边缘锋利得像刀片，音符是黑色的 |
| `sprites/monsters/note.png` | — | 一个由黑色八分音符变成的小怪物，符头上有一只红色的小眼睛，符尾像触手一样微微卷曲 |

---

## 4. 地图贴图【场景】

照第 0.2 节的【场景】前缀和第 0.4 节的贴图限制：地板正俯视、墙面正面平视，可无缝平铺，明暗均匀，没有投影和光斑。

| 文件 | 提示词 |
|---|---|
| `tiles/floor_school.png` | 旧学校走廊的地板，灰色木地板，积着灰，有几道划痕 |
| `tiles/wall_school.png` | 旧学校的墙面，上半部分发黄的白墙，下半部分深色墙裙，墙皮有剥落，正面平视 |
| `tiles/floor_school_ena.png` | 同样的地板，整体色调偏冷白，有零星干掉的颜料点 |
| `tiles/wall_school_ena.png` | 同样的墙面，挂着未完成的人像画，画中人的脸都被涂掉了 |
| `tiles/floor_school_mizuki.png` | 同样的地板，整体色调略偏暗粉，落着几条缎带 |
| `tiles/wall_school_mizuki.png` | 同样的墙面，挂满褪色的缎带 |
| `tiles/floor_school_kanade.png` | 同样的地板，整体色调偏冷蓝 |
| `tiles/floor_pink_room.png` | 深粉色旧地毯 |
| `tiles/floor_pipe.png` | 金属管道内部，锈迹和水渍 |
| `tiles/floor_final.png` | 和 `floor_school` 同一块地板，但干净、没有灰尘，整体色调偏淡蓝灰（终周目） |

---

## 5. 物件【场景】

512×512，透明背景，斜俯视。不描边，厚涂，颗粒感，只画出形状和大块明暗，细节少。

| 文件 | 提示词 |
|---|---|
| `sprites/objects/bed.png` | 医务室的铁架病床，白床单发黄、积着灰 |
| `sprites/objects/mirror.png` | 挂在墙上的长方形镜子，镜面发灰模糊 |
| `sprites/objects/medicine_cabinet.png` | 带玻璃门的药柜，玻璃上蒙着灰 |
| `sprites/objects/medicine_cabinet_open.png` | 同一个药柜，柜门微微开着一条缝 |
| `sprites/objects/office_desk.png` | 医务室的办公桌 |
| `sprites/objects/school_desk.png` | 单人课桌 |
| `sprites/objects/school_desk_paper.png` | 单人课桌，桌上放着一张空白试卷 |
| `sprites/objects/school_desk_paper_filled.png` | 单人课桌，桌上的试卷写满了密密麻麻的黑色线条（看不清内容） |
| `sprites/objects/lectern.png` | 教室的讲台 |
| `sprites/objects/blackboard.png` | 空白的教室黑板，正面平视 |
| `sprites/objects/window_night.png` | 教室窗户，窗外是漆黑的夜，正面平视 |
| `sprites/objects/ropes.png` | 从天花板垂下的许多根绳子，绳头打着圈 |
| `sprites/objects/scissors.png` | 一把旧剪刀 |
| `sprites/objects/stairs.png` | 往下走的楼梯口 |
| `sprites/objects/iron_door.png` | 楼梯间的铁门，被撞得凹进去 |
| `sprites/objects/pink_door.png` | 一扇粉色的教室门，在灰暗的走廊里显得很突兀 |
| `sprites/objects/class_door.png` | 普通的教室拉门，门上的小窗是黑的 |
| `sprites/objects/pipe_entrance.png` | 墙上的通风管道入口，格栅已经脱落 |
| `sprites/objects/grand_piano.png` | 三角钢琴 |
| `sprites/objects/chair.png` | 音乐教室的折叠椅 |
| `sprites/objects/shoe_locker.png` | 学校门口的空鞋柜 |
| `sprites/objects/school_gate.png` | 学校的大门，从里面看，厚重的双开门 |
| `sprites/objects/wall_clock.png` | 教室墙上的挂钟，正面平视，没有指针（指针由代码画） |
| `sprites/objects/trash_can.png` | 走廊的垃圾桶，露出一张揉皱的纸 |
| `sprites/objects/locker.png` | 一排铁皮储物柜 |
| `sprites/objects/easel_portraits.png` | 堆着的画架和人像画，画中人的脸都被涂掉了 |

---

## 6. 材料图片（背包里显示）【场景】

1200×880，深色背景，物品特写。不描边，像用手电筒照着拍下的旧照片。文件名就是材料 ID，放在 `ui/materials/`。

| 文件 | 提示词 |
|---|---|
| `ui/materials/mafuyu_checkup.png` | 一张体检表，各栏都打着满分的记号，字迹模糊看不清 |
| `ui/materials/mafuyu_blank_paper.png` | 一张什么都没写的试卷，平放在课桌上 |
| `ui/materials/mafuyu_nameplate.png` | 一块旧的小学名牌，塑料外壳发黄 |
| `ui/materials/ena_sketch.png` | 速写本撕下的一页，随手画着四个人的头像，铅笔线条潦草（附四个人的 `*_chibi_front.png`，只参考发型） |
| `ui/materials/ena_comment.png` | 一张被揉皱又展开的评语单，下方有用力划过的笔痕 |
| `ui/materials/ena_paint.png` | 一支挤空的颜料管，管身上有手写的数字 |
| `ui/materials/mizuki_ribbon.png` | 一根深蓝色的蝴蝶结发绳（附 `mizuki_chibi_front.png`），放在灰色桌面上 |
| `ui/materials/mizuki_diary.png` | 一本带锁的日记本，锁孔是空的 |
| `ui/materials/mizuki_postcard.png` | 一张明信片的背面，收件人一栏是空的，只写了短短一行 |
| `ui/materials/kanade_score.png` | 一张手写乐谱，到处是涂改，标题被划掉 |
| `ui/materials/kanade_earphones.png` | 一副有线耳机，线断了一半，还缠在一起 |
| `ui/materials/kanade_cupnoodle.png` | 一个空的杯面容器，底下压着一张便签 |

---

## 7. 全屏背景与演出【场景】

1920×1080，无文字。不描边，厚涂，颗粒感，暗。

| 文件 | 用于 | 提示词 |
|---|---|---|
| `ui/bg/title.png` | 标题画面 | 深夜的废弃学校外观，只有一扇窗亮着微弱的光，天空深蓝近黑。画面下方大面积留暗，用来放菜单 |
| `ui/bg/climb_facade.png` | 第三幕攀爬 | 从外面看的学校外墙，正面平视，上下两扇窗户，夜里，墙面潮湿 |
| `ui/bg/exam_closeup.png` | 结局 5 | 俯视课桌上的一张试卷，写满了密密麻麻的黑色线条，工整得过分 |
| `ui/bg/ending9_home.png` | 结局 9 | 普通家庭的房间，清晨，整洁得没有生气，书桌上一摞参考书，窗帘半拉 |
| `ui/bg/final_gate.png` | 终周目 | 从学校里往外看的校门口，凌晨，路灯下站着三个少女的剪影，看不清脸（附奏、绘名、瑞希的 `*_chibi_front.png`，只参考发型轮廓） |
| `ui/bg/ending10_lot.png` | 结局 10 | 一片长满杂草的空地，原本应该有学校的地方什么都没有，清晨，平静 |

---

## 8. 不需要生成的

- **对话立绘**：对话框只显示名字牌，不用立绘。
- 怪物的多帧动画、奔跑帧：代码里用位移和晃动来表现。
- UI 图标、按钮、对话框：保持纯文字风格。
- 音效与配音：M6 单独整理。
