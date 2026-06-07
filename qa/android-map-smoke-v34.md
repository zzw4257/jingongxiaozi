# Android 地图烟测记录 v34

日期：2026-05-24

## 目标

验证本轮“节点级导引 + Android 横屏触控面板 + 2D/视角控制”的修复：路线不再只给一条抽象线，而是按房间门、走廊、楼梯和终点逐段推进；移动端面板一屏完整显示；Android arm64 包体可安装运行。

## 设备与包体

- 设备：`emulator-5554`
- 型号：`sdk_gphone64_arm64`
- 应用截图尺寸：`2400x1080`
- 包名：`cn.edu.zju.jingongxiaozi`
- APK：`build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-test-signed.apk`
- 安装结果：`Success`
- ABI 验证：APK 内仅包含 `lib/arm64-v8a/libjingong_xiaozi_lib.so`
- 签名验证：`apksigner verify --verbose --print-certs` 通过 v2/v3
- 冷启动：`am start -W -n cn.edu.zju.jingongxiaozi/.MainActivity`，`Status: ok`，`TotalTime: 15409`

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

- Android 待机页：`qa/screenshots/android-v34-standby-after-wait.png`
- Android 默认地图：`qa/screenshots/android-v34-map-default.png`
- Android 调试面板：`qa/screenshots/android-v34-debug-panel.png`
- Android 104 路线地图：`qa/screenshots/android-v34-route-104-map.png`
- Android 路线面板 1/8：`qa/screenshots/android-v34-route-panel.png`
- Android 路线面板 2/8：`qa/screenshots/android-v34-route-panel-step2.png`
- Android 视角面板：`qa/screenshots/android-v34-view-panel.png`
- Android 2D 正交面板态：`qa/screenshots/android-v34-view-2d.png`
- Android 2D 地图本体：`qa/screenshots/android-v34-map-2d-uncovered.png`
- Android 爆炸分层：`qa/screenshots/android-v34-exploded-probe2.png`
- Android 最终重签名包安装后待机页：`qa/screenshots/android-v34-final-installed-standby.png`
- Web 横屏路线面板：`web-v34-route-panel-fixed.png`
- Web 横屏 2D/视角：`web-v34-view-2d.png`

## 操作链路

1. 生成 arm64 APK：`npm run tauri -- android build --apk --target aarch64 --ci`
2. 复制包体到 `build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-unsigned.apk`
3. `zipalign` 对齐并用 `jingong-xiaozi-v29-test-release.jks` 签名。
4. 安装：`adb install -r build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-test-signed.apk`
5. 首次安装后模拟器 System UI 出现 ANR 弹窗；选择 Wait 后仍不稳定，重启模拟器后系统服务恢复。
6. 启动应用，确认待机页纯表情 + 左侧抽屉 + 右下地图 FAB。
7. 点击地图 FAB，确认默认地图首屏可见。
8. 打开调试面板，触发 `MapDirect: 去 104 二层`。
9. 打开路线面板，确认 1/8 当前导引、上一步/下一步、开始导航、清除路线在横屏内完整显示。
10. 点击下一步，确认导引推进到 2/8：`从 101 门口进入走廊`。
11. 打开视角面板，确认朝向校准卡、旋转、缩放、平移和 2D 正交按钮一屏可见。
12. 点击 2D 正交并收起面板，确认俯视地图、路线、走廊、楼梯和标签可见。
13. 打开图层面板，切换爆炸分层，确认楼层高度和跨层关系更明显。
14. 重新生成并签名 v34 arm64 包后再次安装：`adb install -r` 成功。
15. 冷启动最终签名包：`Status: ok`，`LaunchState: COLD`，`TotalTime: 5690`。

## 判读

- 路线状态新增 `guidanceLegs` 和 `routeProgress`，当前段会高亮，非当前段弱化；地图上有当前位置、下一点、终点和楼梯标签。
- 路线面板已经改成节点级导引，不再使用“语义拓扑/3D 模型”之类技术说明作为主 UI 文案。
- `MapDirect` 打开的路线仍可由用户继续操作：打开路线面板、改起终点、清除路线、逐步推进。
- 视角面板提供 Android 触控友好的旋转、缩放、平移、复位、2D 正交和朝向校准入口。
- 爆炸分层继续与物理对齐分离：全楼模式保持上下楼层物理对齐，爆炸模式才拉开层距。

## 剩余风险

- Android 模拟器首次安装启动时出现过 System UI ANR，重启模拟器后恢复；该问题未复现在应用进程崩溃日志中，但会影响自动化测试稳定性。
- 2D 正交目前会切到俯视，但保留当前地图 yaw，视觉上仍是旋转平面；后续应增加专用“2D 正北/正向”相机预设。
- Android 冷启动约 15.4 秒，3D 模型和前端 bundle 后续需要继续做首屏加载优化。
