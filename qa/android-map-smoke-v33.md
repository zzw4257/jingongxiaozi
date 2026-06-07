# Android 地图烟测记录 v33

日期：2026-05-24

## 目标

验证本轮针对地图主视觉的修复：正常 UI 不再常驻技术说明；楼梯从线条升级为实体踏步、平台、栏杆；地板/走廊/202 平台降低误导性浮片感；导航端点和当前位置在 Android 横屏上足够醒目。

## 设备与包体

- 设备：`emulator-5554`
- 型号：`sdk_gphone64_arm64`
- 应用截图尺寸：`2400x1080`
- 包名：`cn.edu.zju.jingongxiaozi`
- APK：`build/android-release/jingong-xiaozi-0.1.0-map-calibrated-v33-arm64-test-signed.apk`
- 安装结果：`Success`
- ABI 验证：APK 内仅包含 `lib/arm64-v8a/libjingong_xiaozi_lib.so`
- 签名验证：`apksigner verify --verbose --print-certs` 通过 v2/v3

## 自动校验

- `npm run check:map`：通过
  - `Map data verified: 53 rooms, 53 door segments, 71 spaces, 16 centerlines.`
  - `Route constraints verified by live route calculation.`
  - `Model assets verified: primary 47 meshes / 5000 vertices, fallback 1 mesh / 3591 vertices.`
  - `Alignment verified: 16 control points, max error 0.000, avg error 0.000, 53 doorways.`
  - `Map QA report generated: 53 rooms, 53 doors, 4 stairs, 16 centerlines.`
- `npm run build`：通过，仍有 Vite chunk size warning。
- `cd src-tauri && cargo check`：通过。
- `npm run tauri -- android build --apk --target aarch64 --ci`：通过。

## 截图证据

- Web 横屏默认地图：`qa/screenshots/web-v33-default-clean-floor.png`
- Web 横屏 104 路线：`qa/screenshots/web-v33-route-104-clean-stair.png`
- Android 待机页：`qa/screenshots/android-v33-standby.png`
- Android 默认地图：`qa/screenshots/android-v33-map-default.png`
- Android 调试面板：`qa/screenshots/android-v33-debug-panel.png`
- Android 104 路线：`qa/screenshots/android-v33-route-104.png`
- Android 202 路线：`qa/screenshots/android-v33-route-202.png`

## 操作链路

1. 安装 v33 arm64 APK：`adb install -r build/android-release/jingong-xiaozi-0.1.0-map-calibrated-v33-arm64-test-signed.apk`
2. 启动应用：`adb shell monkey -p cn.edu.zju.jingongxiaozi 1`
3. 截图待机页，确认默认没有多余文字和大按钮。
4. 点击右下地图 FAB，截图默认地图。
5. 点击右侧调试按钮，确认技术状态仅在调试抽屉内显示。
6. 点击 `MapDirect: 去 104 二层`，截图 104 路线。
7. 再触发 `MapDirect: 108 到 202-5`，截图 202 二层半路线。

## 判读

- 待机页保持纯表情展示，只保留左侧抽屉手柄和右下地图 FAB。
- 默认地图主画面没有 `3D 精确模型`、`物理对齐` 等技术说明 chip；这些信息只在调试面板内出现。
- 默认全楼视图以真实模型墙体/地板为主，语义房间面降噪，不再大面积彩色铺满。
- `101 -> 104-2F01` 路线中，当前位置用绿色立柱、光环、标签突出；终点用红色高针和红色标签突出。
- 楼梯已经显示为踏步、上下平台、栏杆/侧梁组合；路线经过楼梯时叠加橙色导引，不再只是斜线或管线。
- `108 -> 202-5` 路线才显示 202 二层半平台，避免无关路线里把 202 平台当成漂浮地板抢视觉。

## 当前结论

v33 包体通过构建、签名、安装和 Android 模拟器视觉烟测。本轮没有改变旧版演示地图入口，也没有改变后端 `MapDirect` 调用形状；主要改动限定在 3D 地图表现层和路线端点表达。
