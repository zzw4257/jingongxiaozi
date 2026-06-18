# 金工小子后端接入契约

本文档定义后端接入当前应用的稳定接口。前端负责展示、触控、地图路线和导航事实回传；后端负责麦克风、唤醒过滤、意图识别、问答、专家检索、TTS、工具规划和播报。

当前后端以 DuplexKit 子模块接入，锁定到：

| 项 | 内容 |
| --- | --- |
| 仓库 | `https://github.com/ElysiaFollower/DuplexKit.git` |
| 分支 | `main` |
| 提交 | `167b6a8861666b63c3bdcbf91567ef12fac5e7fd` |
| 锁定文件 | `docs/backend-duplexkit-version.json` |

## 总原则

- 后端一次只下发一条明确指令，不让前端猜测语音意图。
- `wake / listening / processing` 仍然显示在待机页，只表示后端音频链路状态。
- 普通问答进入 `chat`，专家检索进入 `expert`，导航进入 `map`。
- 地图指令只是“打开地图并预填状态”，用户进入地图后仍可改起点、终点、图层、视角或清除路线。
- 若后端还在轮询或等待完整语音，不要提前打开地图；只发送 `listening` 或 `processing`。
- 导航过程中的距离、预计时间、当前段和下一节点必须来自应用端 `navigation_progress`，后端不能自行猜测。

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
/?mode=listening&hint=我在听，请说出需求
/?mode=chat
/?mode=expert
/?mode=map&targetRoomId=202-5&announce=summary,distance,direction,floorChange
/?mode=map&startRoomId=108-lobby&targetRoomId=104-2F01&announce=summary,distance
```

`mode=chat / expert / listening / map` 都是稳定 smoke-test 入口。

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

## 应用工具与导航事实

DuplexKit 公开的应用工具至少包括：

| 工具 | 作用 |
| --- | --- |
| `map.open` / `map.close` | 打开或关闭地图 |
| `map.set_origin` / `map.set_destination` | 设置导航起点或终点 |
| `navigation.start` | 启动导航 |
| `navigation.next` / `navigation.previous` | 进入下一段或回退上一段 |
| `navigation.status` | 获取当前段、下一节点和剩余距离 |

前端地图会回传 `navigation_progress`，至少包含：

| 字段 | 说明 |
| --- | --- |
| `activeLegIndex` / `totalLegs` | 当前段序号和总段数 |
| `fromLabel` | 当前节点 |
| `checkpointLabel` | 下一门、楼梯口、转折点或目标 |
| `checkpointKind` | 节点类型 |
| `distanceMeters` | 当前段距离 |
| `remainingMeters` / `remainingSeconds` | 剩余距离和预计时间 |
| `instruction` | 当前段导引 |

后端播报导航时只能使用这些事实。当前 smoke 已验证 `navigation.next` 可推进到下一段，并支持手动与语音两种推进方式。

## 后端服务方式

移动端和 H5 通过 `BackendDirective` 切换展示状态；小程序通过页面 query、包内地图数据和 bridge 接入。小程序不得依赖 localhost、`5173` 或公网临时 H5 服务。

当前发布门禁：

```bash
npm run check:fullstack:contracts
npm run check:backend
npm run check:fullstack:release
```

## 接入验收

后端接入后至少验证：

- `wake -> listening -> processing -> chat` 能完整显示普通问答。
- `wake -> listening -> processing -> expert` 能显示专家答案和引用。
- `map` 指令可打开 `202-5` 路线，且用户能继续手动改目标。
- `104-2F01` 和 `108-2F04` 路线不走公共楼梯直达独立二层。
- 后端不发送任何指令时，前端保持纯待机表情展示。
- `navigation.next`、`navigation.previous`、`navigation.status` 都基于当前路线事实响应。
- 后端房间目录与前端 53 个房间保持一致。
