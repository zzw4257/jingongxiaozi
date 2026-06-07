# 金工小子 2026-06-07 地图结构发布节点

本节点记录 2026-06-07 的移动端 H5/Tauri 地图结构收敛结果，并作为同步到 GitHub `zzw4257/jingongxiaozi` 的发布锚点。

## 发布摘要

- 二层单层视图新增区域语义层：`108 独立二层`、`公共二层走廊`、`104 二层`、`106 二层`、`202 平台`。
- 分层路线视图继续避免在人工 XZ 偏移之间绘制假楼梯实体，跨层关系用上下口配对和路线 portal 表达。
- 导航态降低非路线空间、非路线墙线、非路线房间的视觉权重，让当前段、门、楼梯口和终点保持主视觉。
- URL 直接进入二层或 202 平台时会套用对应聚焦视角，避免入口状态与按钮状态不一致。
- README 首屏补充品牌 hero 和真实横屏地图截图，作为发布仓库入口。

## 当前核心截图

| 场景 | 路径 |
| --- | --- |
| 全楼总览 | `docs/assets/readme/map-overview.png` |
| 二层单层 | `docs/assets/readme/map-single-2f.png` |
| 202 平台 | `docs/assets/readme/map-raised202.png` |
| 202-5 路线 | `docs/assets/readme/map-route-202.png` |

这些 README 截图来自 844x390 Playwright 横屏验证，不是生成图。`docs/assets/readme/readme-hero.png` 是 README 品牌概念图，不作为产品界面证据。

## 验证结果

本节点已通过：

```bash
npm run check:map
npm run check:miniprogram
npm run check:miniprogram:parity
npm run build
cd src-tauri && cargo check
npm run tauri -- android build --apk --target aarch64 --ci
```

`npm run check:map` 输出确认：

- `53 rooms`
- `53 door segments`
- `80 spaces`
- `16 centerlines`
- `4 stair portals`
- 模型资产主源 `47 meshes / 5000 vertices`
- 对齐控制点 `16`
- `max error 0.000`
- `avg error 0.000`
- `53 doorways`

Playwright 横屏截图覆盖：

- `qa/screenshots/zone-pass-v2-single-2f-844x390.png`
- `qa/screenshots/zone-pass-v2-route-104-844x390.png`
- `qa/screenshots/zone-pass-v2-route-108-844x390.png`
- `qa/screenshots/zone-pass-v2-route-202-844x390.png`
- `qa/screenshots/zone-pass-default-844x390.png`
- `qa/screenshots/zone-pass-raised202-844x390.png`

浏览器控制台检查：0 errors / 0 warnings。

## Android APK

本节点生成并签名了 arm64 测试 APK：

```text
build/android-release/jingong-xiaozi-v0.1.0-map-structure-20260607-arm64.apk
```

验证结果：

```text
SHA-256: c2cb42f6909459da6cc542f0824386c595610d5a0bb358a6aa2ae681013f0306
Unsigned SHA-256: deb7374bf8b1208a79270272bab48e621b9cc1ba7ae2c359bbae37ef085005fd
Signer: CN=Jingong Xiaozi Test, O=ZJU, C=CN
APK signature: v2 true, v3 true
Native ABI: lib/arm64-v8a/libjingong_xiaozi_lib.so
```

## 仍需发布前复核

完整发布前建议继续跑：

```bash
npm run check:map
npm run check:miniprogram
npm run check:miniprogram:parity
npm run build
```

微信小程序正式发布还需要真实 AppID：

```bash
npm run check:miniprogram:release
```

本节点该命令按预期失败，错误为：

```text
release check requires a real WeChat AppID in miniprogram/project.config.json
```

这是正式小程序上传前的配置阻塞，不是地图或小程序页面代码失败。

## GitHub Release 资产策略

源代码仓库不提交 APK、临时截图目录、Chrome profile cache 或本地签名密钥。APK 通过 GitHub Release 上传。

推荐 release tag：

```text
v0.1.0-map-structure-20260607
```

推荐 release 标题：

```text
金工小子 v0.1.0 - 2026-06-07 地图结构收敛版
```

## 回撤提醒

- 不要删除二层区域语义层，除非有更完整的模型语义替代方案。
- 不要在分层视图重新画跨人工偏移的楼梯实体。
- 小程序同步应复用同一份地图语义和路线策略，不能回退到 WebView、localhost 或全图 PNG 贴图方案。
