# DuplexKit 全双工语音后端接入说明

## 当前交付形态

本分支用于验证金工小子 Android/Tauri App 与 DuplexKit 后端服务的前后端分离接入。

- App 仓库分支：`full-stack`
- 后端子模块：`vendor/DuplexKit`
- DuplexKit 后端提交：`67a8ba377e3881d959f3a600b515927529f600ca`
- 建议 Release 编号：`v0.0.1-duplex`

App 负责麦克风采集、音频播放、页面展示和地图/导航 UI 动作；DuplexKit 后端负责连接实时语音模型、维护工具调用规则、下发地图/导航工具请求。

## 克隆和初始化

```sh
git clone https://github.com/zzw4257/jingongxiaozi.git
cd jingongxiaozi
git checkout full-stack
git submodule update --init vendor/DuplexKit
```

如果只更新后端子模块：

```sh
git submodule update --remote vendor/DuplexKit
```

## 启动 DuplexKit 后端

```sh
cd vendor/DuplexKit
npm install
npm run build
node dist/server.js
```

后端默认监听 `5177`，App 通过 `ws://<Mac IP>:5177/api/realtime` 连接。手机和 Mac 需要在同一个局域网；在 App 左侧抽屉进入「后端连接」页面后填写 Mac IP 和端口。

DuplexKit 需要本地 `.env` 配置火山实时语音模型凭据。`.env` 不应提交到仓库。

## App 侧入口

左侧抽屉中有「后端连接」页面：

- `Mac IP`：运行 DuplexKit 后端的电脑局域网 IP
- `Port`：默认 `5177`
- `连接后端`：建立 `/api/realtime` WebSocket
- `开始聆听 / 停止聆听`：控制手机麦克风是否向后端持续推流

连接后，其他页面右上角只显示一个小状态图标。短按可回到「后端连接」页面；长按后可拖动位置，松手后位置会保存在本机 WebView localStorage。

## Realtime 协议摘要

- WebSocket：`/api/realtime`
- 上行音频：24kHz mono `pcm_s16le` binary frame
- 下行音频：24kHz mono `pcm_f32le` binary frame
- 下行 JSON：`status`、`transcript`、`assistant_text`、`message_end`、`tool_request` 等
- 上行工具结果：App 执行工具后回传 `tool_result`

当前 App 已接入这些工具：

- `map.open`
- `map.close`
- `map.set_origin`
- `map.set_destination`
- `navigation.start`

## 已验证行为

真机验证已覆盖：

- 全双工语音连接、麦克风推流、后端语音回复播放
- 打开地图、关闭地图
- 设置起点、设置终点、开始导航
- 地图页面保持：普通语音回复不会强行切走地图
- Android/Tauri 默认使用 0607 冻结基准的 3D 精确模型地图；旧版手工地图仅保留为显式演示入口，不能作为真机默认回退
- 后端工具结果注入不再打断官方模型回复音频
- 房间号优先匹配：`208多媒体教室`、`114教室`、`108-2F03教室` 等

## Release 建议

建议在本仓库创建 Release：

- Tag：`v0.0.1-duplex`
- Title：`v0.0.1-duplex`
- Asset：上传已验证的 Android debug APK
- 当前已验证 APK SHA-256：`6238eb806343a06eef9e2308152aa0a90268e2f692c2f241110c0a9d04a43d47`

该 APK 是验证版，不是发布签名包；后续正式交付建议由 App 维护者按项目签名规范重新构建 release 包。
