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

## 当前风险

| 风险 | 处理 |
| --- | --- |
| `source: inferred` 门洞较多 | 后续用 CAD/SKP 和现场复核替换 |
| 模型自动识别房间语义尚未完成 | 当前采用模型参照 + 手工语义拓扑 |
| 真实机器人方向传感器未实测 | 设备集成阶段验证权限和校准 |
| 小程序 Three parity 回退风险 | 已纳入 `check:miniprogram:parity` 和 `check:miniprogram:release`，禁止 WebView、localhost、全图 PNG 贴图回退 |
