# 金工小子 2026-06-15 全栈收敛节点

本节点用于锁定小程序地图、移动端共享导航语义与 DuplexKit 后端的集成状态。它不是视觉截图存档，而是发布前的全栈契约记录。

## 后端继承

- 后端仓库：`https://github.com/ElysiaFollower/DuplexKit.git`
- 分支：`main`
- 锁定提交：`167b6a8861666b63c3bdcbf91567ef12fac5e7fd`
- 提交标题：`Ground navigation answers in app progress facts`
- 主仓库锁定文件：`docs/backend-duplexkit-version.json`

主仓库通过 `npm run check:fullstack:contracts` 校验本地 `vendor/DuplexKit` 的远端、分支、HEAD 与锁定文件一致。后端不再是“本地临时目录”，而是可追溯到远端提交的集成依赖。

## 协议边界

后端公开的应用工具必须包含：

- `map.open`
- `map.close`
- `map.set_origin`
- `map.set_destination`
- `navigation.start`
- `navigation.next`
- `navigation.previous`
- `navigation.status`

小程序 bridge 必须能探测 `/api/tools`，连接 `/api/realtime`，发送 `navigation_progress`，并响应后端 `tool_request` 为 `tool_result`。导航问题只能基于前端地图回传的结构化事实回答，不能由后端根据房间名猜距离、时间或下一节点。

## 导航事实

`navigation_progress` 至少承载以下事实：

- 当前节点：`current`
- 下一门、楼梯或转折点：`next`
- 目的地：`destination`
- 当前段引导：`guidance`
- 方向校准反馈：`heading`
- 剩余距离和时间：`remainingMeters` / `remainingSeconds`

这用于支持“下一步/上一步/当前状态”双通道交互：用户可以手动推进，也可以语音说下一步；后端只播报前端确认过的当前段事实。

## 回归范围

当前门禁覆盖：

- `101 -> 104-2F01` 必须经过 104 内部楼梯。
- `101 -> 108-2F04` 必须经过 108 内部楼梯。
- `101 -> 106-2F` 必须经过 106 内部楼梯。
- `108-lobby -> 202-5` 必须经过公共楼梯和 202 平台。
- `101 -> 208` 必须经过公共楼梯，不得误走 104/106/108 内部楼梯。
- 后端房间目录必须和前端地图房间目录一致。

## 验证命令

本节点新增并纳入发布链路：

```bash
npm run check:fullstack:contracts
node scripts/verify-miniprogram-backend-bridge.mjs
node scripts/verify-routes.mjs
```

后端仓库已验证：

```bash
npm --prefix vendor/DuplexKit run typecheck
npm --prefix vendor/DuplexKit test
npm --prefix vendor/DuplexKit run smoke:navigation-progress:local
```

完整发布前继续使用：

```bash
npm run check:fullstack
npm run check:fullstack:release
```

`check:fullstack` 现在会先跑全栈契约门禁，再跑地图、小程序 parity、H5 构建和 DuplexKit 后端验证。

## 发布提醒

- 不要把后端目录当作未版本化的本地副本使用；更新后端必须先提交并推送 DuplexKit，再更新 `docs/backend-duplexkit-version.json`。
- 不要让小程序回退到 WebView、`5173`、全图 PNG 或旧 native polygon overlay。
- 不要让后端直接编造导航距离、时间、下一节点；必须消费 `navigation_progress` 或应用端工具结果。
