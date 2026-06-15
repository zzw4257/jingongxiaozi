# 后端接口约束摘要

## 职责边界

前端负责展示、地图、触控和状态切换。后端负责麦克风、唤醒过滤、语音识别、意图识别、知识检索、LLM 生成、TTS 和扬声器输出。

| 链路 | 后端职责 | 前端职责 |
| --- | --- | --- |
| 唤醒 | 近场声音检测、唤醒阈值、噪声过滤 | 展示 wake / listening 状态 |
| ASR | 语音转文字、断句、打断识别 | 不显示输入框，只展示聆听反馈 |
| 意图识别 | 判断问答、专家检索、地图导航 | 接收明确 `BackendDirective` |
| 普通问答 | 生成回答、TTS 播放 | 展示回答和关键词 |
| 专家问答 | 检索知识库、生成引用 | 展示答案、关键词和引用卡片 |
| 地图导航 | 解析房间意图、生成 roomId | 打开地图、计算路线、支持手动继续操作 |

前端不反向控制后端音频链路，不持有麦克风，不决定语音意图。

## 应用状态

| 指令 | 展示状态 | 说明 |
| --- | --- | --- |
| `idle` | 待机 | 回到机器人表情展示 |
| `wake` | 唤醒反馈 | 检测到近场有效声音 |
| `listening` | 聆听中 | 等待完整语音请求 |
| `processing` | 理解中 | 后端判断目标任务 |
| `chat` | 常态对话 | 展示普通回答、关键词和播报状态 |
| `expert` | 专家问答 | 展示检索答案、关键词和引用 |
| `map` | 地图导航 | 打开地图并预填导航状态 |

## 稳定类型

权威类型位于 `src/shared/appTypes.ts`。

```ts
type BackendDirective =
  | { type: "idle"; emotion?: string }
  | { type: "wake"; level?: number; hint?: string }
  | { type: "listening"; hint?: string; level?: number }
  | { type: "processing"; hint?: string }
  | { type: "chat"; answer: string; keywords?: string[]; audio?: Partial<AudioChainState> }
  | { type: "expert"; answer: string; citations?: Citation[]; keywords?: string[]; audio?: Partial<AudioChainState> }
  | { type: "map"; request: MapDirectRequest; audio?: Partial<AudioChainState> }
```

```ts
type MapDirectRequest = {
  startRoomId?: string
  targetRoomId?: string
  announce?: Array<"summary" | "distance" | "direction" | "floorChange">
}
```

```ts
type AudioChainState = {
  input: "idle" | "wake" | "listening" | "processing"
  output: "idle" | "speaking"
  source: "none" | "touch" | "backend" | "mock"
  level?: number
  message?: string
}
```

## 注入入口

浏览器和 Tauri WebView 暴露两个等价入口。

```js
window.jingongApplyDirective({
  type: "map",
  request: {
    targetRoomId: "202-5",
    announce: ["summary", "distance", "direction", "floorChange"]
  }
})
```

```js
window.dispatchEvent(
  new CustomEvent("jingong:directive", {
    detail: {
      type: "chat",
      answer: "工程训练中心提供 CAD/CAM、3D 打印、焊接、数控加工等实践训练能力。",
      keywords: ["工程训练", "数控加工", "3D 打印"]
    }
  })
)
```

H5 / 小程序调试参数：

```text
/?mode=map&targetRoomId=202-5&announce=summary,distance,direction,floorChange
/?mode=map&startRoomId=108-lobby&targetRoomId=104-2F01&announce=summary,distance
```

## 地图参数

| 参数 | 说明 |
| --- | --- |
| `startRoomId` | 起点房间 ID，缺省时由前端在需要路线时使用默认起点 `101` |
| `targetRoomId` | 终点房间 ID，可由语音意图、小程序入口或触控选择提供 |
| `announce` | 进入地图时默认展示的播报重点 |

后端只传房间 ID，不传几何坐标。坐标、门洞、走廊、楼梯、路线由前端地图拓扑服务计算。

## 房间 ID 约束

| ID | 说明 |
| --- | --- |
| `101` | 默认起点，CAD/CAM 云设计中心 |
| `104-2F01` | 104 独立二层，必须经 104 内部楼梯 |
| `106-2F` | 106 独立二层，必须经 106 内部楼梯 |
| `108-2F04` | 108 独立二层钳工空间，必须经 108 内部楼梯 |
| `108-lobby` | 108 门厅，常用起点 |
| `202-5` | 202 二层半 3D 打印目标，走公共楼梯和 202 平台 |
| `208` | 二层多媒体教室，接入二层公共走廊 |
| `210` | 二层会议室，接入二层办公走廊 |

后端不得把公共楼梯当成 104 / 106 / 108 独立二层入口。

## 音频状态映射

| 后端事件 | 指令 | 前端显示 |
| --- | --- | --- |
| 近场声音触发 | `wake` | 待机页唤醒表情、音量波动 |
| 用户正在说话 | `listening` | 聆听中提示 |
| ASR 完成并理解中 | `processing` | 理解中提示 |
| 普通回答生成 | `chat` | 对话页答案和关键词 |
| 专家答案生成 | `expert` | 专家页答案、关键词、引用 |
| 地图意图确认 | `map` | 地图页和预填路线 |

## 接入验收

| 场景 | 验收点 |
| --- | --- |
| 普通问答 | `wake -> listening -> processing -> chat` 连续展示，TTS 播放时 `audio.output = speaking` |
| 专家检索 | `wake -> listening -> processing -> expert`，引用卡片存在 |
| 地图导航 | `map` 打开 `202-5`，用户可改起点、终点、图层和视角 |
| 内部楼梯 | `104-2F01` 和 `108-2F04` 路线不走公共楼梯直达 |
| 无后端输入 | 保持纯待机表情展示 |
| 小程序入口 | query 参数和移动端 `MapDirectRequest` 行为一致 |

## 后续接口扩展

| 方向 | 建议 |
| --- | --- |
| 语音打断 | 后端发送 `processing` 或新指令前先停止 TTS，前端只展示状态 |
| 当前位置 | 后续可扩展 `MapProgressUpdate`，由机器人定位或用户点击推进 |
| 方向传感器 | 前端显示方向，后端可提供机器人朝向校准值 |
| 任务动作 | 机器人动作控制保持后端闭环，前端只显示动作状态 |
| 小程序 postMessage | 复杂状态后续通过小程序消息桥同步，不通过 localhost |
