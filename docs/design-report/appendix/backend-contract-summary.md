# 后端接口约束摘要

## 接入边界

前端负责展示和触控交互。后端负责麦克风、唤醒过滤、语音识别、意图识别、问答生成、专家检索、TTS 和扬声器输出。前端收到后端指令后切换状态，地图子应用继续保持人工可操作能力。

## 应用状态

| 指令 | 展示状态 | 说明 |
| --- | --- | --- |
| `idle` | 待机 | 回到表情展示 |
| `wake` | 聆听准备 | 检测到近场声音 |
| `listening` | 聆听中 | 等待完整语音请求 |
| `processing` | 理解中 | 后端判断问答、专家或地图 |
| `chat` | 常态对话 | 展示普通回答、关键词和音频状态 |
| `expert` | 专家问答 | 展示检索答案、关键词和引用 |
| `map` | 地图导航 | 打开地图并预填导航状态 |

## 稳定接口

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

浏览器和 Tauri WebView 暴露两个等价入口：

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
      answer: "工程训练中心提供数控加工、焊接、3D 打印等实践训练能力。",
      keywords: ["工程训练", "数控加工", "3D 打印"]
    }
  })
)
```

## 地图参数

| 参数 | 说明 |
| --- | --- |
| `startRoomId` | 起点房间 ID，缺省时需要路线才使用默认起点 `101` |
| `targetRoomId` | 终点房间 ID，可由语音意图或小程序入口提供 |
| `announce` | 默认播报项，支持摘要、距离、方向和跨层信息 |

后端只传房间 ID，不传坐标。路线由前端地图拓扑服务计算。

## 音频状态

```ts
type AudioChainState = {
  input: "idle" | "wake" | "listening" | "processing"
  output: "idle" | "speaking"
  source: "none" | "touch" | "backend" | "mock"
  level?: number
  message?: string
}
```

音频状态用于前端展示，不承载真实录音和播放控制。后端播放 TTS 时可设置 `output: "speaking"`。

## 接入验收

| 场景 | 验收点 |
| --- | --- |
| 普通问答 | `wake -> listening -> processing -> chat` 连续展示 |
| 专家检索 | `wake -> listening -> processing -> expert` 展示引用卡片 |
| 地图导航 | `map` 指令打开 `202-5` 路线并允许人工继续操作 |
| 独立二层 | `104-2F01` 和 `108-2F04` 不走公共楼梯直达 |
| 静默状态 | 后端不发指令时保持纯待机表情 |

