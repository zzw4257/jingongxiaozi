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
  build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-unsigned.apk

/Users/zzw4257/Library/Android/sdk/build-tools/36.0.0/zipalign -f -p 4 \
  build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-unsigned.apk \
  build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-aligned.apk

/Users/zzw4257/Library/Android/sdk/build-tools/36.0.0/apksigner sign \
  --ks build/android-release/jingong-xiaozi-v29-test-release.jks \
  --ks-key-alias jingong-v29 \
  --ks-pass pass:jingong-v29-test \
  --key-pass pass:jingong-v29-test \
  --out build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-test-signed.apk \
  build/android-release/jingong-xiaozi-0.1.0-map-guidance-v34-arm64-aligned.apk
```

本地 Android 烟测记录见 `qa/android-map-smoke-v34.md`。构建产物、截图和校准 JSON 默认不入库。
