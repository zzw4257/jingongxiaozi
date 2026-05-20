# 金工小子

Rust + Tauri + React 的机器人头顶展示应用首版框架。当前重点是可独立使用、也可被后端带参数打开的金工中心地图子应用。

## 开发命令

```bash
npm install
npm run dev
npm run build
npm run check:map
cd src-tauri && cargo check
```

Android 端后续在本机 Android SDK/NDK 就绪后执行：

```bash
npm run tauri android init
npm run tauri android dev
```
