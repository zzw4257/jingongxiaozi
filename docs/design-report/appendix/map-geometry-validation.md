# 地图几何与导航校验

## 数据源优先级

地图采用模型事实、CAD / SKP 参考、标识图和手工语义共同约束。来源优先级固定为：

```text
model > cad > reference > inferred
```

| 来源 | 作用 |
| --- | --- |
| `jingong.glb` | 主视觉模型和建筑轮廓 |
| `jingong-fallback.glb` | STL fallback 几何 |
| `金工.dwg` | 平面边界、房间比例和门洞校准 |
| `金工.skp` | 高保真空间参考 |
| `金工中心标识20260317-2.pdf` | 房号、空间名称、功能区标签 |
| `mapData.ts` | 可点击、可导航、可校验的语义地图 |

这里的“优先级”不是简单决定谁覆盖谁，而是决定不同事实的职责边界。模型和 CAD 更适合判断轮廓、墙体、门洞和比例；标识图更适合判断空间名称和功能；`mapData.ts` 则把这些信息整理成可点击、可算路、可测试的数据。运行时不会让后端或小程序自行解释几何关系，所有端都应回到同一份语义地图。

## 设计原理

地图采用“真实模型 + 闭合空间 + 导航拓扑”的三层结构：

| 层 | 内容 | 验证重点 |
| --- | --- | --- |
| 真实模型 | GLB / STL 转换后的建筑视觉参照 | bbox、mesh、楼层高度、校准点误差 |
| 闭合空间 | 房间、走廊、楼梯、卫生间、服务空间、承托结构 | 外轮廓闭合、内部有填充、无无意义空洞 |
| 导航拓扑 | 门洞、走廊中心线、楼梯 portal、路线边 | 不穿墙、门连接相邻空间、楼梯上下口配对 |

这三层分别解决不同问题：真实模型解决“像不像现场”，闭合空间解决“看不看得懂”，导航拓扑解决“能不能按物理常识走”。如果只保留模型，路线和房间语义无法稳定计算；如果只保留拓扑，用户又无法建立真实空间感。因此最终验收要求三层同时成立。

## 运行时渲染管线

地图运行时不是加载一张地图图片，而是按固定顺序生成 Three 场景：

| 顺序 | 内容 | 作用 |
| --- | --- | --- |
| 1 | GLB 模型和楼层基准 | 提供真实空间比例和整体轮廓 |
| 2 | 楼板与承托结构 | 明确一层、二层、202 平台和二层半下方投影 |
| 3 | 空间面 | 用不同颜色/材质区分 room、corridor、stair、restroom、service、support |
| 4 | 闭合墙体和门洞 | 外墙包裹楼层，内墙分隔相邻空间，门洞只出现在合法相邻空间之间 |
| 5 | 楼梯实体 | landing、梯段、踏步和上下 portal 对齐 |
| 6 | 路线几何 | 当前段、走廊段、门段、楼梯段按类型渲染 |
| 7 | 关键 pin 和动态标签 | 只突出当前位置、下一节点、终点和近景房间信息 |

这个顺序保证地图首先是完整建筑，再是导航信息。普通门点和房间中心点不直接作为产品可见元素，只作为 raycast / picking 热区；否则会出现大量漂浮圆点，破坏空间理解。

## 跨端同步管线

移动端和小程序都不能各自解释地图。同步流程如下：

| 步骤 | 内容 |
| --- | --- |
| 移动端主线 | `mapData.ts`、路线服务、模型对齐和动态标签策略作为基准 |
| 生成/同步 | 脚本将房间、空间、门洞、楼梯、路线规则和必要资源同步到 `miniprogram/` |
| 小程序渲染 | 微信 `canvas type="webgl"` 初始化 Three 适配层，加载包内地图数据和模型资源 |
| parity 检查 | `check:miniprogram:parity` 阻止 WebView、localhost、全图 PNG、固定 demo 路线和旧自绘逻辑回退 |

因此小程序不是“另一套简化地图”，而是同一份空间语义在微信宿主中的表达。若移动端新增房间、门洞或楼梯规则，必须同步并通过小程序门禁。

## 数据结构

| 类型 | 字段 |
| --- | --- |
| `FloorGeometry` | 楼层轮廓、高度、走廊面 |
| `MapRoom` | 房间 ID、房号、名称、功能区、polygon、中心点、门节点 |
| `MapSpace` | room、corridor、stair、restroom、service、storage、reserved、void |
| `WallSegment` | 外墙、内墙、低墙、虚拟墙 |
| `DoorSegment` | 门洞线段、宽度、法线、连接对象、来源、导航节点 |
| `StairGeometry` | 公共楼梯、内部楼梯、上下 landing、上下节点 |
| `CenterlineSegment` | 走廊中心线、楼梯接近线、服务空间连接 |
| `CalibrationPoint` | 外轮廓、楼梯、门洞、走廊、202 平台控制点 |

## 当前统计

来自 `qa/alignment/latest-map-qa-report.json` 和 `qa/alignment/latest-alignment-report.json`：

| 指标 | 数值 |
| --- | --- |
| rooms | 53 |
| spaces | 80 |
| doors | 53 |
| stairs | 4 |
| centerlines | 16 |
| defaultLayerMode | `allFloors` |
| floorHeight | `0.92` |
| physicalFloorOffsetXZ | 一层 `[0, 0]`，二层 `[0, 0]` |
| explodedFloorOffsetXZ | 一层 `[0.16, 0.13]`，二层 `[-0.46, -0.38]` |
| 1F rooms / spaces | 26 / 36 |
| 2F rooms / spaces | 27 / 44 |
| corridor spaces | 一层 3，二层 3 |

空间分类：

| kind | 数量 |
| --- | --- |
| corridor | 6 |
| stair | 8 |
| room | 53 |
| restroom | 2 |
| service | 1 |
| storage | 1 |
| reserved | 1 |
| support | 8 |

门洞来源：

| source | 数量 |
| --- | --- |
| inferred | 30 |
| reference | 15 |
| cad | 8 |

## 模型资产

| 项 | 主模型 | fallback |
| --- | --- | --- |
| path | `public/map-models/jingong.glb` | `public/map-models/jingong-fallback.glb` |
| source | `models/金工中心模型.3ds` | `models/金工中心精确模型.stl` |
| role | visual-model | low-fidelity-geometry |
| bytes | 263036 | 137384 |
| nodes | 32 | 2 |
| meshes | 47 | 1 |
| materials | 24 | 1 |
| vertices | 5000 | 3591 |
| faces | 4198 | 4162 |

主模型 runtime bbox：

| 指标 | 数值 |
| --- | --- |
| minPoint | `[-16630.345703, -14097, -790843.3125]` |
| maxPoint | `[777437.8125, 47373.054688, 17519.503906]` |
| bboxSize | `[794068.158203, 61470.054688, 808362.816406]` |
| runtimeCenteredScale | `0.000010638787219624723` |

## 校准控制点

控制点共 16 个，一层 8 个，二层 8 个。

| 楼层 | 控制点 |
| --- | --- |
| 1F | 西南外轮廓、东南外轮廓、东侧外轮廓、北侧外轮廓、公共楼梯一层口、104 门洞、106 内梯一层、108 内梯一层 |
| 2F | 西北外轮廓、东侧外轮廓、公共楼梯二层口、202 平台中心、104 内梯二层、106 内梯二层、108 内梯二层、202-5 门洞 |

校验记录：

| 指标 | 记录 |
| --- | --- |
| `controlPointCount` | 16 |
| `floorCounts` | `1F: 8`，`2F: 8` |
| `declaredMaxError` | 0.000 |
| `declaredAverageError` | 0.000 |
| 最新 `check:map` | max error 0.000，average error 0.000 |

## 楼层模式

| 模式 | 目的 | 几何策略 |
| --- | --- | --- |
| `allFloors` | 默认总览 | 一层和二层物理对齐，不做水平错位 |
| `single` | 单层精看 | 只显示当前楼层，保持完整轮廓和门洞 |
| `raised202` | 202 平台 | 抬升 202 平台并保留下方承托 |
| `exploded` | 分层总览 | 上下楼层拉开，便于观察楼梯配对 |
| `section` | 剖切路线 | 保留跨层关系，降低模型遮挡 |

`modelAlignment.ts` 中关键参数：

| 参数 | 值 |
| --- | --- |
| `modelScale` | `0.00815` |
| `floorHeight` | `0.92` |
| `explodeHeight` | `1.18` |
| `slabThickness` | `0.045` |
| `wallHeight` | `0.38` |
| `outerWallHeight` | `0.54` |
| `raised202Space.height` | `0.46` |

## 楼梯约束

| id | label | access | 连接 |
| --- | --- | --- | --- |
| `stair-public` | 公共楼梯 | public | `stair-public-1f <-> stair-public-2f` |
| `stair-104` | 104 内部楼梯 | internal | `stair-104-1f <-> stair-104-2f` |
| `stair-106` | 106 内部楼梯 | internal | `stair-106-1f <-> stair-106-2f` |
| `stair-108` | 108 内部楼梯 | internal | `stair-108-1f <-> stair-108-2f` |

公共楼梯只接公共二层走廊。`104-2F01`、`106-2F`、`108-2F04` 等独立二层空间只能通过对应内部楼梯到达。

楼梯在视觉和拓扑上必须同时成立：

| 要求 | 含义 |
| --- | --- |
| landing 配对 | 一层入口和二层出口必须成对出现，不能只画一段漂浮楼梯 |
| access 区分 | public 只服务公共二层，internal 只服务对应房间内部二层 |
| 路线分段 | 上楼前、梯段中、出楼梯后分别属于不同导航段 |
| 单层保留语义 | 单看一层或二层时仍能理解楼梯口位置，不因过滤楼层而断裂 |

## 路线规则

路线生成使用 `calculateRoute(data, startRoomId, targetRoomId)`。搜索节点来自 `MapData.nodes`，边来自 `MapData.edges`，每条路径输出：

- `totalMeters`
- `estimatedSeconds`
- `steps`
- `guidanceLegs`
- `points`
- `announceLines`

关键路线：

| 路线 | 必经关系 |
| --- | --- |
| `101 -> 104-2F01` | `center-101 -> door-101 -> c1-101 -> c1-107 -> c1-104 -> stair-104-1f -> stair-104-2f -> door-104-2F01 -> center-104-2F01` |
| `101 -> 108-2F04` | `center-101 -> door-101 -> c1-101 -> c1-107 -> c1-108 -> stair-108-1f -> stair-108-2f -> door-108-2F04 -> center-108-2F04` |
| `108-lobby -> 202-5` | `center-108-lobby -> door-108-lobby -> c1-108 -> c1-107 -> stair-public-1f -> stair-public-2f -> c2-main -> c2-202 -> door-202-5 -> center-202-5` |

## 视觉校验点

| 视图 | 检查 |
| --- | --- |
| 全楼总览 | 上下层物理对齐，路线端点不漂浮 |
| 一层 | 房间、走廊、门洞、楼梯和墙体可分辨 |
| 二层 | 公共二层、独立二层和 202 下方承托可区分 |
| 202 平台 | 高平台、过道、公共楼梯和下方结构同时可理解 |
| 爆炸分层 | 楼梯上下口配对可见，层间距足够 |
| 路线聚焦 | 当前点、下一检查点、目标 pin 明确 |
| 标签密度 | 远景稀疏，近景展开，单层视图优先显示完整标签 |

视觉校验不只看一张默认截图。每次地图结构改动后，应至少检查：

1. 无导航总览：空间结构是否完整。
2. 有导航总览：非路线空间是否弱化但不消失。
3. 单层一层：墙体、门、走廊、楼梯和服务空间是否各有意义。
4. 单层二层：公共二层、独立二层、202 承托是否没有错位和空洞。
5. 202 平台：平台、下方投影、公共楼梯和目标门是否能同时读懂。
6. 爆炸分层：层间距是否足够，楼梯上下口是否能对应。
7. 路线推进：当前段、下一节点、终点 pin 是否比普通标签更突出。

这些检查项来自早期反复暴露的问题：墙体漂浮、楼梯碎片、二层半像空框架、门点和房间点脱离楼板、标签全消失或过密。后续不能只用“默认视角看起来还行”替代完整检查。

## 当前风险

| 风险 | 处理 |
| --- | --- |
| `source: inferred` 门洞较多 | 后续用 CAD/SKP 和现场复核替换 |
| 模型自动识别房间语义尚未完成 | 当前采用模型参照 + 手工语义拓扑 |
| 真实机器人方向传感器未实测 | 设备集成阶段验证权限和校准 |
| 小程序 Three parity 回退风险 | 已纳入 `check:miniprogram:parity` 和 `check:miniprogram:release`，禁止 WebView、localhost、全图 PNG 贴图回退 |
