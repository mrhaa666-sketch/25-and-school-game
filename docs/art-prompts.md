# 美术素材提示词清单

给图片生成用（GPT 生图）。压缩包里的 `references/` 是参考图，每条提示词都注明了要一起上传哪几张。
生成后按「文件」一栏的路径放进游戏仓库的 `assets/`，M6 会按这些文件名读取，替换现在的色块占位。

---

## 0. 使用说明

### 0.1 统一风格前缀（每条提示词前都加上）

> 2D 恐怖解谜游戏素材。画风参照附图的 Q 版小人：约 2 头身，粗的深色描边，柔和的赛璐璐上色，**细节少、形状简单**。整体气氛阴冷诡异：低饱和、偏冷的暗色调，阴影偏重，像深夜只有灯管和月光的废弃学校。可怕来自气氛和比例的不对劲，而不是细节或血腥。画面里没有任何文字和水印。

### 0.2 规格

| 类型 | 尺寸 | 背景 | 构图 |
|---|---|---|---|
| 角色 / 怪物 | 512×512 | **透明**（做不到就用纯绿 #00FF00） | 全身，脚在画面下方中央，和参考图的小人一样大小、一样站位 |
| 物件 | 512×512 | 透明 | 斜俯视（约 45°），单个物件居中 |
| 地面 / 墙面贴图 | 512×512 | 不透明 | **可无缝平铺**（seamless tileable），俯视 |
| 材料图片 | 1200×880 | 深色纯色 | 物品特写，居中 |
| 全屏背景 / 演出 | 1920×1080 | 不透明 | 无文字 |

### 0.3 生成技巧

- 同一个角色的图尽量**在同一个对话里连续生成**，每次都说「和上一张是同一个角色、同样的画风和大小」。
- 一张图只画一个东西。不要做成拼图或精灵表，我在代码里自己组合。
- 画面里如果出现能看清的字，内容可能和游戏对不上，所以尽量不要有字。

### 0.4 内容边界（交接文档的创作原则）

- 成员场景要**克制**：只用影子、背影、空间和物件来暗示，**不画伤口、血迹、过程**。下面的提示词已经按这个写好。
- 不要出现瑞希×真冬向的画面或暗示。

### 0.5 参考图一览（`references/`）

| 文件 | 内容 |
|---|---|
| `mafuyu_chibi_walk_sheet.png` | 真冬小人，上排正面 6 帧，下排背面 6 帧 |
| `mafuyu_chibi_front.png` / `mafuyu_chibi_back.png` | 真冬小人单张正面 / 背面（透明背景） |
| `kanade_*` / `ena_*` / `mizuki_*` | 奏、绘名、瑞希的小人，同上 |
| `mafuyu_portrait_casual.png` | 真冬立绘：紫色侧马尾、橙色发圈、浅蓝开衫、条纹衬衫、米色阔腿裤 |
| `mafuyu_child_dress.png` | 幼年真冬：齐肩散发，白色短袖衬衫 + 蓝色千鸟格连衣裙 |
| `mafuyu_child_cardigan.png` | 稍大一点的童年真冬：马尾，米色开衫 + 白色圆领 + 深绿长裤 |

---

## 1. 角色

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

## 2. 成员场景（克制处理）

附图：对应角色的 `*_chibi_front.png`（画风和配色参考）

| 文件 | 用于 | 提示词 |
|---|---|---|
| `sprites/scenes/floor3_hanged.png` | 一周目 三楼 | 斜俯视的昏暗教室一角。从天花板垂下一根绳子。墙上投着一个 Q 版小人形状的长影子，影子的脚不着地，影子的发型是短发（绘名）。地上整齐放着一双小鞋。看不到人，只有影子和鞋。冷色月光，512×512，透明背景 |
| `sprites/scenes/floor3_canvas.png` | 二~四周目 三楼 | 一幅巨大的未完成油画立在画架上，画中是一个短发女孩的背影站在空房间里。画里的一根绳子越过画框边缘，垂到画外的地板上。颜料从画布上缓缓往下流。透明背景 |
| `sprites/scenes/floor3_canvas_cut.png` | 剪断后 | 同一幅画，画框外的绳子被剪断，画布上的颜料大片往下淌，画中人影被冲淡、看不清。透明背景 |
| `sprites/scenes/floor2_lying.png` | 一、二周目 二楼 | 斜俯视，粉色微光的房间地板上，一个粉色长发、侧马尾带深蓝蝴蝶结的 Q 版小人侧身蜷着躺下，脸转向另一边看不见，一动不动，肤色苍白。没有血、没有伤口，只有安静和冷。透明背景 |
| `sprites/scenes/floor2_clothes.png` | 三、四周目 二楼 | 一把木椅上整齐叠着一套衣服（白色衬衫、浅蓝裙子、深蓝蝴蝶结），旁边立着一面落地镜，镜子被一块白布完全盖住。房间里没有人。透明背景 |
| `sprites/scenes/music_kanade_play.png` | 一~三周目 音乐室 | 奏的小人背对镜头坐在三角钢琴前弹琴，银白色长发垂到地上，身体前倾。周围漂浮着扭曲的黑色音符。透明背景 |
| `sprites/scenes/music_kanade_shatter.png` | 碎开的瞬间 | 同一个小人的轮廓像玻璃一样裂成许多碎片向外飞散，碎片之间是黑色的空洞。碎片里只有颜色，没有血肉。透明背景 |
| `sprites/scenes/music_kanade_blank.png` | 四周目 音乐室 | 奏的小人背对镜头一直在弹琴，谱架上是一张完全空白的乐谱。画面很安静。透明背景 |

---

## 3. 怪物

可怕，但细节少：用剪影、比例失调、空洞的眼睛来营造。都是 512×512、透明背景、全身。

| 文件 | 附图 | 提示词 |
|---|---|---|
| `sprites/monsters/nurse.png` | 任一 `*_chibi_front.png`（画风） | 扭曲的护士鬼，和小人同样的画风，但身体比小人高一倍、四肢细长、关节反向弯曲。旧护士服，头歪向一边，脸被垂下的黑发完全遮住，只露出一个咧开的黑色嘴巴。冲刺的姿势 |
| `sprites/monsters/plaster.png` | 同上 | 美术室的白色石膏人像，Q 版比例但没有瞳孔，表面有几道裂纹，以人类不可能的角度扭着脖子站立 |
| `sprites/monsters/moving_door.png` | 同上 | 一扇独立的粉色教室门，门开了一条缝，缝里是全黑的，只有一只发白的眼睛往外看。门的边缘像活物一样微微弯曲 |
| `sprites/monsters/moving_door_folded.png` | 同上 | 同一扇粉色门，门板像纸一样折叠、卷成一卷 |
| `sprites/monsters/piano.png` | 同上 | 一架黑色立式钢琴，琴盖张开像一张嘴，琴键参差不齐像牙齿，整架钢琴微微前倾，像要扑过来 |
| `sprites/monsters/piano_strings.png` | 同上 | 同一架钢琴，从琴身里吐出一大把金属琴弦，琴弦往下垂 |
| `sprites/monsters/mafuyus_child.png` | `mafuyu_child_dress.png` | 幼年真冬小人正面站着，脸上是不自然的固定微笑，嘴角咧得太开，眼睛不笑、没有高光 |
| `sprites/monsters/mafuyus_middle.png` | `mafuyu_child_cardigan.png` | 初中生年纪的真冬小人（马尾、米色开衫），同样的固定微笑 |
| `sprites/monsters/mafuyus_high.png` | `mafuyu_chibi_front.png` | 现在的真冬小人，同样的固定微笑 |
| `sprites/monsters/mafuyus_doctor.png` | `mafuyu_chibi_front.png`、`mafuyu_portrait_casual.png` | 成年后的真冬小人，头发放下，穿白大褂、挂着听诊器，同样的固定微笑 |
| `sprites/monsters/faceless.png` | 任一小人 | 从画框里爬出来的 Q 版人形，脸是一片被抹掉的空白颜料，双手在脸上摸索，像在找自己的脸 |
| `sprites/monsters/turned_back.png` | 任一小人 | 一个 Q 版小人形状的模糊人影，背对镜头，看不出是谁，轮廓边缘像黑烟一样晕开 |
| `sprites/monsters/flying_score.png` | — | 一张在空中翻飞的乐谱纸，纸的边缘锋利得像刀片，音符是黑色的 |
| `sprites/monsters/note.png` | — | 一个由黑色八分音符变成的小怪物，符头上有一只红色的小眼睛，符尾像触手一样微微卷曲 |

---

## 4. 地图贴图

512×512，可无缝平铺，俯视，细节少。

| 文件 | 提示词 |
|---|---|
| `tiles/floor_school.png` | 旧学校走廊的地板，灰色木地板，积着灰，有几道划痕 |
| `tiles/wall_school.png` | 旧学校的墙面，上半部分发黄的白墙，下半部分深色墙裙，墙皮有剥落，正面平视 |
| `tiles/floor_school_ena.png` | 同样的地板，冷白色灯光，有零星干掉的颜料点 |
| `tiles/wall_school_ena.png` | 同样的墙面，挂着未完成的人像画，画中人的脸都被涂掉了 |
| `tiles/floor_school_mizuki.png` | 同样的地板，偏粉的暗光，落着几条缎带 |
| `tiles/wall_school_mizuki.png` | 同样的墙面，挂满褪色的缎带 |
| `tiles/floor_school_kanade.png` | 同样的地板，冷蓝色，像永远停在凌晨 |
| `tiles/floor_pink_room.png` | 深粉色旧地毯 |
| `tiles/floor_pipe.png` | 金属管道内部，锈迹和水渍 |
| `tiles/floor_final.png` | 和 `floor_school` 同一块地板，但只有月光照着，安静干净，没有灰尘（终周目） |

---

## 5. 物件

512×512，透明背景，斜俯视，和小人同样的描边画风，细节少。

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

## 6. 材料图片（背包里显示）

1200×880，深色背景，物品特写，同样的描边画风。文件名就是材料 ID，放在 `ui/materials/`。

| 文件 | 提示词 |
|---|---|
| `ui/materials/mafuyu_checkup.png` | 一张体检表，各栏都打着满分的记号，字迹模糊看不清 |
| `ui/materials/mafuyu_blank_paper.png` | 一张什么都没写的试卷，平放在课桌上 |
| `ui/materials/mafuyu_nameplate.png` | 一块旧的小学名牌，塑料外壳发黄 |
| `ui/materials/ena_sketch.png` | 速写本撕下的一页，随手画着四个人的 Q 版头像，线条潦草（附四个人的 `*_chibi_front.png`） |
| `ui/materials/ena_comment.png` | 一张被揉皱又展开的评语单，下方有用力划过的笔痕 |
| `ui/materials/ena_paint.png` | 一支挤空的颜料管，管身上有手写的数字 |
| `ui/materials/mizuki_ribbon.png` | 一根深蓝色的蝴蝶结发绳（附 `mizuki_chibi_front.png`），放在灰色桌面上 |
| `ui/materials/mizuki_diary.png` | 一本带锁的日记本，锁孔是空的 |
| `ui/materials/mizuki_postcard.png` | 一张明信片的背面，收件人一栏是空的，只写了短短一行 |
| `ui/materials/kanade_score.png` | 一张手写乐谱，到处是涂改，标题被划掉 |
| `ui/materials/kanade_earphones.png` | 一副有线耳机，线断了一半，还缠在一起 |
| `ui/materials/kanade_cupnoodle.png` | 一个空的杯面容器，底下压着一张便签 |

---

## 7. 全屏背景与演出

1920×1080，无文字，细节少，暗。

| 文件 | 用于 | 提示词 |
|---|---|---|
| `ui/bg/title.png` | 标题画面 | 深夜的废弃学校外观，只有一扇窗亮着微弱的光，天空深蓝近黑。画面下方大面积留暗，用来放菜单 |
| `ui/bg/climb_facade.png` | 第三幕攀爬 | 从外面看的学校外墙，正面平视，上下两扇窗户，夜里，墙面潮湿 |
| `ui/bg/exam_closeup.png` | 结局 5 | 俯视课桌上的一张试卷，写满了密密麻麻的黑色线条，工整得过分 |
| `ui/bg/ending9_home.png` | 结局 9 | 普通家庭的房间，清晨，整洁得没有生气，书桌上一摞参考书，窗帘半拉 |
| `ui/bg/final_gate.png` | 终周目 | 从学校里往外看的校门口，凌晨，路灯下站着三个 Q 版小人的剪影（附奏、绘名、瑞希的 `*_chibi_front.png`，只取轮廓） |
| `ui/bg/ending10_lot.png` | 结局 10 | 一片长满杂草的空地，原本应该有学校的地方什么都没有，清晨，平静 |

---

## 8. 不需要生成的

- **对话立绘**：用真冬的 Live2D 模型，不需要生成。
- 怪物的多帧动画、奔跑帧：代码里用位移和晃动来表现。
- UI 图标、按钮、对话框：保持纯文字风格。
- 音效与配音：M6 单独整理。
