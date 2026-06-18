# 资产证据索引

## 目录结构

| 目录 | 内容 |
| --- | --- |
| `../assets/evidence/` | 报告正文直接引用的真实证据图 |
| `../assets/evidence/pdf-pages/` | PDF 渲染页 |
| `../assets/evidence/ppt-media/` | PPT 内嵌图片提取结果 |
| `../assets/evidence/process/` | QA 过程板、PDF/PPT contact sheet、应用资产拼图 |
| `../assets/generated/` | RightCode 生成概念图和本地放大版 |
| `../../../models/` | 3DS、STL、DWG、SKP 模型源文件 |
| `../../../public/map-models/` | 运行时 GLB、模型 manifest、纹理 |

## 初始资料

| 资产 | 源路径 | 报告路径 | 用途 |
| --- | --- | --- | --- |
| 导航模式图 v1 | `../../../../地图导航模组/导航模式图v1.png` | `../assets/evidence/reference-25d-map.png` | 2.5D 分层、路线面板、图层筛选参考 |
| 导航模式图 v2 | `../../../../地图导航模组/导航模式图v2.png` | `../assets/evidence/reference-2d-map.png` | 2D 墙体、门洞、功能区、图例参考 |
| 现场示意图 | `../../../../地图导航模组/示意图.jpg` | `../assets/evidence/site-observation.jpg` | 现场观察和空间印象 |
| 金工中心标识 PDF | `../../../../地图导航模组/金工中心标识20260317-2.pdf` | `../assets/evidence/pdf-pages/signage-1.png`、`signage-2.png` | 一层、二层房间命名与功能标识 |
| 工程训练课程汇报 | `../../../../项目设计实践.pdf` | `../assets/evidence/pdf-pages/project-practice-*.png` | 工程训练课程、青龙 Mini 机器人和验收要求背景 |
| 语音机器人方案 | `../../../../设计方案.pdf` | `../assets/evidence/pdf-pages/design-scheme-*.png` | 全双工语音、知识增强、动作协同、安全中断和资源清单 |

PDF 渲染记录：

| 文件 | 页数 | 渲染尺寸 |
| --- | --- | --- |
| `设计方案.pdf` | 7 | 1191 x 1684 |
| `项目设计实践.pdf` | 20 | 1920 x 1080 |
| `金工中心标识20260317-2.pdf` | 2 | 1920 x 1080 |

## 产品设计稿

`金工小子设计稿.pptx` 内含 8 张 1672 x 941 图片，已解包到 `../assets/evidence/ppt-media/jingong-draft/`。

| 语义化文件 | 来源 | 用途 |
| --- | --- | --- |
| `../assets/evidence/product-design-hero.png` | `image1.png` | 产品定位、机器人形态、地图主功能 |
| `../assets/evidence/robot-terminal-state-design.png` | `image3.png` | 机器人端交互状态 |
| `../assets/evidence/map-navigation-design-deck.png` | `image4.png` | 地图导航目标形态 |
| `../assets/evidence/software-integration-design.png` | `image6.png` | 软件一体化架构 |
| `../assets/evidence/service-extension-roadmap.png` | `image8.png` | 服务延伸和落地路线 |

`演示文稿2.pptx` 也含 8 张 1672 x 941 图片，已解包到 `../assets/evidence/ppt-media/demo2/`。内容偏 LoRA / 训练规划，与金工小子主线关系弱，只作为非主线参考材料保留。

## 模型资产

| 资产 | 路径 | 角色 |
| --- | --- | --- |
| 3DS 模型 | `../../../models/金工中心模型.3ds` | 主视觉模型来源 |
| STL 模型 | `../../../models/金工中心精确模型.stl` | 几何 fallback 和校准参考 |
| DWG 平面图 | `../../../models/金工.dwg` | 平面校准参考 |
| SKP 模型 | `../../../models/金工.skp` | 高保真空间参考 |
| GLB 主模型 | `../../../public/map-models/jingong.glb` | Three.js 运行时模型 |
| GLB fallback | `../../../public/map-models/jingong-fallback.glb` | 低保真运行时模型 |
| manifest | `../../../public/map-models/model-manifest.json` | mesh、bbox、缩放、来源记录 |

模型 manifest 记录：

| 项 | 主模型 | fallback |
| --- | --- | --- |
| bytes | 263036 | 137384 |
| nodes | 32 | 2 |
| meshes | 47 | 1 |
| vertices | 5000 | 3591 |
| faces | 4198 | 4162 |
| 来源 | `models/金工中心模型.3ds` | `models/金工中心精确模型.stl` |

## QA 过程图

| 资产 | 路径 | 说明 |
| --- | --- | --- |
| Android 触控迭代板 | `../assets/evidence/process/android-touch-iteration-strip.png` | 待机入口、地图入口、面板、最终 3D 地图 |
| 地图几何迭代板 | `../assets/evidence/process/map-geometry-iteration-strip.png` | 楼梯、202 平台、端点标注、分层视图 |
| 小程序一致性迭代板 | `../assets/evidence/process/miniprogram-parity-iteration-strip.png` | 微信开发者工具、宿主 UI、路线、H5 golden 对照 |
| 终端最终状态拼图 | `../assets/evidence/process/final-terminal-state-strip.png` | 待机、聆听、常态对话、专家问答最终横屏状态 |
| 地图路线最终状态拼图 | `../assets/evidence/process/final-map-route-strip.png` | 地图总览、202-5、104-2F01、208 关键路线最终横屏状态 |
| 应用生成资产板 | `../assets/evidence/process/app-generated-assets-strip.png` | 表情、地图、楼梯等应用内视觉资产 |
| 设计方案 contact sheet | `../assets/evidence/process/contact-design-scheme.png` | 7 页语音机器人方案总览 |
| 项目实践 contact sheet | `../assets/evidence/process/contact-project-practice.png` | 20 页课程资料总览 |
| 金工小子设计稿 contact sheet | `../assets/evidence/process/contact-ppt-jingong-draft.png` | 8 张产品设计稿总览 |

## 移动端与 H5 截图

| 资产 | 路径 | 来源 |
| --- | --- | --- |
| 待机横屏 | `../assets/evidence/kiosk-standby.png` | H5 / kiosk 截图 |
| H5 地图总览 | `../assets/evidence/h5-map-overview.png` | `h5-live-map-default-20260603.png` |
| H5 208 路线 | `../assets/evidence/h5-route-208.png` | `h5-live-route-208-after-camera-20260603.png` |
| H5 图层面板 | `../assets/evidence/h5-layers-panel.png` | 图层浮层验证 |
| Android 地图面板 | `../assets/evidence/android-map-panel-final.png` | Android 模拟器横屏验证 |
| 202 平台修复 | `../assets/evidence/map-raised202-wall-fix.png` | 二层半承托结构验证 |
| 终端最终状态拼图 | `../assets/evidence/process/final-terminal-state-strip.png` | 2026-06-18 H5 横屏 Playwright 截图合成 |
| 地图路线最终状态拼图 | `../assets/evidence/process/final-map-route-strip.png` | 2026-06-18 H5 横屏 Playwright 截图合成 |

## 小程序截图

| 资产 | 路径 | 说明 |
| --- | --- | --- |
| 小程序首页 | `../assets/evidence/miniprogram-home-devtools.png` | 微信开发者工具横屏入口 |
| 小程序 208 路线 | `../assets/evidence/miniprogram-route-208.png` | 小程序 WebGL/宿主验证截图 |
| H5 对照路线 | `../assets/evidence/h5-miniprogram-baseline-route-208.png` | 移动端 golden 对照 |

小程序截图只证明迁移过程和对齐目标，不能单独证明发布级完全一致。当前发布级验收以 `check:miniprogram`、`check:miniprogram:parity`、`check:miniprogram:release`、真实 AppID `wx160ad5f2d6c16281`、包内 Three 场景和微信开发者工具预览共同约束。

## 生成概念图

| 资产 | 模型 | 请求尺寸 | 实际尺寸 | 状态 |
| --- | --- | --- | --- | --- |
| `../assets/generated/voice-map-flow.png` | `gpt-image-2` | 1536 x 1024 | 1693 x 929 | 可用，低事实风险 |
| `../assets/generated/voice-map-flow-upscaled.png` | 本地放大 | 3386 x 1858 | 3386 x 1858 | 正文优先使用 |
| `../assets/generated/robot-terminal-system-concept.png` | `gpt-image-2` | 1536 x 1024 | 1672 x 941 | 可用作概念图，不作 UI 证据 |
| `../assets/generated/map-shared-scene-concept-v4-vip.png` | `gpt-image-2-vip` | 3840 x 2160 | 1536 x 1024 | 内容受控，分辨率未达 4K |
| `../assets/generated/map-shared-scene-concept-v4-vip-upscaled.png` | 本地放大 | 3072 x 2048 | 3072 x 2048 | 正文优先使用 |
| `../assets/generated/map-shared-scene-concept.png` | `gpt-image-2` | 1536 x 1024 | 1672 x 941 | 弃用，含 3F / B1 / 电梯等错误 |
| `../assets/generated/map-shared-scene-concept-v2.png` | `gpt-image-2` | 1536 x 1024 | 1672 x 941 | 过程图，设备屏幕有伪 UI 风险 |
| `../assets/generated/map-shared-scene-concept-v3.png` | `gpt-image-2` | 1536 x 1024 | 1672 x 941 | 过程图，存在局部乱码房号 |

生成图只表达抽象架构、流程和概念关系。房间数量、模型参数、路线约束、构建结果以源码、QA JSON、发布记录和真实截图为准。

本次收尾没有新增 RightCode 生成图。原因是当前报告缺口主要是“真实状态证据”和“后端/小程序契约更新”，更适合使用 Playwright 截图、验证日志和已有概念图；新增生成图容易引入与实际 UI 不一致的视觉信息。
