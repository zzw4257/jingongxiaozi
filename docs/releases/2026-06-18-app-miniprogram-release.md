# 金工小子 2026-06-18 应用与小程序发布

本记录对应主文档收尾后的应用发布节点。目标是把当前 `main` 的移动端应用安装到真机，同时把最新微信小程序上传到微信开发者工具后台，并将 APK 产物提交到 GitHub Release。

## 版本信息

| 项 | 内容 |
| --- | --- |
| Git commit | `50cb1e27b0ada2fe8e4564a7512f6597dd8b6741` |
| 小程序 AppID | `wx160ad5f2d6c16281` |
| 小程序上传版本 | `0.2.2` |
| Android 包名 | `cn.edu.zju.jingongxiaozi` |
| Android 版本 | `0.1.0` / `versionCode=1000` |

## Android APK

构建命令：

```bash
npm run tauri -- android build --apk --target aarch64 --ci
```

Tauri 输出：

```text
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
```

本节点生成两个签名包：

| APK | 用途 | SHA-256 |
| --- | --- | --- |
| `build/android-release/jingong-xiaozi-2026-06-18-fullstack-arm64.apk` | release keystore 签名，供发布归档 | `cb7a8666e82530a60b2c3041310f109860979756e92bb6f9389a92c3aa191864` |
| `build/android-release/jingong-xiaozi-2026-06-18-fullstack-arm64-debugsigned.apk` | 与当前真机已装版本签名一致，用于覆盖安装 | `58fc3fbe25f0fb3085da906a38e849d0cd35c9ba261cbf8c40230d647a402d00` |

release 签名证书：

```text
CN=Jingong Xiaozi, OU=Project Practice, O=ZJU, L=Hangzhou, ST=Zhejiang, C=CN
SHA-256: 8470793623af0bf0cd4620efce1bf2acdcd40cea5f44e80026f3a6f0808e6625
```

debug 覆盖安装证书：

```text
CN=Debug, OU=Debug, O=Debug, L=Debug, ST=Debug, C=US
SHA-256: 39367b151dc5f4ede6ab1a6d735956e8b27158930fb141f536c0d36fcf2ea8db
```

真机安装记录：

```text
Device: A4UF6R6317000846
Model: AAK_AN00
Install: adb install -r build/android-release/jingong-xiaozi-2026-06-18-fullstack-arm64-debugsigned.apk
Result: Success
lastUpdateTime: 2026-06-18 11:34:54
Focused activity: cn.edu.zju.jingongxiaozi/.MainActivity
Orientation: SCREEN_ORIENTATION_LANDSCAPE
```

说明：真机上已有同包名调试签名版本，release keystore 签名包会触发 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`。为避免卸载旧包和清除现场调试数据，本次真机覆盖安装使用 debug keystore 重签的同源最新 APK；GitHub Release 同时归档 release 签名包和真机覆盖安装包。

## 微信小程序

发布前同步命令：

```bash
npm run build:miniprogram:vendor
npm run build:miniprogram:glb
npm run sync:miniprogram:map
npm run check:miniprogram:release
```

上传命令：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli upload \
  --project "$PWD/miniprogram" \
  --port 3800 \
  --lang zh \
  --version 0.2.2 \
  --desc "2026-06-18 全栈后端与三维地图收尾版：同步最新移动端地图、小程序 WebGL 分包、后端桥接和主文档。"
```

上传结果：

| 包 | 大小 | Byte |
| --- | --- | --- |
| TOTAL | 2.5 MB | 2656789 |
| main | 1.1 MB | 1153270 |
| `/packages/map/` | 1.4 MB | 1503519 |

微信开发者工具返回：

```text
使用 AppID: wx160ad5f2d6c16281
upload: success
```

## 本节点状态

- 移动端最新 APK 已安装到 USB 真机并启动到前台。
- 小程序 `0.2.2` 已上传到微信开发者工具后台。
- GitHub Release 归档 APK 产物时，以 release 签名包为主，debugsigned 包用于复现实机覆盖安装环境。
