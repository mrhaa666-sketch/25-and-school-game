# 美术素材提示词清单

给图片生成用。生成后按「文件」一栏的路径放进 `assets/`，M6 会按这些文件名读取，替换现在的色块占位。

## 0. 使用说明

### 0.1 每条提示词前都加上这段统一风格（保证整体一致）

> 2D 恐怖解谜游戏素材，俯视角（约 3/4 俯视，类似《Ib》《青鬼》），低饱和、偏冷的暗色调，柔和的手绘质感，干净的轮廓线，没有文字和水印。光线昏暗，像深夜的废弃学校，只有灯管或月光。

### 0.2 通用要求

| 类型 | 尺寸 | 背景 | 备注 |
|---|---|---|---|
| 角色 / 怪物 | 512×512 正方形，人物占画面高度约 80% | **透明背景 PNG** | 全身，脚站在画面底部中央 |
| 物件（床、桌子、钢琴……） | 512×512 | 透明背景 PNG | 俯视角，单个物件居中 |
| 地面 / 墙壁贴图 | 512×512 | 不透明 | **可无缝平铺**（seamless tileable） |
| 材料图片（背包里显示） | 1200×880（约 15:11） | 深色纯色背景 | 物品特写，居中 |
| 全屏背景 / 演出图 | 1920×1080（16:9） | 不透明 | 只有画面，不要文字 |

- 角色请**附上你的参考图**一起生成，并在提示词里写「保持参考图中的发型、发色、服装」。下面的外貌描述只是占位，以你的参考图为准。
- 同一个角色的几张图，尽量在**同一个对话里连续生成**，并说「和上一张是同一个角色、同样的画风」。
- 生成工具做不了透明背景时，请用纯绿色背景（#00FF00），我在代码里抠掉。
- 一张图只画一个东西。不要做成拼图或精灵表，我在代码里自己组合。

### 0.3 内容边界（和交接文档的创作原则一致）

- 成员场景都要**克制**：只用剪影、背影、空间和物件来暗示，**不画伤口、血迹、尸体细节和过程**。下面的提示词已经按这个原则写好了。也正因为这样写，生成工具一般不会拒绝。
- 不要出现瑞希×真冬向的画面或暗示。
- 画面里不要出现任何文字：标签、黑板上的字都由代码来写。

---

## 1. 角色

### 1.1 真冬（可操作角色）

外貌占位：紫色长发，制服外套，表情平静、没有笑容。**以参考图为准**。

| 文件 | 提示词 |
|---|---|
| `sprites/characters/mafuyu_down.png` | 朝比奈真冬，正面朝向镜头站立，双手自然下垂，表情平静空洞，俯视角全身像，透明背景 |
| `sprites/characters/mafuyu_up.png` | 同一个角色，背对镜头站立，只看得到背影和头发，俯视角全身像，透明背景 |
| `sprites/characters/mafuyu_left.png` | 同一个角色，面朝画面左侧的侧身站立，俯视角全身像，透明背景 |
| `sprites/characters/mafuyu_right.png` | 同一个角色，面朝画面右侧的侧身站立，俯视角全身像，透明背景 |
| `sprites/characters/mafuyu_walk_down.png` | 同一个角色，正面，迈出一步的走路姿势（和站立图只差在腿），透明背景 |
| `sprites/characters/mafuyu_walk_up.png` | 同一个角色，背面，迈出一步的走路姿势，透明背景 |
| `sprites/characters/mafuyu_walk_left.png` | 同一个角色，朝左，迈出一步的走路姿势，透明背景 |
| `sprites/characters/mafuyu_walk_right.png` | 同一个角色，朝右，迈出一步的走路姿势，透明背景 |
| `sprites/characters/mafuyu_crawl.png` | 同一个角色，在狭窄的管道里朝画面右侧趴着往前爬，侧面，身体压得很低，透明背景 |
| `sprites/characters/mafuyu_climb.png` | 同一个角色，双手抓着一根竖直的绳子往下爬，从侧后方看，透明背景（不画绳子） |
| `sprites/characters/mafuyu_sit_back.png` | 同一个角色，背对镜头抱膝坐在地上，背影，透明背景（结局 6 用，不要任何其他元素） |

### 1.2 小学生版真冬（第一幕、结局 7）

| 文件 | 提示词 |
|---|---|
| `sprites/characters/mafuyu_child_back.png` | 一个小学女生背对镜头站着，穿小学制服，发型和发色与真冬相同但更短更孩子气，一动不动，俯视角全身，透明背景 |
| `sprites/characters/mafuyu_child_turned.png` | 同一个小女孩，身体仍背对镜头，但头转过来正对镜头，脸上是僵硬的微笑，嘴角流下一道细细的黑色石油状液体，诡异但不血腥，透明背景 |

### 1.3 奏、绘名、瑞希（第一幕、终周目站立）

外貌请附参考图。

| 文件 | 提示词 |
|---|---|
| `sprites/characters/kanade_stand.png` | 宵崎奏，正面站立，安静、略显疲惫的神情，俯视角全身，透明背景 |
| `sprites/characters/ena_stand.png` | 东云绘名，正面站立，双手插兜，略带不耐烦的神情，俯视角全身，透明背景 |
| `sprites/characters/mizuki_stand.png` | 晓山瑞希，正面站立，轻松的神情，俯视角全身，透明背景 |
| `sprites/characters/kanade_side.png` / `ena_side.png` / `mizuki_side.png` | 同一角色，侧身看向画面左侧（第一幕：视线不朝走廊那边），透明背景 |

---

## 2. 成员场景（克制处理）

| 文件 | 用于 | 提示词 |
|---|---|---|
| `sprites/scenes/floor3_hanged.png` | 一周目 三楼 | 昏暗教室的一角，从天花板垂下一根绳子，墙上投着一个人形的长长影子，影子的脚不着地。地上整齐地放着一双运动鞋。看不到人，只有影子。冷色月光，透明背景或深色背景 |
| `sprites/scenes/floor3_canvas.png` | 二~四周目 三楼 | 一幅巨大的未完成油画立在画架上，画中是一个女孩的背影站在空房间里，画里的一根绳子越过画框边缘垂到画外的地板上。颜料从画布上缓缓往下流。透明背景 |
| `sprites/scenes/floor3_canvas_cut.png` | 剪断后 | 同一幅画，绳子在画框外被剪断，画布上的颜料大片往下流淌，画中的人影被冲淡。透明背景 |
| `sprites/scenes/floor2_lying.png` | 一、二周目 二楼 | 俯视角，粉色微光的房间地板上，一个女孩侧身躺着，脸转向另一边看不见，一动不动，身体轮廓苍白。没有血迹、没有伤口，只有安静和冷。透明背景 |
| `sprites/scenes/floor2_clothes.png` | 三、四周目 二楼 | 一把木椅上整齐叠放着一套衣服，旁边立着一面落地镜，镜子被一块白布完全盖住。房间里没有人。俯视角，透明背景 |
| `sprites/scenes/music_kanade_play.png` | 一~三周目 音乐室 | 一个白色长发的女孩背对镜头坐在三角钢琴前弹琴，身体前倾，周围有扭曲的黑色音符在空气中漂浮。透明背景 |
| `sprites/scenes/music_kanade_shatter.png` | 碎开的瞬间 | 同一个女孩的轮廓像玻璃一样裂成许多碎片向外飞散，碎片之间是黑色的空洞，碎片里没有血肉，只有颜色。透明背景 |
| `sprites/scenes/music_kanade_blank.png` | 四周目 音乐室 | 同一个女孩背对镜头一直在弹琴，钢琴谱架上放着一张完全空白的乐谱，画面很安静。透明背景 |

---

## 3. 怪物

| 文件 | 周目 | 提示词 |
|---|---|---|
| `sprites/monsters/nurse.png` | 一 | 扭曲的护士幽灵，护士服又旧又脏，四肢过长、关节反向弯曲，头歪向一边，脸被垂下的头发遮住，冲刺的姿势，俯视角全身，透明背景 |
| `sprites/monsters/plaster.png` | 二 | 美术室的白色石膏人像，没有瞳孔，表面有裂纹，以人类不可能的姿势站着，透明背景 |
| `sprites/monsters/moving_door.png` | 三 | 一扇独立的粉色教室门，门开了一条缝，缝里有一只眼睛往外看，门的边缘像活物一样微微弯曲，透明背景 |
| `sprites/monsters/moving_door_folded.png` | 三 | 同一扇粉色门，门板像纸一样折叠、卷起来，透明背景 |
| `sprites/monsters/piano.png` | 四 | 一架黑色立式钢琴，琴盖张开像一张嘴，琴键参差不齐像牙齿，钢琴自己在动，透明背景 |
| `sprites/monsters/piano_strings.png` | 四 | 同一架钢琴，从琴身里吐出一大把金属琴弦，琴弦向下垂，透明背景 |
| `sprites/monsters/mafuyus_child.png` | 一 | 小学生版真冬，正面，脸上是不自然的固定微笑，眼睛不笑，透明背景 |
| `sprites/monsters/mafuyus_middle.png` | 一 | 初中生版真冬，穿初中制服，同样的固定微笑，透明背景 |
| `sprites/monsters/mafuyus_high.png` | 一 | 高中生版真冬，同样的固定微笑，透明背景 |
| `sprites/monsters/mafuyus_doctor.png` | 一 | 成年后的真冬，穿白大褂、挂着听诊器，同样的固定微笑，透明背景 |
| `sprites/monsters/faceless.png` | 二 | 从画框里爬出来的人形，脸是一片被涂抹掉的空白颜料，双手在脸上摸索，像在找自己的脸，透明背景 |
| `sprites/monsters/turned_back.png` | 三 | 一个模糊的人影，始终背对着镜头，看不出性别和年龄，轮廓边缘像烟一样晕开，透明背景 |
| `sprites/monsters/flying_score.png` | 四 | 一张在空中翻飞的乐谱纸，纸的边缘锋利得像刀片，上面的音符是黑色的，透明背景 |
| `sprites/monsters/note.png` | 第八、九幕 | 一个由黑色八分音符组成的小怪物，符头上有一只红色的小眼睛，符尾像触手一样微微卷曲，透明背景 |

---

## 4. 地图贴图

每张都是 512×512、可无缝平铺。

| 文件 | 提示词 |
|---|---|
| `tiles/floor_school.png` | 俯视的旧学校走廊地板，灰色水磨石或木地板，满是灰尘、有划痕，可无缝平铺 |
| `tiles/wall_school.png` | 旧学校的墙面，上半部分是发黄的白墙，下半部分是深色墙裙，墙皮有剥落，正面平视，可无缝横向平铺 |
| `tiles/floor_school_ena.png` | 同样的地板，冷白色灯光，地上有零星干掉的颜料点 |
| `tiles/wall_school_ena.png` | 同样的墙面，挂着几幅未完成的人像画，画中人的脸都被涂掉了 |
| `tiles/floor_school_mizuki.png` | 同样的地板，偏粉的暗光，地上落着几条缎带 |
| `tiles/wall_school_mizuki.png` | 同样的墙面，挂满褪色的缎带 |
| `tiles/floor_school_kanade.png` | 同样的地板，冷蓝色，像永远停在凌晨 |
| `tiles/floor_pink_room.png` | 粉色房间的地板，深粉色地毯，有些陈旧 |
| `tiles/floor_pipe.png` | 俯视的金属管道内部，锈迹和水渍，很窄 |
| `tiles/floor_final.png` | 和 `floor_school` 同一块地板，但只有月光照着，安静干净，没有灰尘（终周目） |

---

## 5. 物件

都是 512×512、透明背景、俯视角。

| 文件 | 提示词 |
|---|---|
| `sprites/objects/bed.png` | 医务室的铁架病床，白床单发黄、积着灰 |
| `sprites/objects/mirror.png` | 挂在墙上的长方形镜子，镜面模糊，边缘有锈斑 |
| `sprites/objects/medicine_cabinet.png` | 带玻璃门的药柜，玻璃上蒙着灰，里面有几个空药瓶 |
| `sprites/objects/medicine_cabinet_open.png` | 同一个药柜，柜门微微开着一条缝（三周目的提示） |
| `sprites/objects/office_desk.png` | 医务室的办公桌，桌上散落着文件 |
| `sprites/objects/school_desk.png` | 单人课桌，桌面有刻痕 |
| `sprites/objects/school_desk_paper.png` | 单人课桌，桌上放着一张空白试卷 |
| `sprites/objects/school_desk_paper_filled.png` | 单人课桌，桌上的试卷写满了密密麻麻的字（字迹模糊、看不清内容） |
| `sprites/objects/lectern.png` | 教室的讲台 |
| `sprites/objects/blackboard.png` | 教室黑板，正面平视，黑板是空的（字由代码写） |
| `sprites/objects/window_night.png` | 教室窗户，窗外是漆黑的夜，正面平视 |
| `sprites/objects/ropes.png` | 从天花板垂下的许多根绳子，绳头打着圈，俯视角 |
| `sprites/objects/scissors.png` | 一把旧剪刀 |
| `sprites/objects/stairs.png` | 往下走的楼梯口，俯视角 |
| `sprites/objects/iron_door.png` | 楼梯间的铁门，表面凹凸不平、被撞得变形 |
| `sprites/objects/pink_door.png` | 一扇粉色的教室门，在灰暗的走廊里显得很突兀 |
| `sprites/objects/class_door.png` | 普通的教室拉门，门上的小窗是黑的 |
| `sprites/objects/pipe_entrance.png` | 墙上的通风管道入口，格栅已经脱落 |
| `sprites/objects/grand_piano.png` | 三角钢琴，俯视角 |
| `sprites/objects/chair.png` | 音乐教室的折叠椅 |
| `sprites/objects/shoe_locker.png` | 学校门口的鞋柜，空的 |
| `sprites/objects/school_gate.png` | 学校的大门（从里面看），厚重的双开门 |
| `sprites/objects/wall_clock.png` | 教室墙上的挂钟，正面平视（指针由代码画） |
| `sprites/objects/trash_can.png` | 走廊的垃圾桶，里面露出一张揉皱的纸 |
| `sprites/objects/locker.png` | 一排铁皮储物柜，其中一个柜门锁着 |
| `sprites/objects/easel_portraits.png` | 美术准备室里堆着的画架和人像画，画中人的脸都被涂掉了 |

---

## 6. 材料图片（背包里显示）

1200×880，深色背景，物品特写。文件放在 `ui/materials/`，文件名就是材料 ID。

| 文件 | 提示词 |
|---|---|
| `ui/materials/mafuyu_checkup.png` | 一张体检表的特写，各项结果都是满分，备注栏里写着一行整齐的字（字迹模糊、看不清内容即可） |
| `ui/materials/mafuyu_blank_paper.png` | 一张什么都没写的试卷，平放在课桌上 |
| `ui/materials/mafuyu_nameplate.png` | 一块旧的小学名牌，塑料外壳已经发黄 |
| `ui/materials/ena_sketch.png` | 速写本撕下的一页，上面随手画着四个人的头像，线条潦草 |
| `ui/materials/ena_comment.png` | 一张被揉皱又展开的评语单，下方有用力划过的笔痕 |
| `ui/materials/ena_paint.png` | 一支挤空的颜料管，管身上用马克笔写着几个数字 |
| `ui/materials/mizuki_ribbon.png` | 一根粉色的发绳，放在灰色的桌面上 |
| `ui/materials/mizuki_diary.png` | 一本带锁的日记本，锁孔是空的 |
| `ui/materials/mizuki_postcard.png` | 一张明信片的背面，收件人一栏是空的，只写了很短的一行字 |
| `ui/materials/kanade_score.png` | 一张手写乐谱，很多地方被反复涂改，标题被划掉 |
| `ui/materials/kanade_earphones.png` | 一副有线耳机，线断了一半，还缠在一起 |
| `ui/materials/kanade_cupnoodle.png` | 一个空的杯面容器，底下压着一张便签 |

> 提示：如果生成的图里写了能看清的字，内容可能和材料说明对不上。尽量让字迹模糊；具体文字由背包里的说明来传达。

---

## 7. 全屏背景与演出

1920×1080，不要文字。

| 文件 | 用于 | 提示词 |
|---|---|---|
| `ui/bg/title.png` | 标题画面 | 深夜的废弃学校外观，远远看去只有一扇窗亮着微弱的光，天空是深蓝近黑，画面下方大面积留暗，用来放菜单 |
| `ui/bg/climb_facade.png` | 第三幕攀爬 | 从外面看的学校外墙，正面平视，上下两扇窗户，夜里，墙面潮湿 |
| `ui/bg/exam_closeup.png` | 结局 5 | 俯视课桌上的一张试卷，写满了密密麻麻的字，字迹工整得过分（看不清具体内容） |
| `ui/bg/ending9_home.png` | 结局 9 | 普通家庭的房间，清晨，整洁得没有生气，书桌上摆着一摞参考书，窗帘半拉 |
| `ui/bg/final_gate.png` | 终周目 | 从学校里往外看的校门口，凌晨，路灯下站着三个人影（只有剪影） |
| `ui/bg/ending10_lot.png` | 结局 10 | 一片长满杂草的空地，原本应该有学校的地方什么都没有，清晨的天色，平静 |

---

## 8. 还不需要的

- 怪物的多帧动画、角色的奔跑帧：目前代码用位移和简单的上下晃动来表现，先不用生成。
- UI 图标、按钮、对话框：保持现在的纯文字风格。
- 音效与配音：在 M6 单独整理。
