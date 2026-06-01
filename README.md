# 金工小子

Rust + Tauri + React 的机器人头顶展示应用首版框架。当前重点是可独立使用、也可被后端带参数打开的金工中心地图子应用。

## 开发命令

```bash
npm install
npm run dev
npm run check:map
npm run build
cd src-tauri && cargo check
```

## Android arm64 测试包

```bash
npm run tauri -- android build --apk --target aarch64 --ci

cp src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk \
  build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64-unsigned.apk

/Users/zzw4257/Library/Android/sdk/build-tools/36.0.0/zipalign -f -p 4 \
  build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64-unsigned.apk \
  build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64-aligned.apk

/Users/zzw4257/Library/Android/sdk/build-tools/36.0.0/apksigner sign \
  --ks build/android-release/jingong-xiaozi-v29-test-release.jks \
  --ks-key-alias jingong-v29 \
  --ks-pass pass:jingong-v29-test \
  --key-pass pass:jingong-v29-test \
  --out build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64.apk \
  build/android-release/jingong-xiaozi-2026-05-31-precision-mobile-arm64-aligned.apk
```

2026-05-31 存档见 `docs/releases/2026-05-31-precision-mobile.md`。构建产物、截图和校准 JSON 默认不入库。

## 微信小程序版

小程序位于 `miniprogram/`，是自包含包内版本，不依赖 WebView、本地开发服务或外部 H5 页面。当前地图发布基线来自 2026-05-31 最新移动端/网页端截图资产；不要使用历史坏版截图或旧 SVG 手绘图覆盖这些 PNG。

```bash
npm run check:miniprogram
```

## 后端接入

后端指令、`MapDirect`、音频状态和 URL 调试入口见 `docs/backend-integration-contract.md`。
