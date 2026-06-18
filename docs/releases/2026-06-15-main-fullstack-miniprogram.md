# 金工小子 2026-06-15 main 全栈与小程序收敛发布

本发布记录用于标记 `main` 第一次同时吸收最新全栈移动端线和全栈微信小程序线。发布目标不是新增一套视觉解释，而是把已验证的 H5/Tauri 地图、小程序包内 WebGL 地图、DuplexKit 后端契约和发布门禁收敛到同一条主线。

## 合并范围

- 移动端：保留当前 3D 闭合空间地图、动态标签、门/走廊/楼梯分段导航、202 二层半、方向校准反馈和后端 directive 接入。
- 微信小程序：保留自包含 `canvas type="webgl"` + `three-platformize` 地图分包，包内 GLB、纹理、路线数据和后端 bridge；禁止回退到 WebView、localhost、`5173` 或整图 PNG 贴图。
- 后端：保留 `vendor/DuplexKit` 子模块，并锁定到 `167b6a8861666b63c3bdcbf91567ef12fac5e7fd`。
- 文档：README 中英文分离，发布说明、后端锁定文件、小程序 release gate 和设计报告附录同步进入 main。

## 后端锁定

- 仓库：`https://github.com/ElysiaFollower/DuplexKit.git`
- 分支：`main`
- 提交：`167b6a8861666b63c3bdcbf91567ef12fac5e7fd`
- 标题：`Ground navigation answers in app progress facts`

该提交是 `7120265638c76685435da3d46403673097eb85cf` 的后续提交，用于进一步约束导航回答必须基于应用端回传的进度事实。

## 发布门禁

主线发布前必须通过：

```bash
npm run build:miniprogram:vendor
npm run check:fullstack:release
```

可选真机/打包门禁：

```bash
cd src-tauri && cargo check
npm run tauri -- android build --apk --target aarch64 --ci
```

## 历史卫生

本次 main 合并不保留历史临时目录、浏览器 profile、旧 APK、`tmp/` 调试截图、`build/android-test/` 或 `output/` 产物。小程序运行资产只保留发布所需的 GLB、纹理、地图数据和 vendor runtime。

## 发布标签

建议标签：

```text
v0.2.1-main-fullstack-miniprogram-20260615
```
