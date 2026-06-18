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
| `npm run check:backend` | DuplexKit typecheck、测试和导航进度 smoke |
| `npm run check:fullstack:contracts` | 后端远端、锁定提交、工具声明和发布脚本一致性 |
| `npm run check:fullstack:release` | 串联地图、小程序、H5 构建、后端和小程序发布门禁 |

## 2026-06-18 收尾全栈门禁

本次文档收尾前在干净 worktree 执行：

```bash
npm run check:fullstack:release
```

结果：

| 检查项 | 结果 |
| --- | --- |
| DuplexKit remote | `https://github.com/ElysiaFollower/DuplexKit.git` |
| DuplexKit HEAD | `167b6a8861666b63c3bdcbf91567ef12fac5e7fd` |
| 后端版本锁定 | pass |
| 工具声明 | `map.open`、`navigation.start`、`navigation.next`、`navigation.previous`、`navigation.status` |
| 地图数据 | 53 rooms、53 doors、80 spaces、16 centerlines |
| 几何闭合 | 80 spaces、53 valid doors、4 stair portals |
| 模型资产 | 主模型 47 meshes / 5000 vertices，fallback 1 mesh / 3591 vertices |
| 模型对齐 | 16 control points，max error 0.000，avg error 0.000 |
| DuplexKit 房间目录 | 53 rooms，5 access rules |
| 小程序壳 | pass |
| 小程序后端 bridge | pass |
| 小程序 parity | pass |
| 小程序 release gate | pass |
| H5 构建 | pass |
| DuplexKit typecheck | pass |
| DuplexKit tests | 6 files / 49 tests passed |
| 导航进度 smoke | pass，当前段 `101 门口 -> 走廊入口` |

本次补充 H5 横屏截图：待机、聆听、对话、专家、地图总览、202-5、104-2F01、208，并合成为 `final-terminal-state-strip.png` 和 `final-map-route-strip.png`。

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

> v36 是 Android 构建节点记录，保留其历史数值。当前 main 的 `check:map` 已更新为 80 spaces 且模型对齐误差 max/avg 0.000。

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
| 终端最终状态拼图 | `../assets/evidence/process/final-terminal-state-strip.png` |
| 地图路线最终状态拼图 | `../assets/evidence/process/final-map-route-strip.png` |

## 小程序验证

来源：`docs/miniprogram-three-parity.md`

当前工程结论：

| 项 | 状态 |
| --- | --- |
| `check:miniprogram` | 当前通过，用于检查小程序壳、自包含结构、入口和 MapDirect |
| `check:miniprogram:parity` | 当前通过，用于阻止小程序与移动端地图语义分叉 |
| `check:miniprogram:release` | 当前通过，校验 AppID、发布配置和正式限制 |
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

1. 真实 AppID：当前为 `wx160ad5f2d6c16281`。
2. 真实发布配置。
3. 不依赖 localhost 或 `5173`。
4. 不使用全图 PNG / 截图贴图冒充地图。
5. Three 场景与移动端 golden 对照通过。
6. 触控旋转、缩放、平移、回正、图层和路线均可用。
7. 起终点选择不局限于固定 demo，53 个房间全量组合路径覆盖通过。

## 剩余风险

| 风险 | 当前处理 |
| --- | --- |
| 真实机器人传感器 | Android 模拟器无法验证真实方向传感器，设备集成阶段验证 |
| 小程序 Three parity | 已通过发布级门禁；继续用移动端 golden 防止回退 |
| Vite 大 chunk | 当前可构建，后续按地图模块拆包 |
| 真实后端音频链路 | DuplexKit 契约、工具声明和导航进度 smoke 已通过；真机麦克风、扬声器和传感器仍需设备阶段验证 |
| 模型语义自动识别 | 当前采用人工语义拓扑，后续用 CAD/SKP 逐步提高门洞来源可信度 |
