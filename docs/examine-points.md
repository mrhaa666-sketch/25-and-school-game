# 新增调查点（L3 / L4）

这些调查点**不扣精神、不给材料、不影响任何判定**，只显示一句话。
台词在 `src/data/text/zh-CN.json` 的 `common.examine` 下面（键名照下表）。要改哪一句，直接改那里就行。

- 格式和其他台词一样：数组，一行一句；真冬说的话写成 `"@真冬 ……"`。
- 「周目」一栏写了的，只在那个周目能调查到。
- 位置是房间地图上的格坐标（x 从左往右，y 从上往下，从 0 数起）。

| 房间 | 位置 | 看到的是什么 | 周目 | 文本键 |
|---|---|---|---|---|
| 医务室 | 左上，病床旁边 (4,1) | 输液架，挂着空的输液袋 | 全部 | `examine.infirmary.iv_stand` |
| 医务室 | 右下 (12,6) | 地上一大块干掉的水渍 | 全部 | `examine.infirmary.stain` |
| 医务室 | 药柜下面 (15,2) | 地上的碎玻璃 | 全部 | `examine.infirmary.glass` |
| 美术准备室 | 左墙 (1,2) | 石膏像的架子，石膏像都朝着墙 | 全部 | `examine.art_prep4.plaster_shelf` |
| 美术准备室 | 右边 (10,3) | 洗颜料的水池，池底积着干掉的颜料 | 全部 | `examine.art_prep4.paint_sink` |
| 美术准备室 | (3,2) | 地上散落的画纸 | 全部 | `examine.art_prep4.paper` |
| 美术准备室 | (2,3) | 堆在一起的画布，都是没画完的 | 绘名 | `examine.art_prep4.canvas_pile` |
| 音乐准备室 | 上方两个 (4,1)(7,1) | 谱架，上面什么都没放 | 全部 | `examine.music_prep4.music_stand` |
| 音乐准备室 | (9,4) | 叠起来的空泡面杯 | 奏 | `examine.music_prep4.cup_stack` |
| 音乐准备室 | (3,2) | 地上散落的乐谱 | 奏 | `examine.music_prep4.score` |
| 锁着的教室 | 右上 (10,1) | 穿着衣服的人台 | 瑞希 | `examine.locked_class4.mannequin` |
| 锁着的教室 | 黑板下 (6,1) | 地上的粉笔灰 | 全部 | `examine.locked_class4.chalk` |
| 四楼教室 | 后墙左边 (3,1) | 墙上贴满的奖状 | 真冬 | `examine.classroom4.award_wall` |
| 四楼教室 | (6,6) | 地上的一张试卷 | 真冬 | `examine.classroom4.test` |
| 四楼教室 | 黑板下 (10,1) | 地上的粉笔灰 | 全部 | `examine.classroom4.chalk` |
| 三楼教室 | 后墙右边 (13,1) | 墙上贴满的奖状 | 真冬 | `examine.classroom3.award_wall` |
| 三楼教室 | (10,6) | 地上的一张试卷 | 真冬 | `examine.classroom3.test` |
| 三楼教室 | (14,4) | 地上的一串脚印 | 全部 | `examine.classroom3.footprint` |
| 考场 | 后墙左边 (2,1) | 墙上贴满的奖状 | 真冬 | `examine.exam_room.award_wall` |
| 考场 | (14,6) | 地上的一张试卷 | 真冬 | `examine.exam_room.test` |
| 考场 | (3,8) | 地上的一张草稿纸 | 全部 | `examine.exam_room.paper` |
| 音乐室 | 钢琴右边 (11,1) | 节拍器，停着 | 全部 | `examine.music_room.metronome` |
| 音乐室 | (13,3)(15,3) | 谱架 | 全部 | `examine.music_room.music_stand` |
| 音乐室 | (4,4) | 地上散落的乐谱 | 全部 | `examine.music_room.score` |
| 大厅 | 上方 (5,1)(6,1) | 奖杯柜，玻璃很脏 | 全部 | `examine.lobby.trophy_case` |
| 大厅 | 大门旁 (9,5) | 一双摆得很整齐的鞋 | 全部 | `examine.lobby.shoes` |
| 大厅 | (8,4) | 从大门往里走的一串脚印 | 全部 | `examine.lobby.footprint` |
| 二楼楼梯间 | (6,2) | 地上的裂缝 | 全部 | `examine.stairs2.crack` |
| 二楼走廊 | 堵住走廊的画布堆 (14~15) | 画布堆，最上面那张是没有五官的脸 | 绘名 | `examine.corridor2.canvas_pile` |
| 四楼走廊 | 下半边的人台 (15~22) | 一排人台，都朝着同一个方向 | 瑞希 | `examine.corridor4.mannequin` |

写的时候遵守的约束：不写成规则或守则，不写成有人在帮她或留言提示，不写血腥。
