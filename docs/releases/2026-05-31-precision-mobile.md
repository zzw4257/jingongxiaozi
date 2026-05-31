# 金工小子五月底最精确移动端版本

本存档记录 2026-05-31 的移动端主线状态，作为后续地图、小程序和后端接入继续开发的回撤锚点。

## 范围

- 默认主体验：安卓横屏触控端，面向机器人头部嵌入式展示屏。
- 地图主线：真实 3D 模型地图 + 语义拓扑叠加 + 逐段导航引导。
- 小程序分支：WebView 复用 H5 地图，不单独实现第二套地图。
- 旧版手工地图：保留为演示入口，不作为默认主线。

## 当前能力

- 待机、聆听、普通对话、专家回答、地图五个应用状态保留。
- 后端可通过 `BackendDirective` 切换前端状态；地图可通过 `MapDirectRequest` 预填起点、终点和播报项。
- 地图支持横屏触控、缩放、平移、视角调整、路线面板、图层面板、逐段引导、真北基准提示。
- `104 / 106 / 108` 独立二层继续按内部楼梯约束处理；`202-5` 作为 2.5 层平台目标保留。
- 二层、202 平台和分层总览均有墙体/边界补强；传感器不可用时显示明确反馈，不静默失败。
- 微信小程序只负责入口、横屏壳、WebView 容器和 MapDirect 预设，和移动端 H5 使用同一套交互语义。

## 发布制品

APK 产物以本次发布命令生成的 arm64 包为准：

```text
build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
```

该包使用本地 ZJU 测试证书签名，`apksigner` v2/v3 校验通过，native ABI 只包含 `arm64-v8a`：

```text
SHA-256: 3fa9867330731d1ebb1d5255838215eae671c54a8ffc5c4cf468e1d61f79a37f
Signer: CN=Jingong Xiaozi Test, O=ZJU, C=CN
Unsigned SHA-256: 893dc225beaa157d05bde703556f72fb2d1651a098c245e7c17720f07054b4d9
```

## 验证命令

本节点发布前需要通过：

```bash
npm run check:miniprogram
npm run check:map
npm run build
npm run tauri -- android build --apk --target aarch64 --ci
```

本节点已完成上述四项验证，并额外完成：

```bash
/Users/zzw4257/Library/Android/sdk/build-tools/36.0.0/zipalign -c -p 4 build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
/Users/zzw4257/Library/Android/sdk/build-tools/36.0.0/apksigner verify --verbose --print-certs build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
unzip -l build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk | rg 'lib/.+\\.so'
shasum -a 256 build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
```

如需横屏视觉回归，可在本地服务启动后补跑：

```bash
npm run qa:mobile
```

## 回撤规则

- 后续小程序改动只改小程序壳或消息桥，不直接改地图核心。
- 后续地图改动应先确认安卓横屏和 H5 横屏可用，再同步小程序入口。
- 发布节点用 git tag 固化；如新改动炸掉地图，优先回到本节点对比，而不是在坏状态上继续猜。
