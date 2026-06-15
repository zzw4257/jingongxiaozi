# 金工小子小程序发布门禁

本文记录发布前必须通过的检查，目标是确保小程序与当前移动端地图、导航语义和后端桥接保持一致。

## 本地全栈门禁

在仓库根目录运行：

```bash
npm run check:fullstack
```

该命令覆盖：

- 地图数据、闭合几何、路线约束、模型资产、模型对齐。
- 小程序自包含检查、移动端语义 parity、后端 bridge 协议。
- H5/Tauri Web 构建。
- DuplexKit 后端 typecheck、单测、应用端 WebSocket `navigation_progress` 回显 smoke。

后端 smoke 会自动启动本地服务、发送结构化导航进度、校验 `guidance` / `heading` 字段，然后关闭服务。

## 发布级门禁

填入真实微信小程序 AppID 后运行：

```bash
npm run check:fullstack:release
```

该命令在 `check:fullstack` 基础上额外要求：

- `miniprogram/project.config.json` 包含真实 AppID。
- 小程序不依赖 `localhost`、`127.0.0.1`、`5173`、`web-view` 或全图 PNG 贴图。
- 小程序地图页继续使用包内 Three/WebGL 场景、包内 GLB 模型和共享地图数据。
- 上传包通过 `packOptions.ignore` 排除 `.DS_Store` 和 `assets/ui/generated-icons/` 临时生成源图。
- 1024 源头像只作为微信后台资料和应用图标源，不进入小程序运行包；运行包使用 144px 头像。
- 主包只保留首页、对话、专家和轻量图片资产，必须小于 2MB；地图 Three runtime、GLB、纹理和地图数据必须在 `packages/map` 分包内，单分包必须小于 4MB。这个限制来自微信开发者工具真实 preview 报错 `source size ... exceed max limit 2MB`，不能只看总包 8MB。

## 微信开发者工具验收

启动项目：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open \
  --project "$PWD/miniprogram" \
  --port 3800 \
  --lang zh
```

发布预览：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview \
  --project "$PWD/miniprogram" \
  --port 3800 \
  --compile-condition '{"pathName":"packages/map/pages/map/map","query":"source=miniprogram&ui=mobile&targetRoomId=202-5&announce=summary,distance,direction,floorChange"}'
```

必须人工确认：

- 已登录微信开发者工具。
- 使用真实 AppID，不能是空 AppID 或 tourist 模式。
- 地图页默认总览、104 路线、108 路线、202 路线、208 路线均能渲染 Three 地图。
- 首页-待机入口能显示金工小子表情、地图 FAB、应用抽屉，且不展示调试/占位/mock 文案。
- 触控旋转、缩放、平移、图层切换、路线逐段导引可用。
- 页面没有回退到 WebView、H5 服务、截图贴图或旧 native polygon overlay。

## 后端连接

本地后端桥接检查：

```bash
npm --prefix vendor/DuplexKit run smoke:navigation-progress:local
```

真机联调时：

- 后端监听地址使用局域网可达 IP，例如 `http://<mac-lan-ip>:5188`。
- 小程序端 storage 配置 `duplexkit.backend.host` 和 `duplexkit.backend.port` 后再打开地图页。
- `/api/tools` 必须公开 `navigation.next`、`navigation.previous`、`navigation.status`。
- `navigation_progress` 必须保留 `current`、`next`、`destination`、`guidance`、`heading`。

## 当前已知发布缺口

截至本文创建时，本地代码门禁已可通过，但发布级闭环仍依赖：

- 在 `miniprogram/project.config.json` 填入真实 AppID。
- 微信开发者工具登录成功后重新运行 preview/upload。
