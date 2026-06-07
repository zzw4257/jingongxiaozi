# 发布与验证记录

## 核心命令

```bash
npm run check:map
npm run check:miniprogram
npm run build
npm run tauri -- android build --apk --target aarch64 --ci
```

`check:map` 组合执行地图数据、路线、模型资产、对齐和 QA 报告检查。`check:miniprogram` 检查小程序自包含结构、横屏配置、页面入口、MapDirect 参数和 WebGL 地图门禁。`build` 生成 H5 生产构建。Android 构建生成 arm64 APK。

## Android 记录

2026-05-31 移动端基准版本发布产物：

```text
build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
```

发布记录：

| 项 | 结果 |
| --- | --- |
| 签名 | 本地 ZJU 测试证书 |
| 校验 | `apksigner` v2/v3 通过 |
| ABI | `arm64-v8a` |
| SHA-256 | `3fa9867330731d1ebb1d5255838215eae671c54a8ffc5c4cf468e1d61f79a37f` |
| 验证设备 | Android 模拟器横屏流程 |

Android smoke v36 记录补充：

| 项 | 结果 |
| --- | --- |
| `npm run check:map` | pass |
| `npm run build` | pass |
| `cd src-tauri && cargo check` | pass |
| Android APK build | pass |
| `adb install -r` | pass |
| 冷启动 | `4584 ms` |

## H5 截图证据

| 截图 | 路径 |
| --- | --- |
| 地图总览 | `../assets/evidence/h5-map-overview.png` |
| 208 路线 | `../assets/evidence/h5-route-208.png` |
| 图层面板 | `../assets/evidence/h5-layers-panel.png` |
| 小程序对照路线 | `../assets/evidence/h5-miniprogram-baseline-route-208.png` |

## 小程序记录

小程序目录：

```text
miniprogram/
```

当前发布线要求：

| 项 | 要求 |
| --- | --- |
| 入口 | `pages/map/map` 可直接打开 |
| 方向 | 横屏 |
| 导航 | `MapDirect` 参数与移动端一致 |
| 渲染 | `canvas type="webgl"` |
| 资产 | 包内资源，不依赖本地 H5 服务 |
| 禁止项 | localhost、`5173`、WebView、全图 PNG 贴图 |
| 发布门禁 | 真实 AppID 和 HTTPS 业务域名 |

微信开发者工具曾记录 `appid missing` 和本地服务限制。该状态属于发布配置阻塞。页面样式和地图一致性需要以真实 AppID、真机或开发者工具最终截图验收。

## 剩余风险

| 风险 | 处理方式 |
| --- | --- |
| 机器人真实硬件传感器权限 | 接入真实设备后验证方向校准和权限反馈 |
| 小程序 WebGL 与移动端完全一致 | 持续使用移动端截图作为 golden，对照小程序截图 |
| Three.js 构建体积 | 后续按地图场景和普通页面拆包 |
| 真实后端接入 | 按 `BackendDirective` 和 `MapDirectRequest` 做最小适配器 |
| 模型语义自动识别 | 当前采用模型参照加语义数据，后续可用 CAD/SKP 增量修正 |

