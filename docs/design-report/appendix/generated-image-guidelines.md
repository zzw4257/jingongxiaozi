# 生成图提示词规范

## 使用范围

生成图只用于抽象架构、流程关系、概念表达和视觉开场。真实应用界面、地图结构、模型细节、路线正确性和发布状态必须使用真实截图、源码、QA 报告和构建记录。

## 参考图角色

每次生成前明确输入图角色：

| 角色 | 示例 | 用途 |
| --- | --- | --- |
| 风格参考 | `product-design-hero.png`、`map-navigation-design-deck.png` | 控制蓝白主色、科技感、排版和视觉密度 |
| 结构参考 | `h5-route-208.png`、`h5-map-overview.png` | 控制地图视角、右侧触控栏、路线和标签关系 |
| 早期目标参考 | `reference-25d-map.png`、`reference-2d-map.png` | 控制 2.5D 分层和空间表达方向 |
| 证据参考 | PDF/PPT 渲染页、QA 截图 | 限定内容边界，不让生成模型自行补设定 |

## 事实锁

地图相关生成图必须写入以下事实锁：

```text
Fact locks:
- 只有一层、二层、202二层半。
- 楼层标签只允许 1F、2F、2.5F。
- 只允许出现公共楼梯、104内梯、106内梯、108内梯。
- 只允许出现 101、104、106、108、202、208 等项目真实房号。
- 地图对象只允许房间、走廊、门洞、楼梯、路线。
- 终端只允许 Android移动端、微信小程序、机器人顶部触控屏。
```

后端相关生成图必须写入以下事实锁：

```text
Fact locks:
- 前端状态只包含待机、聆听、对话、专家、地图。
- 后端链路只表达唤醒、ASR、意图识别、知识检索、LLM、TTS。
- 前端只接收 BackendDirective 和 MapDirectRequest。
- 不画真实后端管理后台，不伪造控制台或接口返回。
```

## 禁止项

地图图禁用：

```text
Avoid:
- no 3F, no B1, no basement, no elevator
- no invented room numbers
- no QR code
- no fake dense app UI
- no fake CAD labels
- no English except GLB / Three / Android
- no watermark
```

报告概念图禁用：

```text
Avoid:
- no fake product screenshot
- no fabricated metrics
- no unreadable tiny interface text
- no random brand logo
- no unsupported hardware
- no extra robot type
```

## 文字策略

生成图中文字必须少、粗、可读。精确字段放 Markdown 表格、Mermaid 和代码块。

推荐文字：

- `金工小子`
- `声控唤醒`
- `后端智能`
- `顶部触控屏`
- `地图导航`
- `GLB模型`
- `语义拓扑`
- `路线服务`
- `Three场景`
- `双端复用`
- `房间`
- `走廊`
- `门洞`
- `楼梯`
- `路线`

不建议让生成图写完整接口名、长句、测试命令、模型参数和验收结论。

## 分辨率策略

RightCode 生成服务可能不按请求尺寸返回。每张图必须实测：

```bash
/opt/homebrew/bin/magick identify docs/design-report/assets/generated/<file>.png
```

记录请求尺寸和实际尺寸。若实际尺寸低于文档排版需求：

1. 优先使用内容事实更准确的版本。
2. 用 ImageMagick 本地放大锐化：

```bash
/opt/homebrew/bin/magick input.png -resize 3072x2048 -unsharp 0x0.9+0.8+0.02 output-upscaled.png
```

3. 在资产索引里标注“本地放大版”，不得写成原生 4K。

## 可用判据

生成图进入正文前需要通过：

| 检查 | 要求 |
| --- | --- |
| 事实 | 无不存在楼层、房间、楼梯、设备、接口 |
| 文字 | 主标题和关键标签可读，无明显乱码 |
| 风格 | 与金工小子设计稿蓝白科技风一致 |
| 用途 | 只作概念表达，不替代真实截图 |
| 尺寸 | 正文展示宽度下清晰，必要时使用放大版 |

## 弃用记录

`map-shared-scene-concept.png` 被弃用，原因是生成了 `3F / B1 / 电梯` 等项目不存在元素。

`map-shared-scene-concept-v2.png` 只保留为过程图，原因是设备屏幕存在伪 UI 风险。

`map-shared-scene-concept-v3.png` 只保留为过程图，原因是局部房号出现乱码。

`map-shared-scene-concept-v4-vip.png` 内容受控，但实际返回 `1536x1024`；正文使用 `map-shared-scene-concept-v4-vip-upscaled.png`。
