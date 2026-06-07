# Android 地图烟测记录 v30

日期：2026-05-23

## 目标

验证 `3D 精确模型地图` 在 Android arm64 模拟器上的真实可启动、可进入、可操作、可截图状态，并记录可复查证据。

## 设备与包体

- 设备：`emulator-5554`
- 型号：`sdk_gphone64_arm64`
- `adb shell wm size`：`1080x2400`
- 应用横屏截图尺寸：`2400x1080`
- 包名：`cn.edu.zju.jingongxiaozi`
- APK：`build/android-release/jingong-xiaozi-0.1.0-map-calibrated-v30-arm64-test-signed.apk`
- 安装命令：`adb -s emulator-5554 install -r build/android-release/jingong-xiaozi-0.1.0-map-calibrated-v30-arm64-test-signed.apk`
- 安装结果：`Success`
- `dumpsys package` 更新时间：`2026-05-23 00:43:05`
- 签名验证：`apksigner verify --verbose --print-certs` 通过 v2/v3
- ABI 验证：APK 内仅包含 `lib/arm64-v8a/libjingong_xiaozi_lib.so`

## 实际操作链路

1. 启动应用：
   `adb -s emulator-5554 shell monkey -p cn.edu.zju.jingongxiaozi -c android.intent.category.LAUNCHER 1`
2. 首张截图过早，捕获到启动空白窗：
   `qa/screenshots/android-v30-reinstall-01-launch.png`
3. 等待约 3 秒后截图，进入待机页：
   `qa/screenshots/android-v30-reinstall-02-after-wait.png`
4. 点击右下地图 FAB：
   `adb -s emulator-5554 shell input tap 2295 975`
5. 等待约 4 秒后截图，进入 3D 地图默认态：
   `qa/screenshots/android-v30-reinstall-03-map-default.png`
6. 点击右侧调试按钮：
   `adb -s emulator-5554 shell input tap 2270 965`
7. 截图确认新版调试面板：
   `qa/screenshots/android-v30-reinstall-04-debug-panel.png`
8. 点击 `MapDirect: 去 104 二层`：
   `adb -s emulator-5554 shell input tap 1180 545`
9. 截图确认 Android 端路线叠加：
   `qa/screenshots/android-v30-reinstall-05-mapdirect-104.png`

## 截图判读

- `android-v30-reinstall-02-after-wait.png`：待机页显示机器人表情、左侧抽屉入口、右下地图入口，说明启动后的默认页可用。
- `android-v30-reinstall-03-map-default.png`：地图默认页加载 3D 模型，显示 202 半层、走廊中心线说明、右侧 Material 操作栏。
- `android-v30-reinstall-04-debug-panel.png`：调试面板显示新版校准统计：`GLB 47 mesh`、`16` 个校准点、`53` 个门洞、`71` 个空间，证明最新包已经安装并运行。
- `android-v30-reinstall-05-mapdirect-104.png`：`MapDirect` 路线实际出现在 Android 端，显示 `101 -> 104-2F01`，目标侧标注 `104 内梯`，证明 104 二层路线没有退回到公共楼梯直达。

## 当前已知问题

- 启动后立即截图会捕获到短暂白屏，应在启动后等待渲染完成再做视觉判断。
- 本轮是 adb 坐标点按烟测，不等同于完整多指手势自动化；旋转、缩放、平移仍需要持续补充 Android 手势回归记录。
- `qa:mobile` 脚本当前依赖未安装的 Playwright 包，本轮没有声明它通过；移动端网页视口检查使用 Codex Playwright MCP，Android 端使用 adb 截图。
