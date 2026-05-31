# 金工小子后端接入契约

本文档定义后端接入当前前端应用的最小稳定接口。前端负责展示和触控交互，后端负责麦克风、唤醒过滤、意图识别、问答、专家检索、TTS 和扬声器输出。

## 总原则

- 后端一次只下发一条明确指令，不让前端猜测语音意图。
- `wake / listening / processing` 仍然显示在待机页，只表示后端音频链路状态。
- 普通问答进入 `chat`，专家检索进入 `expert`，导航进入 `map`。
- 地图指令只是“打开地图并预填状态”，用户进入地图后仍可改起点、终点、图层、视角或清除路线。
- 若后端还在轮询或等待完整语音，不要提前打开地图；只发送 `listening` 或 `processing`。

## 运行时入口

前端在浏览器/Tauri WebView 中暴露两个等价入口：

```js
window.jingongApplyDirective({
  type: "map",
  request: {
    targetRoomId: "202-5",
    announce: ["summary", "distance", "direction", "floorChange"]
  }
});
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
);
```

调试或小程序 WebView 入口也可通过 URL 预填地图：

```text
/?mode=map&targetRoomId=202-5&announce=summary,distance,direction,floorChange
/?mode=map&startRoomId=108-lobby&targetRoomId=104-2F01&announce=summary,distance
```

## 指令类型

当前 TypeScript 权威定义在 `src/shared/appTypes.ts`。

```ts
type BackendDirective =
  | { type: "idle"; emotion?: string }
  | { type: "wake"; level?: number; hint?: string }
  | { type: "listening"; hint?: string; level?: number }
  | { type: "processing"; hint?: string }
  | { type: "chat"; answer: string; keywords?: string[]; audio?: Partial<AudioChainState> }
  | { type: "expert"; answer: string; citations?: Citation[]; keywords?: string[]; audio?: Partial<AudioChainState> }
  | { type: "map"; request: MapDirectRequest; audio?: Partial<AudioChainState> };
```

### idle

回到纯待机表情。

```json
{ "type": "idle", "emotion": "neutral" }
```

### wake

后端检测到近场有效声音，但尚未进入完整意图处理。

```json
{ "type": "wake", "level": 0.82, "hint": "检测到近场声音" }
```

### listening

后端正在聆听完整请求。前端不显示输入框。

```json
{ "type": "listening", "level": 0.64, "hint": "我在听，请说出需求" }
```

### processing

后端已收集语音，正在判断是问答、专家检索还是地图导航。

```json
{ "type": "processing", "hint": "正在理解你的需求" }
```

### chat

普通对话结果。前端突出展示回答和核心词，音频播放仍由后端负责。

```json
{
  "type": "chat",
  "answer": "工程训练中心提供 CAD/CAM、3D 打印、焊接、数控加工等实践训练能力。",
  "keywords": ["CAD/CAM", "3D 打印", "数控加工"]
}
```

### expert

专家检索结果。引用信息由后端给出，前端只展示摘要和引用卡片。

```json
{
  "type": "expert",
  "answer": "数控加工课程通常围绕数铣、数车、WEDM 等设备展开。",
  "keywords": ["数控加工", "安全规范"],
  "citations": [
    {
      "title": "工程训练课程资料",
      "source": "retrieval://course-handbook",
      "excerpt": "课程包含设备安全、工艺文件和加工实践。"
    }
  ]
}
```

### map

地图导航。后端可只给终点；起点缺省时，前端需要路线才使用机器人默认房间 `101`。

```ts
type MapDirectRequest = {
  startRoomId?: string;
  targetRoomId?: string;
  announce?: Array<"summary" | "distance" | "direction" | "floorChange">;
};
```

```json
{
  "type": "map",
  "request": {
    "targetRoomId": "202-5",
    "announce": ["summary", "distance", "direction", "floorChange"]
  }
}
```

## 音频状态

后端可以附带 `audio` 字段用于前端状态显示，但真实录音、识别、TTS、播报都由后端控制。

```ts
type AudioChainState = {
  input: "idle" | "wake" | "listening" | "processing";
  output: "idle" | "speaking";
  source: "none" | "touch" | "backend" | "mock";
  level?: number;
  message?: string;
};
```

建议：

- 唤醒用 `wake`。
- 正在听用 `listening`。
- ASR 完成、LLM/检索处理中用 `processing`。
- 正在播报问答或专家结果用 `output: "speaking"`。

## 房间与导航约束

后端只需要给 `roomId`，不要传几何坐标。当前关键目标：

- `101`：默认起点。
- `104-2F01`：104 内部二层空间，必须经 104 内部楼梯。
- `106-2F`：106 内部二层空间，必须经 106 内部楼梯。
- `108-2F04`：108 内部二层空间，必须经 108 内部楼梯。
- `202-5`：202 二层半平台目标，走公共楼梯和 202 平台连通关系。
- `208` / `210`：二层公共区域房间。

后端不得假设公共楼梯能直达 `104 / 106 / 108` 独立二层。路线拓扑由前端地图服务计算。

## 后端服务建议

首轮可以让后端本地服务启动在随机端口，但前端接入层应固定成一个很小的适配器：

1. 后端完成麦克风过滤和意图识别。
2. 后端生成 `BackendDirective`。
3. 适配器把指令注入到 WebView：
   - Tauri 内可调用 WebView eval。
   - H5 调试可用浏览器控制台或 mock panel。
   - 小程序 WebView 用 URL 参数打开地图；复杂状态以后通过 `postMessage` 扩展。
4. 前端收到指令后只切换展示状态，不反向控制后端音频链路。

## 接入验收

后端接入后至少验证：

- `wake -> listening -> processing -> chat` 能完整显示普通问答。
- `wake -> listening -> processing -> expert` 能显示专家答案和引用。
- `map` 指令可打开 `202-5` 路线，且用户能继续手动改目标。
- `104-2F01` 和 `108-2F04` 路线不走公共楼梯直达独立二层。
- 后端不发送任何指令时，前端保持纯待机表情展示。
