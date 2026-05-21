import { DEFAULT_AUDIO_STATE } from "../shared/appTypes";
import type { AppState, AudioChainState, BackendDirective } from "../shared/appTypes";

function audioState(patch?: Partial<AudioChainState>): AudioChainState {
  return {
    ...DEFAULT_AUDIO_STATE,
    ...patch,
  };
}

export function applyBackendDirective(directive: BackendDirective): AppState {
  switch (directive.type) {
    case "idle":
      return {
        mode: "standby",
        phase: "idle",
        emotion: directive.emotion ?? "neutral",
        audio: audioState({ source: "backend", message: "待机" }),
      };
    case "wake":
      return {
        mode: "standby",
        phase: "listening",
        emotion: "wake",
        listeningHint: directive.hint ?? "检测到近场声音，正在唤醒",
        audio: audioState({
          input: "wake",
          source: "backend",
          level: directive.level,
          message: directive.hint ?? "检测到近场声音",
        }),
      };
    case "listening":
      return {
        mode: "standby",
        phase: "listening",
        emotion: "listening",
        listeningHint: directive.hint ?? "正在聆听",
        audio: audioState({
          input: "listening",
          source: "backend",
          level: directive.level,
          message: directive.hint ?? "正在聆听",
        }),
      };
    case "processing":
      return {
        mode: "standby",
        phase: "listening",
        emotion: "processing",
        listeningHint: directive.hint ?? "正在理解你的需求",
        audio: audioState({
          input: "processing",
          source: "backend",
          message: directive.hint ?? "正在理解",
        }),
      };
    case "chat":
      return {
        mode: "chat",
        answer: directive.answer,
        keywords: directive.keywords ?? [],
        audio: audioState({
          output: "speaking",
          source: "backend",
          message: "普通问答播报",
          ...directive.audio,
        }),
      };
    case "expert":
      return {
        mode: "expert",
        answer: directive.answer,
        keywords: directive.keywords ?? [],
        citations: directive.citations ?? [],
        audio: audioState({
          output: "speaking",
          source: "backend",
          message: "专家回答播报",
          ...directive.audio,
        }),
      };
    case "map":
      return {
        mode: "map",
        request: directive.request,
        audio: audioState({
          source: "backend",
          message: "打开地图导航",
          ...directive.audio,
        }),
      };
  }
}

export const mockDirectives: Array<{ label: string; directive: BackendDirective }> = [
  {
    label: "后端：近场唤醒",
    directive: { type: "wake", level: 0.82, hint: "检测到近场声音" },
  },
  {
    label: "后端：进入聆听",
    directive: { type: "listening", level: 0.64, hint: "我在听，请说出需求" },
  },
  {
    label: "后端：理解中",
    directive: { type: "processing", hint: "正在判断是问答、专家检索还是地图导航" },
  },
  {
    label: "后端：普通问答",
    directive: {
      type: "chat",
      answer: "工程训练中心提供 CAD/CAM、3D 打印、焊接、数控加工等实践训练能力。",
      keywords: ["工程训练", "实践", "加工"],
    },
  },
  {
    label: "后端：专家检索",
    directive: {
      type: "expert",
      answer: "数控加工课程通常围绕数铣、数车、WEDM 等设备展开，适合结合工艺文件与安全规范进行学习。",
      keywords: ["数控加工", "安全规范", "设备"],
      citations: [
        {
          title: "工程训练课程资料",
          source: "后端检索占位",
          excerpt: "后续由文档检索服务返回具体引用。",
        },
      ],
    },
  },
  {
    label: "后端：导航到 104 二层",
    directive: {
      type: "map",
      request: {
        targetRoomId: "104-2F01",
        announce: ["summary", "distance", "floorChange"],
      },
    },
  },
  {
    label: "后端：108 门厅到 202-5",
    directive: {
      type: "map",
      request: {
        startRoomId: "108-lobby",
        targetRoomId: "202-5",
        announce: ["summary", "distance", "direction", "floorChange"],
      },
    },
  },
];
