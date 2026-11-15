# 《25-and-school》交接文档（给接手的 AI / 开发者）

> 仓库：`mrhaa666-sketch/25-and-school-game`，分支 `main`，所有改动都已推送。
> **动手前先读第 2 节**，那是作者定下的硬性约定。

---

## 0. 游戏简介

这是一款 2D 俯视角的恐怖解谜游戏，同人题材是 25時、ナイトコードで。

真冬在深夜的废弃学校里，从四楼医务室一层层往下逃，一共十幕。前四个周目各对应一位成员：真冬、绘名、瑞希、奏。每个周目要收集 3 份材料，四个周目共 12 份。集齐以后进入终周目，走到真结局，也就是结局 10「空地」。

技术上用 Phaser 3.90、TypeScript 和 Vite 开发，再用 Electron 打包成 Windows 版（便携版 exe 和 zip）。

---

## 1. 环境和命令

```bash
npm ci
npm run dev          # http://localhost:5173 ，改代码会热更新
npx tsc --noEmit     # 类型检查，每次提交前都要跑
npm run build        # 打包网页版到 dist/
npm run dist:win     # 打包 Windows 版到 release/
npm run electron     # 以桌面版运行
```

- **自动打包**：`.github/workflows/build-win.yml`。每次推送到 `main`，GitHub 会在 Windows 上自动打包，结果在 Actions 页面那次运行的 Artifacts 里。
- **开发者模式**：游戏里按 F2（笔记本可能要按 Fn+F2），各个版本都能用。功能有：
  - 修改精神值；
  - 领取材料；
  - 切换周目（切换后要再跳一次幕，场景才会按新周目重新加载）；
  - 无敌，追逐时不会被抓；
  - 跳幕：先在「目标」那一行反复确认，选到要去的幕，再点「跳到」。
- **存档位置**：
  - 桌面版：`%APPDATA%\25-and-school-game\save.json`。
  - 网页版：localStorage，键名是 `25-and-school/save`、`/meta`、`/checkpoint`、`/settings`。

---

## 2. 作者的硬性约定（要改先问作者）

1. **剧本**：故事走向、十个结局和它们的触发条件、周目顺序（真冬 → 绘名 → 瑞希 → 奏 → 补完周目 → 终周目）都不能改。
2. **精神值数值**：上限 100；每进一幕扣 10；各项额外扣除见 `SANITY_COST`；四档的分界是 76 / 51 / 26。
3. **标识符和存档**：材料的 id、所在房间和位置（spot）；房间 id、出口编号、`arriveAt`；存档结构。
4. **手感**：走 150、跑 250、体力 100；追逐的速度和判定距离（`CHASE`）；打结和攀爬的基础参数。
5. **内容**：不加规则怪谈式的东西（守则、条目、提示牌）；没有人帮助真冬，没有同伴引导，也没有留言提示；不画血腥。
6. **画风**：
   - 角色是 Q 版，约 2 头身；
   - 场景是偏写实的暗色厚涂，不是卡通，也不是赛璐璐；
   - CG 里的人物用正常头身比。
7. **素材朝向**：按 `docs/art-prompts-ALL.md` 里的朝向规则画：物件正面朝镜头，墙上的东西正面平视，地上的东西正上方俯视。
8. **灯和提示**：不画灯管，只留地上的灯光。可调查的东西只用一个小光点提示，不给物件描边。
9. 屏幕上不显示「第几周目」。

---

## 3. 目录结构

```
assets/                 素材（Vite 的 publicDir，打包时原样复制）
  audio/                音效和环境音 *.ogg（来源见 CREDITS.md）
  tiles/                地板、墙立面 wall_face_*、墙顶 wall_top
  sprites/characters/   真冬的侧面和各种姿势、幼年真冬
  sprites/official/     四个人的官方 Q 版小人（正面 / 背面走路、眨眼）
  sprites/objects/      物件、门、主题装饰
  sprites/monsters/     怪物
  sprites/scenes/       成员演出图（floor3_*、floor2_*、music_kanade_*、ena_hanged）
  sprites/decals/       地面贴花
  sprites/lights/       光效（黑底，用作擦除黑暗的笔刷）
  sprites/backdrop/     窗外远景 night_view / dawn_view
  ui/bg/                全屏背景（标题、攀爬外墙、考场特写、楼梯间等）
  ui/cg/                剧情 CG、结局 CG
  ui/materials/         12 份材料的特写
src/
  main.ts               入口。鼠标「点一下等于按空格」；「减弱闪光和晃屏」在这里改写镜头的 shake 和 flash
  core/
    constants.ts        尺寸、精神值、计时、追逐参数、存储键
    GameState.ts        存档 save、元数据 meta（结局图鉴）、存档点 checkpoint / restoreCheckpoint、事件
    progress.ts         纯函数：进幕扣精神、周目推进、补完周目的提示等级、通讯录乱码
    settings.ts         玩家设置（亮度、减弱闪光），和存档分开保存
    storage.ts          localStorage / Electron 文件存储
    text.ts             台词查找：先找 c{周目}.键，找不到再找 common.键
  data/
    cycles/1~4.json     每个周目：主题、环境色、怪物 A / B、成员场景、考题
    materials.json      12 份材料
    endings.json        10 个结局
    text/zh-CN.json     全部台词
  scenes/
    flow.ts             startAct（每幕开始都会存档）、triggerEnding、playTransition、continueGame、goToTitle
    RoomScene.ts        ★ 所有房间场景的基类，大部分系统都在这里（见第 4 节）
    rooms.ts            ★ 所有房间的地图和数据（见第 5 节）
    Act01~10Scene.ts    每一幕的剧情脚本
    FinalRunScene.ts    终周目：没有追逐，从医务室一路下楼，走到校门外
    StoryScene.ts       剧情页：黑屏或背景图配文字（结局、转场），支持 #bg / #sfx / #amb 指令
    UIScene.ts          常驻的界面层：对话、背包、手机、暂停（设置）、开发者面板、目标栏、手上物品、「已存档」提示、按键分发
    TitleScene.ts       标题、继续游戏、结局图鉴
    memberScenes.ts     成员演出（三楼吊着的绘名、二楼的瑞希等）
    debug.ts            F2 开发者面板、无敌开关
  systems/
    sprites.ts          ★ 素材清单 GROUPS、CG_MOMENTS（哪句台词配哪张 CG）、缩放和摆放函数
    Darkness.ts         黑暗层和光源（在渲染纹理上擦出光）
    playerSprite.ts     真冬的行走动画
    figures.ts          怪物的构造、换姿势 setMonsterPose、色块占位
    KnotQTE.ts          打结小游戏（前两次失手可以重来）
    ClimbGame.ts        顺着绳子往下爬（连按）
    ExamUI / InventoryUI / PhoneUI / ListMenu / DialogueBox   各种界面
    VisualFilter.ts     精神值滤镜（去饱和、晃屏、闪烁、边缘模糊）
    audio.ts            音效、循环频道
electron/               main.cjs（窗口、存档读写）、preload.cjs
docs/                   文档（索引见第 9 节）
```

---

## 4. 核心逻辑（RoomScene.ts）

### 4.1 加载房间 `loadRoom(def, arriveAt?, at?)`

1. **周目调整**：终周目时先 `tidyForFinal`，去掉倒下的柜子和桌椅堆；然后用 `cycleLayout` 套上这个周目的布局差异。
2. **墙**：一格墙，下面一格能走、上面一格不能走，就是「后墙」，画成 3 格高的立面（`FACADE_ROWS`）。其它的墙只画墙顶。
3. **地板**：按楼层选：4F `floor_school`，3F `floor_f3`，2F `floor_f2`，1F `floor_f1`。周目之间用色调区分。`outdoor` 的房间在后墙的位置画夜空和围栏。
4. **物件**：同一个字母连在一起的格子算一个物件。
   - 有图时，宽度按占地的宽来，底边对齐，往上延伸；没有图就画色块。
   - 后墙上的门用 `drawDoor` 画：1.5 格宽、2.4 格高，有关着、漏光、半开三种。
5. **出口**：数字格。后墙上的出口画成门，其它位置画门槛。每个出口都有一点微光。
6. **其它**：装饰 decor（可以限定周目、贴墙、放在前景层）、光源 lights（日光灯只画地上的光）、窗外远景、镜子倒影、灰尘。
7. **镜头**：房间比屏幕矮时放大（最多 2 倍）；房间比屏幕大时跟着玩家走。
8. 最后调用子类的 `onEnterRoom(roomId, firstTime)`。

### 4.2 每一帧 `update`

- **移动**：WASD 或方向键移动，Shift 跑，有体力。有转角辅助，没对准门口也能顺进去。
- **鼠标点了物件**：按格子做广度优先寻路（`findPath`），走到旁边后自动调查。
- **走进出口格时**，依次检查：
  1. `warnLeavingMaterial`：房间里还有没拿的材料，提醒一次；
  2. 子类的 `onExit(ch)`，返回 true 表示子类已经处理；
  3. `room.exits`：换房间。换楼层时插楼梯间过场。
- **头顶提示**「F 动作」：面前那一格能调查时显示，文字来自 `verbFor`。
- **小光点**：`keyTargets()` 返回的物件，头顶有一个闪烁的小光点。
- **左上角**：目标 `objective()`，下面是手上的东西 `heldItems()`。
- **遮挡**：所有立着的东西按脚底的 y 排序（`ySort`）。
- **黑暗层**：`updateDarkness`。

### 4.3 调查 `onInteract()`（F、空格、鼠标点物件）

按顺序判断：
1. 面前是门：进门。
2. 一句话调查点（`examine`）：说一句 `examine.*` 的台词。
3. 周目专属物件 `onCycleObject`：例如绘名周目的画像、瑞希周目的粉门。
4. 都不是：交给子类的 `onObject(obj, tile)`。

### 4.4 子类可以覆盖的方法

| 方法 | 作用 |
|---|---|
| `onObject(obj, tile)` | 调查物件时 |
| `onExit(ch)` | 出口的特殊处理，返回 true 表示已处理 |
| `onEnterRoom(id, first)` | 进入房间时 |
| `onUpdate(time, delta)` | 每帧的剧情逻辑 |
| `objective()` | 左上角的目标 |
| `keyTargets()` | 要打小光点的物件字母 |
| `verbFor(ch, tile)` | 头顶提示里的动作文字 |
| `heldItems()` | 手上拿着的东西 |
| `isChasing()` | 是否正在追逐（追逐时不插楼梯间过场，也不提醒漏拿材料） |
| `ambience()` | 环境音 |

### 4.5 常用的辅助方法

- `cutscene(async () => {...})`：锁住玩家，演一段剧情。
- `say(lines)`：显示台词。如果这些台词是用 `text(key)` 取出来的，而且这个 key 在 `CG_MOMENTS` 里登记了 CG，说这些台词时会铺上 CG。
- 位置和移动：`findTile(ch)`、`objectCenter(ch)`、`tileCenter(x, y)`、`placePlayer`、`walkPlayerTo`、`bounceBack()`。
- 怪物：`addActor(...)`、`moveActor(...)`。追逐时绕开障碍的逻辑在 Act04 的 `gateWaypoint`。
- 门：`drawDoor(obj, cx, floorY, dest?, minW?, open?)`。
- 剧情临时加光：往 `extraLights` 里放 `{x, y, radius, intensity, squash?}`。

### 4.6 存档和重来

- 每一幕开始时，`startAct` 会调用 `GameState.checkpoint()`，右上角显示「已存档」。
- 结局 1~8 之后，用 `restoreCheckpoint()` 回到这一幕开头。拿到的材料保留。
- 追逐里被抓（结局 1、4）时，会设 `registry.retryFrom = 'chase1' / 'chase2'`。Act02 / Act04 在 `create` 里检查这个标记，直接把玩家放回追逐开始之前。

### 4.7 鼠标

- `main.ts` 监听 `pointerdown`：`window.__clickMode()` 返回 `'space'` 时，模拟按一次空格。所以剧情、对话、菜单、选项、打结、标题画面都能用鼠标点。
- 在房间里自由走动时，模式是 `'world'`，由 `RoomScene.onPointer` 处理：只响应能调查的东西，点空地不会走路。
- 菜单、标题、考卷、背包、手机、第九幕的选项，鼠标移上去就会选中。

---

## 5. 房间数据（rooms.ts）

### 5.1 RoomDef 的字段

| 字段 | 内容 |
|---|---|
| `map` | 字符串数组。`#` 墙，`.` 地板，空格是地图外，数字是出口，字母是物件 |
| `objects` | 每个字母对应 `{ id, color, label, tex, look?, wall?, solid?, spot?, hidden?, fit? }`。`spot` 是材料放的位置；`look` 是有图时优先用的新外观 |
| `exits` | 每个数字对应 `{ to, arriveAt }` |
| `doors` | 门通往哪个房间，用来决定漏光门和门灯 |
| `floor` / `floorTex` / `outdoor` | 楼层 / 指定地板贴图 / 是否在室外 |
| `decor` | `{ tex, x, y, scale, angle, alpha, cycle, wall, fg }`。tex 前加 `decal:` 时从贴花目录找图 |
| `lights` | `{ x, y, scale, intensity, flicker, kind: 'lamp', state, cycle }` |
| `examine` | 一句话调查点 `{ ch \| x,y, key, cycle }`，台词在 `common.examine.*` |
| `chaseGates` | 追逐走廊里的障碍和绕行点 |

### 5.2 房间

| 位置 | 房间 |
|---|---|
| 校门外 | `school_gate` |
| 4F | `infirmary`、`corridor4`、`classroom4`、`art_prep4`、`locked_class4`、`music_prep4` |
| 3F | `classroom3`、`corridor3_long`（追逐战 2，由 `buildLongCorridor` 生成，240 格，5 处障碍）、`exam_room` |
| 2F | `stairs2`、`corridor2`、`pink_room2` |
| 管道 | `pipe` |
| 1F | `music_room`、`lobby` |
| 终周目 | `*_final` 系列 |

### 5.3 周目布局差异 `cycleLayout`

- 绘名周目：`corridor2` 被画布堆堵住，要从下面的教室绕过去。
- 瑞希周目：`corridor4` 下半边摆着人台。
- 奏周目：走廊的灯只在拍子上亮，写在 `RoomScene.updateDarkness` 里。

---

## 6. 每一幕现在的流程

| 幕 | 场景 | 流程 |
|---|---|---|
| 1 | 校门外 | 四个人在校门外，真冬看到门里的小女孩，走过去。小女孩转过头来，真冬一阵眩晕（镜头拉近、晃、模糊、变暗、心跳声），同伴们跑过来，真冬倒下 |
| 2 | 四楼 | 在医务室醒来。第一次进走廊时，镜头扫到门缝透光的逃生门。走到走廊右端，护士登场演一段，镜头去看开了门的逃生门，然后开始追逐战 1，要逃进四楼教室。被抓是结局 1，之后从追逐前重来 |
| 3 | 四楼教室 | 走到窗边触发剧情，发现下面是三楼的窗。扯下一根绳子，系在窗边（打结，失败是结局 2），顺着绳子往下爬（超时是结局 3） |
| 4 | 三楼 | 在三楼的画面里说「荡进了三楼」。镜头和侧光揭示吊着的绘名，护士顺着绳子往下爬。拿讲台上的剪刀，护士又往下爬一截，剪断绳子。出走廊，查看对面那扇门，怪物群涌出来，开始追逐战 2：坚持约 30 秒后出现考场门。被抓是结局 4，之后从走廊重来 |
| 5 | 考场 | 坐到自己的位子上答题。10 秒不答会问「交白卷吗？」，不交是结局 5。交卷后站起来，离开考场 |
| 6 | 二楼 | 楼梯间。走廊尽头的楼梯变成粉色的门，进去后的粉色房间里有成员场景，从管道钻出去。进房间时精神值 ≤ 25 是结局 6 |
| 7 | 管道 | 有数数声的那条路是结局 7，安静的那条通往音乐室 |
| 8 | 一楼音乐室 | 走近奏，奏碎开，音符怪物包围上来 |
| 9 | 邀请 | 选「同意」是结局 8；三秒内选「不同意」才能离开 |
| 10 | 大厅 | 推开大门。材料集齐进入终周目，没集齐是结局 9，进补完周目 |
| 终周目 | — | 医务室 → 从四楼楼梯直接下到一楼大厅 → 推开大门，三个人在门外等她 → 结局 10 |

---

## 7. 美术素材

- **还没画的图**：统一提示词在 `docs/art-prompts-ALL.md`。里面有清单、朝向规则，四段通用前缀（A 物件、B 贴花、C CG、D Q 版人物）也都在这一份里。
- **缺图时**：大多画色块占位；CG 缺图时不显示，只出台词。
- **新图放进对应目录就生效**，代码都接好了。包括：
  - `nurse_alert`、`nurse_lunge`
  - `knot_closeup`、`burst_door_face`
  - `mafuyu_child_turning`、`ena_hanged`
  - `exam_own_desk`、`stair_landing`
  - `floor_outdoor`、`street_lamp`、`decal_tree_shadow_01`
  - `cg_act01_gate`、`cg_act04_*`
- **新增一个素材**：
  1. 把图放进 `assets/<目录>/<名字>.png`。
  2. 在 `src/systems/sprites.ts` 的 `GROUPS` 里，对应分组的 names 加上这个名字。
  3. 代码里用 `tex('分组', '名字')` 取图。
- **新增剧情 CG**：再在 `CG_MOMENTS` 里登记「台词键 → CG 名」。

---

## 8. 待办（按优先级）

### P1

1. **外墙攀爬和三楼落点要连成一个动作**（`ClimbGame.ts`、Act03、Act04）：
   - 绳子固定点、角色脚的位置、护士在上方的距离、三楼窗框，用同一套坐标。
   - 进窗的动作：荡向窗户 → 撞上窗框 → 从左边滚进来 → 撑着地站起来。
2. **怪物群涌出来的演出**（`Act04.chaseIntro`）：门板打开 → 第一张笑脸卡在门缝里（等 `burst_door_face` 这张图，代码已接）→ 一群越过门槛 → 镜头朝右，交还控制。
3. **怪物群的样子**：同一个端正的站姿，配不同的头部角度；先一起不动，再交错着扑过来。
4. **明暗的底线**：关掉声音、关掉目标栏、把窗口缩到最小，仍然认得出角色、出口、门槛和场景变化。（出口微光、小光点、亮度设置已经做了）
5. **四楼走廊左右两端要好认**：逃生门那里加门牌或窗光。（门缝透光和第一次进走廊时的镜头扫视已经做了）

### P2

6. ~~第九幕「不同意」的阅读时间~~：**已做**，作者确认延长，`TIMERS.inviteRefuseSec` 从 3 秒改成 7 秒。
7. 考场的时间：作者决定**不改**（「三分钟」和 10 秒后问交白卷都保留）。
8. ~~手机~~：**已做**。第二次起拨号，电话那头传来半句听不清的话；名字已经变成乱码的人只有杂音。不给任何位置提示，因为规定没有人帮助真冬。扣精神值的规则没变。
9. **精神值**：让玩家知道是为什么被扣；精神值低的时候，路线、字幕、门也要看得清。
10. **设置**：加一个延长限时的选项。
11. **管道**：两条分岔在形状、光和声音上要能区分；数数声是诱饵的话，要给一条可以交叉验证的线索。
12. **音乐室**：奏要先有能看清的剪影；空椅子转向真冬；音符从琴下面涌出来。
13. **大厅**：鞋子和往门外去的足迹从画面中轴一路接到大门，门外透进冷光。
14. **终周目**：开过的逃生门半开着，墙边留着绳子的痕迹；重逢 CG 先让剪影消失，再亮起正脸。
15. 真冬主动回应同伴的动作：作者决定**不要**，不做。

### 美术（清单在 `docs/art-prompts-ALL.md`）

- **要重画**：`exit_threshold`、`ena_portrait_02`~`06`（一张一幅）、`mizuki_ribbon_03`、`decal_test_01/02`、`title`、`ending10_lot`、`floor2_lying`。
- **要新做**：
  - `ena_hanged`、`mizuki_mannequin`
  - `cg_act01_gate`、`cg_act04_fall`、`cg_act04_ena`、`cg_act04_swarm`
  - `nurse_alert`、`nurse_lunge`
  - `knot_closeup`、`burst_door_face`
  - `exam_own_desk`、`stair_landing`
  - `floor_outdoor`、`street_lamp`、`decal_tree_shadow_01`
  - `mafuyu_child_turning`
- **可选**：分周目的结局 CG。

---

## 9. 文档索引

| 文件 | 内容 |
|---|---|
| `docs/HANDOFF.md` | 本文件 |
| `docs/art-prompts-ALL.md` | ★ 所有待画素材的统一提示词 |
| `docs/art-revision.md` | 作者的美术规范（视角、尺寸、占地格数） |
| `docs/art-prompts.md` / `cg-prompts.md` / `art-prompts-fix.md` | 以前的提示词，已经合并进 ALL，只作参考 |
| `docs/examine-points.md` | 一句话调查点 |
| `docs/sound-list.md` | 音效清单 |
| `CREDITS.md` | 音效的来源和授权 |

---

## 10. 测试建议

- 改完先跑 `npx tsc --noEmit`，再 `npm run dev`，用 F2 跳到要测的那一幕，开无敌看一遍路线。
- 追逐要关掉无敌，真的跑一次。
- 找人盲测时，不要先告诉他答案，看这四个时刻：
  - 能不能看出开场是在校门外；
  - 护士出现以后，会不会马上转身去找逃生门；
  - 进三楼教室时，第一眼能不能认出是绘名；
  - 交卷以后，能不能直接走开。
