# Android 地图烟测记录 v32

日期：2026-05-23

## 目标

验证 `3D 精确模型地图` 在 Android arm64 模拟器上的最新 v32 包体可安装、可启动、可进入地图、可触控操作，并重点检查本轮修复项：地板/墙体区分、走廊高亮、路线分段、楼梯配对、面板完整性、视角拖拽与复位。

## 设备与包体

- 设备：`emulator-5554`
- 型号：`sdk_gphone64_arm64`
- `adb shell wm size`：`1080x2400`
- 应用横屏截图尺寸：`2400x1080`
- 包名：`cn.edu.zju.jingongxiaozi`
- APK：`build/android-release/jingong-xiaozi-0.1.0-map-calibrated-v32-arm64-test-signed.apk`
- 安装命令：`adb -s emulator-5554 install -r build/android-release/jingong-xiaozi-0.1.0-map-calibrated-v32-arm64-test-signed.apk`
- 安装结果：`Success`
- `dumpsys package`：
  - `primaryCpuAbi=arm64-v8a`
  - `versionName=0.1.0`
  - `lastUpdateTime=2026-05-23 13:14:52`
- 签名验证：`apksigner verify --verbose --print-certs` 通过 v2/v3
- ABI 验证：APK 内仅包含 `lib/arm64-v8a/libjingong_xiaozi_lib.so`

## 自动校验

- `npm run check:map`：通过
  - `Map data verified: 53 rooms, 53 door segments, 71 spaces, 16 centerlines.`
  - `Route constraints verified by live route calculation.`
  - `Model assets verified: primary 47 meshes / 5000 vertices, fallback 1 mesh / 3591 vertices.`
  - `Alignment verified: 16 control points, max error 0.000, avg error 0.000, 53 doorways.`
  - `Map QA report generated: 53 rooms, 53 doors, 4 stairs, 16 centerlines.`
- `npm run build`：通过，仍有 Vite chunk size warning。
- `cd src-tauri && cargo check`：通过。

## 实际操作链路

1. 启动应用：
   `adb -s emulator-5554 shell monkey -p cn.edu.zju.jingongxiaozi -c android.intent.category.LAUNCHER 1`
2. 等待约 3 秒后截图待机页：
   `qa/screenshots/android-v32-01-standby.png`
3. 点击右下地图 FAB：
   `adb -s emulator-5554 shell input tap 2295 975`
4. 等待约 5 秒后截图地图默认态：
   `qa/screenshots/android-v32-02-map-default.png`
5. 点击调试按钮：
   `adb -s emulator-5554 shell input tap 2270 965`
6. 截图调试面板：
   `qa/screenshots/android-v32-03-debug-panel.png`
7. 点击 `MapDirect: 去 104 二层`：
   `adb -s emulator-5554 shell input tap 1160 800`
8. 截图 104 物理对齐路线：
   `qa/screenshots/android-v32-04-route-104.png`
9. 打开图层面板并截图：
   `qa/screenshots/android-v32-05-layers-panel.png`
10. 切到爆炸分层并关闭面板，截图 104 跨层路线：
    `qa/screenshots/android-v32-06-route-104-exploded.png`
11. 打开调试面板，点击 `MapDirect: 108 到 202-5`，截图公共楼梯路线：
    `qa/screenshots/android-v32-07-route-108-to-202.png`
12. 打开视角面板并截图：
    `qa/screenshots/android-v32-08-view-panel.png`
13. 关闭面板后执行两次拖拽：
    - `adb -s emulator-5554 shell input swipe 1100 520 620 735 700`
    - `adb -s emulator-5554 shell input swipe 990 660 1260 420 500`
14. 截图拖拽后的视角：
    `qa/screenshots/android-v32-09-after-drag-rotate.png`
15. 点击总览复位：
    `adb -s emulator-5554 shell input tap 2270 815`
16. 截图复位后状态：
    `qa/screenshots/android-v32-10-after-overview-reset.png`

## 截图判读

- `android-v32-01-standby.png`：待机页只保留机器人表情、左侧抽屉手柄、右下地图 FAB，符合头顶展示屏的默认克制状态。
- `android-v32-02-map-default.png`：默认进入物理对齐全楼模式；地板、墙体、蓝色走廊中心线、房间标签和右侧操作栏均在首屏内。
- `android-v32-03-debug-panel.png`：调试入口默认藏在右侧按钮内；面板完整显示模型、校准点、门洞、空间统计，没有底部半截内容。
- `android-v32-04-route-104.png`：`101 -> 104-2F01` 显示 104 内梯和目标标注；路线没有走公共楼梯直达独立二层。
- `android-v32-05-layers-panel.png`：六个图层选项完整成格显示，包含全楼、一层、二层、202 二层半、爆炸分层、剖切，没有长滚动露半张卡片。
- `android-v32-06-route-104-exploded.png`：爆炸分层下 104 内梯为强橙色，非路线楼梯降饱和；上下层错开关系可见。
- `android-v32-07-route-108-to-202.png`：`108 -> 202-5` 使用公共楼梯进入 202 区域；非路线内部楼梯不显示误导性文字标签。
- `android-v32-08-view-panel.png`：视角面板完整显示透视/正交、总览/低角/俯视/路线、旋转/缩放/平移/复位，不依赖纵向滚动。
- `android-v32-09-after-drag-rotate.png`：拖拽后视角明显改变，证明 Android WebView 触控旋转/平移链路可用。
- `android-v32-10-after-overview-reset.png`：总览复位能把拖拽后的近景拉回可读视角，避免用户迷路。

## 当前结论

- v32 包体可安装、可启动、可进入地图、可触控操作。
- 当前拓扑门禁覆盖 104/106/108 独立二层、公共楼梯、门洞中心、房间中心到门口再走走廊的路线约束。
- 当前模型/示意图校准仍属于语义控制点和运行时 bbox 门禁，不是从 DWG/SKP 自动解析门洞的最终版；后续若拿到更高保真 GLB，应继续用同一门禁替换运行时模型。
