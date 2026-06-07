# 资产证据索引

## 参考输入

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| 2.5D 参考图 | `../assets/evidence/reference-25d-map.png` | 分层楼体、路线卡、图层筛选、跨层路径 |
| 2D 参考图 | `../assets/evidence/reference-2d-map.png` | 平面墙体、房间邻接、门洞、走廊和图例 |
| 现场示意图 | `../assets/evidence/site-observation.jpg` | 现场观察、空间印象和需求补充 |
| 金工中心标识 PDF | `../../../../地图导航模组/金工中心标识20260317-2.pdf` | 品牌与标识素材 |
| 工程训练教程 PDF | `../../../../知识库/材料/工程训练实训教程 (周继烈，姚建华主编, 周继烈, 姚建华主编, 姚建华, Yao jian hua etc.) (z-library.sk, 1lib.sk, z-lib.sk).pdf` | 工程训练背景资料 |

## 模型与运行资产

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| 3DS 模型 | `../../../models/金工中心模型.3ds` | 主视觉模型来源 |
| STL 模型 | `../../../models/金工中心精确模型.stl` | 几何 fallback 和校准参考 |
| DWG 平面图 | `../../../models/金工.dwg` | 平面校准参考 |
| SKP 模型 | `../../../models/金工.skp` | 高保真空间参考 |
| GLB 主模型 | `../../../public/map-models/jingong.glb` | Three.js 运行时模型 |
| GLB fallback | `../../../public/map-models/jingong-fallback.glb` | 低保真运行时模型 |
| 模型 manifest 快照 | `model-manifest.snapshot.json` | mesh、顶点、bbox、缩放和来源记录 |

## 移动端与 H5 截图

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| 待机横屏 | `../assets/evidence/kiosk-standby.png` | 机器人展示端默认状态 |
| H5 地图总览 | `../assets/evidence/h5-map-overview.png` | 横屏调试基准 |
| H5 208 路线 | `../assets/evidence/h5-route-208.png` | 逐段引导、真北、路线标记 |
| H5 图层面板 | `../assets/evidence/h5-layers-panel.png` | 图层与面板交互 |
| Android 地图面板 | `../assets/evidence/android-map-panel-final.png` | 模拟器横屏验证 |
| 202 平台修复 | `../assets/evidence/map-raised202-wall-fix.png` | 二层半和承托结构表达 |

## 小程序截图

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| 小程序首页 | `../assets/evidence/miniprogram-home-devtools.png` | 微信开发者工具横屏入口 |
| 小程序 208 路线 | `../assets/evidence/miniprogram-route-208.png` | WebGL 地图、触控栏、路线引导 |
| H5 对照路线 | `../assets/evidence/h5-miniprogram-baseline-route-208.png` | 与小程序路线对照 |

## 生成图

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| 声控到地图流程 | `../assets/generated/voice-map-flow.png` | 声控、后端、地图和触控终端关系 |
| 模型语义路线分层 | `../assets/generated/model-semantic-route-layers.png` | 真实模型、语义几何、导航服务分层 |
| 迭代时间线 | `../assets/generated/development-timeline.png` | 需求、原型、模型、移动端、小程序、后端演进 |
| 门洞走廊楼梯路线 | `../assets/generated/door-corridor-stair-route.png` | 路线按门、走廊、楼梯逐段生成 |

## 生成图参数

| 图 | 模型 | 请求尺寸 | 实际尺寸 |
| --- | --- | --- | --- |
| `voice-map-flow.png` | `gpt-image-2` | `1536x1024` | `1693x929` |
| `model-semantic-route-layers.png` | `gpt-image-2` | `1536x1024` | `1197x1315` |
| `development-timeline.png` | `gpt-image-2` | `1536x1024` | `1706x922` |
| `door-corridor-stair-route.png` | `gpt-image-2` | `1536x1024` | `1308x1202` |

