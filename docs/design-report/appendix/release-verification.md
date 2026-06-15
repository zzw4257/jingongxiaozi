# 发布与验证记录

## 核心脚本

`package.json` 中发布相关脚本：

| 脚本 | 作用 |
| --- | --- |
| `npm run check:model` | 校验 GLB 模型资产 |
| `npm run check:alignment` | 校验模型对齐、控制点和门洞 |
| `npm run qa:map-report` | 生成地图 QA JSON |
| `npm run check:map` | 组合校验地图数据、路线、模型、对齐和 QA 报告 |
| `npm run check:miniprogram` | 校验小程序自包含结构、横屏配置、入口和 MapDirect 参数 |
| `npm run check:miniprogram:parity` | 发布级小程序 Three 一致性门禁 |
| `npm run check:miniprogram:release` | AppID、发布配置和正式限制门禁 |
| `npm run build` | TypeScript + Vite 生产构建 |
| `npm run qa:mobile` | 可选 Playwright 横屏布局 QA |

## Android v36 smoke

来源：`qa/android-map-smoke-v36.md`

| 项 | 结果 |
| --- | --- |
| 日期 | 2026-05-24 18:10 CST |
| 范围 | 楼层高度、单层可读性、路线端点、Android kiosk 触控 |
| APK | `build/android-release/jingong-xiaozi-0.1.0-map-height-v36-arm64-test-signed.apk` |
| 大小 | 19 MB |
| ABI | `arm64-v8a` only |
| 签名 | apksigner v2/v3 verified，`CN=Jingong Xiaozi Test, O=ZJU, C=CN` |
| `npm run check:map` | pass |
| `npm run build` | pass |
| `cd src-tauri && cargo check` | pass |
| Android APK build | pass |
| `zipalign -c -p 4` | pass |
| `apksigner verify --verbose --print-certs` | pass |
| `adb install -r` | pass |
| 冷启动 | `4584 ms` |

v36 自动校验记录：

| 项 | 数值 |
| --- | --- |
| rooms | 53 |
| door segments | 53 |
| spaces | 71 |
| centerlines | 16 |
| primary model | 47 meshes / 5000 vertices |
| alignment max error | 0.074 |
| alignment average error | 0.037 |

v36 截图证据：

| 场景 | 路径 |
| --- | --- |
| Web 默认地图 | `qa/screenshots/web-v36/jingong-v36b-map-default-844x390.png` |
| Web 一层 | `qa/screenshots/web-v36/jingong-v36b-single-1f-844x390.png` |
| Web 二层 | `qa/screenshots/web-v36/jingong-v36b-single-2f-844x390.png` |
| Web 爆炸分层 | `qa/screenshots/web-v36/jingong-v36b-exploded-844x390.png` |
| Android 待机 | `qa/screenshots/android-v36-standby-loaded.png` |
| Android 默认地图 | `qa/screenshots/android-v36-map-default-2.png` |
| Android 图层面板 | `qa/screenshots/android-v36-layers-panel-2.png` |
| Android 路线 | `qa/screenshots/android-v36-route-104-final.png` |

## Android v34 route guidance

来源：`qa/android-map-smoke-v34.md`

v34 验证了“节点级导引 + Android 横屏触控面板 + 2D/视角控制”：

| 项 | 记录 |
| --- | --- |
| 设备 | `emulator-5554` |
| 型号 | `sdk_gphone64_arm64` |
| 应用截图尺寸 | `2400x1080` |
| 包名 | `cn.edu.zju.jingongxiaozi` |
| APK | `jingong-xiaozi-0.1.0-map-guidance-v34-arm64-test-signed.apk` |
| 安装 | `Success` |
| ABI | `lib/arm64-v8a/libjingong_xiaozi_lib.so` |
| 签名 | apksigner v2/v3 pass |

操作链路覆盖：

1. 构建 arm64 APK。
2. zipalign 对齐并用测试证书签名。
3. `adb install -r` 安装。
4. 启动应用。
5. 确认待机页纯表情、左侧抽屉和地图 FAB。
6. 点击地图 FAB。
7. 打开调试面板，触发 `MapDirect: 去 104 二层`。
8. 打开路线面板，确认 1/8 当前导引完整显示。
9. 点击下一步，确认导引推进到 2/8。
10. 打开视角面板，确认旋转、缩放、平移、复位和 2D 正交入口。
11. 切换 2D 正交和爆炸分层。
12. 重签名包后再次安装并冷启动。

## 2026-05-31 移动端基准

来源：`docs/releases/2026-05-31-precision-mobile.md`

| 项 | 记录 |
| --- | --- |
| APK | `build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk` |
| SHA-256 | `3fa9867330731d1ebb1d5255838215eae671c54a8ffc5c4cf468e1d61f79a37f` |
| 签名 | `CN=Jingong Xiaozi Test, O=ZJU, C=CN` |
| unsigned SHA-256 | `893dc225beaa157d05bde703556f72fb2d1651a098c245e7c17720f07054b4d9` |
| ABI | `arm64-v8a` |

发布前需要通过：

```bash
npm run check:miniprogram
npm run check:map
npm run build
npm run tauri -- android build --apk --target aarch64 --ci
```

附加校验：

```bash
zipalign -c -p 4 build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
apksigner verify --verbose --print-certs build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
unzip -l build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk | rg 'lib/.+\\.so'
shasum -a 256 build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk
```

## H5 证据

| 场景 | 路径 |
| --- | --- |
| 地图总览 | `../assets/evidence/h5-map-overview.png` |
| 208 路线 | `../assets/evidence/h5-route-208.png` |
| 图层面板 | `../assets/evidence/h5-layers-panel.png` |
| 202 路线对照 | `qa/screenshots/miniprogram-parity/h5-current-route-202-844x390.png` |
| 104 路线对照 | `qa/screenshots/miniprogram-parity/h5-current-route-104-844x390.png` |
| 108 路线对照 | `qa/screenshots/miniprogram-parity/h5-current-route-108-844x390.png` |
| 208 路线对照 | `qa/screenshots/miniprogram-parity/h5-current-route-208-844x390.png` |

## 小程序验证

来源：`docs/miniprogram-three-parity.md`

当前工程结论：

| 项 | 状态 |
| --- | --- |
| `check:miniprogram` | 用于检查小程序壳和自包含结构 |
| `check:miniprogram:parity` | 真实 Three parity 完成前应保持失败或阻塞 |
| `check:miniprogram:release` | 缺 AppID、缺 HTTPS 域名或缺 Three parity 时必须失败 |
| 发布目标 | 微信 `canvas type="webgl"` + Three 适配层 + 包内模型 |
| 禁止发布路线 | WebView、localhost、`5173`、公网临时 H5、全图 PNG 贴图、自绘多边形冒充一致 |

小程序过程截图：

| 场景 | 路径 |
| --- | --- |
| 首页 | `../assets/evidence/miniprogram-home-devtools.png` |
| 208 路线 | `../assets/evidence/miniprogram-route-208.png` |
| H5 golden | `../assets/evidence/h5-miniprogram-baseline-route-208.png` |
| 过程板 | `../assets/evidence/process/miniprogram-parity-iteration-strip.png` |

小程序不能凭单张截图验收。发布前必须满足：

1. 真实 AppID。
2. 真实发布配置。
3. 不依赖 localhost 或 `5173`。
4. 不使用全图 PNG / 截图贴图冒充地图。
5. Three 场景与移动端 golden 对照通过。
6. 触控旋转、缩放、平移、回正、图层和路线均可用。

## 剩余风险

| 风险 | 当前处理 |
| --- | --- |
| 真实机器人传感器 | Android 模拟器无法验证真实方向传感器，设备集成阶段验证 |
| 小程序 Three parity | 继续用移动端 golden 约束，不把旧自绘路线作为发布目标 |
| Vite 大 chunk | 当前可构建，后续按地图模块拆包 |
| 真实后端音频链路 | 前端契约已稳定，待后端接入后做端到端测试 |
| 模型语义自动识别 | 当前采用人工语义拓扑，后续用 CAD/SKP 逐步提高门洞来源可信度 |
