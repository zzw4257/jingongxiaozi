import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downsample, DUPLEXKIT_SAMPLE_RATE, floatToInt16Buffer, PcmFloat32Player, rms } from "./audio";
import { resolveRoomId, roomLabel } from "./roomResolver";
import { isRealtimeMessage } from "./types";
import type { BackendDirective, MapDirectRequest } from "../shared/appTypes";
import type { DuplexKitConnectionState, DuplexKitRealtimeMessage, DuplexKitToolRequest, DuplexKitTurn } from "./types";

const DEFAULT_PORT = "5177";
const DEFAULT_HOST = "10.162.230.154";
const HOST_STORAGE_KEY = "duplexkit.backend.host";
const PORT_STORAGE_KEY = "duplexkit.backend.port";

function readStoredValue(key: string): string {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in restricted WebViews; connection still works for this session.
  }
}

function initialHost(): string {
  const stored = readStoredValue(HOST_STORAGE_KEY).trim();
  if (stored) return stored;
  const host = window.location.hostname;
  return host && host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".localhost") ? host : DEFAULT_HOST;
}

function initialPort(): string {
  return readStoredValue(PORT_STORAGE_KEY).trim() || DEFAULT_PORT;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function newId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildBaseUrl(host: string, port: string): string {
  const trimmedHost = host.trim();
  const trimmedPort = port.trim();
  const withProtocol = /^https?:\/\//i.test(trimmedHost) ? trimmedHost : `http://${trimmedHost}`;
  const url = new URL(withProtocol);
  if (trimmedPort) url.port = trimmedPort;
  return url.origin;
}

function appendOrReplaceTurn(turns: DuplexKitTurn[], role: DuplexKitTurn["role"], text: string, final = false, append = false): DuplexKitTurn[] {
  if (!text) return turns;
  const last = turns[turns.length - 1];
  if (last?.role === role && !last.final && !append) {
    return [...turns.slice(0, -1), { ...last, text, final }];
  }
  return [...turns, { id: newId(), role, text, final }];
}

function finalizeLast(turns: DuplexKitTurn[], role?: DuplexKitTurn["role"]): DuplexKitTurn[] {
  const index = [...turns].reverse().findIndex((turn) => !turn.final && (!role || turn.role === role));
  if (index < 0) return turns;
  const target = turns.length - 1 - index;
  return turns.map((turn, current) => (current === target ? { ...turn, final: true } : turn));
}

function mapRequestForTool(request: DuplexKitToolRequest, current: MapDirectRequest): MapDirectRequest | undefined {
  const place = request.args?.place;
  switch (request.tool) {
    case "map.open":
      return {
        ...current,
        layerMode: current.layerMode ?? "allFloors",
        announce: current.announce ?? ["summary", "distance", "floorChange"],
      };
    case "map.close":
      return undefined;
    case "map.set_origin":
      return {
        ...current,
        startRoomId: resolveRoomId(place, current.startRoomId),
        layerMode: current.layerMode ?? "allFloors",
        announce: current.announce ?? ["summary", "distance", "floorChange"],
      };
    case "map.set_destination":
      return {
        ...current,
        targetRoomId: resolveRoomId(place, current.targetRoomId),
        layerMode: "allFloors",
        announce: current.announce ?? ["summary", "distance", "floorChange"],
      };
    case "navigation.start":
      return {
        ...current,
        targetRoomId: resolveRoomId(place, current.targetRoomId),
        layerMode: "allFloors",
        announce: ["summary", "distance", "direction", "floorChange"],
      };
  }
}

function resultForTool(request: DuplexKitToolRequest, mapRequest?: MapDirectRequest) {
  const target = roomLabel(mapRequest?.targetRoomId);
  const origin = roomLabel(mapRequest?.startRoomId);
  switch (request.tool) {
    case "map.open":
      return { summary: "地图已打开", visibleResult: "金工小子地图界面已打开。" };
    case "map.close":
      return { summary: "地图已关闭", visibleResult: "金工小子已回到待机界面。" };
    case "map.set_origin":
      return { summary: `起点已设置为${origin}`, visibleResult: `地图起点：${origin}` };
    case "map.set_destination":
      return { summary: `终点已设置为${target}`, visibleResult: `地图终点：${target}` };
    case "navigation.start":
      return { summary: `导航已启动，目的地是${target}`, visibleResult: `金工小子地图已显示到 ${target} 的路线。` };
  }
}

type Options = {
  onDirective: (directive: BackendDirective) => void;
};

export function useDuplexKitRealtime({ onDirective }: Options) {
  const [host, setHostValue] = useState(initialHost);
  const [port, setPortValue] = useState(initialPort);
  const [connectionState, setConnectionState] = useState<DuplexKitConnectionState>("idle");
  const [serviceState, setServiceState] = useState("idle");
  const [micOn, setMicOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<DuplexKitTurn[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<PcmFloat32Player | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sinkRef = useRef<GainNode | null>(null);
  const runningRef = useRef(false);
  const mapRequestRef = useRef<MapDirectRequest>({});
  const preserveDirectiveUntilRef = useRef(0);

  const baseUrl = useMemo(() => {
    try {
      return buildBaseUrl(host, port);
    } catch {
      return "";
    }
  }, [host, port]);

  const setHost = useCallback((value: string) => {
    setHostValue(value);
    writeStoredValue(HOST_STORAGE_KEY, value);
  }, []);

  const setPort = useCallback((value: string) => {
    setPortValue(value);
    writeStoredValue(PORT_STORAGE_KEY, value);
  }, []);

  const sendClientDebug = useCallback((levelName: "info" | "warn" | "error", event: string, message?: string, data?: unknown) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "client_debug", level: levelName, event, message, data, at: new Date().toISOString() }));
  }, []);

  const stopMic = useCallback(() => {
    runningRef.current = false;
    setMicOn(false);
    setLevel(0);
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    sinkRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    processorRef.current = null;
    sourceRef.current = null;
    sinkRef.current = null;
    streamRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    stopMic();
    playerRef.current?.clear();
    socketRef.current?.close();
    socketRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    playerRef.current = null;
    setConnectionState("idle");
    setServiceState("idle");
  }, [stopMic]);

  useEffect(() => () => disconnect(), [disconnect]);

  const sendToolResult = useCallback((request: DuplexKitToolRequest, mapRequest?: MapDirectRequest) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const result = resultForTool(request, mapRequest);
    socket.send(
      JSON.stringify({
        type: "tool_result",
        toolCallId: request.toolCallId,
        tool: request.tool,
        status: "success",
        summary: result.summary,
        visibleResult: result.visibleResult,
        debugNote: "jingongxiaozi full-stack bridge acknowledged tool_request",
      }),
    );
  }, []);

  const handleToolRequest = useCallback(
    (request: DuplexKitToolRequest) => {
      preserveDirectiveUntilRef.current = Date.now() + 12_000;
      const nextMapRequest = mapRequestForTool(request, mapRequestRef.current);
      if (request.tool === "map.close") {
        mapRequestRef.current = {};
        onDirective({ type: "idle", emotion: "neutral" });
        sendToolResult(request, undefined);
        return;
      }
      if (nextMapRequest) {
        mapRequestRef.current = nextMapRequest;
        onDirective({
          type: "map",
          request: nextMapRequest,
          audio: { source: "backend", message: request.spoken || "后端请求打开地图导航" },
        });
      }
      sendToolResult(request, nextMapRequest);
    },
    [onDirective, sendToolResult],
  );

  const handleJsonMessage = useCallback(
    (message: DuplexKitRealtimeMessage) => {
      switch (message.type) {
        case "status":
          setServiceState(message.state || "connected");
          break;
        case "error":
          setError(message.message || "Realtime service error");
          setConnectionState("error");
          break;
        case "asr_start":
          playerRef.current?.clear();
          setServiceState("listening");
          onDirective({ type: "listening", hint: "我在听，请说出需求", level });
          break;
        case "transcript":
          setTurns((current) => appendOrReplaceTurn(current, "user", message.text || ""));
          onDirective({ type: "listening", hint: message.text || "正在聆听", level });
          break;
        case "assistant_text":
          setTurns((current) => appendOrReplaceTurn(current, "assistant", message.text || "", false, Boolean(message.append)));
          if (message.text && Date.now() > preserveDirectiveUntilRef.current) {
            onDirective({ type: "chat", answer: message.text, keywords: ["实时语音"], audio: { source: "backend", output: "speaking", message: "后端实时回复" } });
          }
          break;
        case "message_end":
          if (message.role === "user") setTurns((current) => finalizeLast(current, "user"));
          if (message.role === "assistant" || message.role === "audio") setTurns((current) => finalizeLast(current, "assistant"));
          break;
        case "asr_end":
          setServiceState("thinking");
          setTurns((current) => finalizeLast(current, "user"));
          onDirective({ type: "processing", hint: "正在理解你的需求" });
          break;
        case "tts_start":
          if (!message.suppressed) setServiceState("speaking");
          break;
        case "tts_end":
        case "llm_end":
          setServiceState("listening");
          setTurns((current) => finalizeLast(current, "assistant"));
          break;
        case "tool_request":
          if (message.request) handleToolRequest(message.request);
          break;
        case "tool":
        case "raw_event":
          break;
      }
    },
    [handleToolRequest, level, onDirective],
  );

  const connect = useCallback(() => {
    if (!baseUrl) {
      setError("请输入有效的 Mac IP 和端口");
      setConnectionState("error");
      return;
    }
    setError("");
    setConnectionState("connecting");
    const wsUrl = `${baseUrl.replace(/^http/i, "ws")}/api/realtime`;
    try {
      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      socket.addEventListener("open", () => {
        setConnectionState("connected");
        setServiceState("connected");
        sendClientDebug("info", "socket_open", wsUrl, {
          secureContext: window.isSecureContext,
          hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
          sampleRate: DUPLEXKIT_SAMPLE_RATE,
        });
      });
      socket.addEventListener("message", async (event) => {
        if (typeof event.data === "string") {
          try {
            const parsed = JSON.parse(event.data) as unknown;
            if (isRealtimeMessage(parsed)) handleJsonMessage(parsed);
          } catch (parseError) {
            sendClientDebug("error", "json_parse_error", errorMessage(parseError), event.data);
          }
          return;
        }
        const bytes = event.data instanceof Blob ? await event.data.arrayBuffer() : (event.data as ArrayBuffer);
        playerRef.current?.play(bytes);
      });
      socket.addEventListener("close", () => {
        stopMic();
        if (socketRef.current === socket) socketRef.current = null;
        setConnectionState("idle");
        setServiceState("closed");
      });
      socket.addEventListener("error", () => {
        setError("WebSocket 连接失败，请确认 Mac IP、端口和局域网可达");
        setConnectionState("error");
      });
    } catch (connectError) {
      setError(errorMessage(connectError));
      setConnectionState("error");
    }
  }, [baseUrl, handleJsonMessage, sendClientDebug, stopMic]);

  const startMic = useCallback(async () => {
    if (connectionState !== "connected" || socketRef.current?.readyState !== WebSocket.OPEN) {
      setError("请先连接 DuplexKit 后端");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "getUserMedia not found. 请使用 Tauri Android WebView 或 HTTPS/localhost 调试入口。";
      sendClientDebug("error", "microphone_api_missing", message, {
        secureContext: window.isSecureContext,
        hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      });
      throw new Error(message);
    }
    setError("");
    const context = audioContextRef.current || new AudioContext();
    audioContextRef.current = context;
    playerRef.current ||= new PcmFloat32Player(context);
    await context.resume();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(2048, 1, 1);
    const sink = context.createGain();
    sink.gain.value = 0;
    processor.onaudioprocess = (event) => {
      if (!runningRef.current || socketRef.current?.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const nextLevel = Math.min(1, rms(input) * 7);
      setLevel(nextLevel);
      const pcm = downsample(input, context.sampleRate, DUPLEXKIT_SAMPLE_RATE);
      socketRef.current.send(floatToInt16Buffer(pcm));
    };
    source.connect(processor);
    processor.connect(sink);
    sink.connect(context.destination);
    streamRef.current = stream;
    sourceRef.current = source;
    processorRef.current = processor;
    sinkRef.current = sink;
    runningRef.current = true;
    setMicOn(true);
    onDirective({ type: "listening", hint: "我在听，请说出需求", level });
  }, [connectionState, level, onDirective, sendClientDebug]);

  const toggleMic = useCallback(async () => {
    if (micOn) {
      stopMic();
      return;
    }
    try {
      await startMic();
    } catch (micError) {
      const message = errorMessage(micError);
      setError(message);
      sendClientDebug("error", "microphone_error", message);
      stopMic();
    }
  }, [micOn, sendClientDebug, startMic, stopMic]);

  return {
    host,
    setHost,
    port,
    setPort,
    connectionState,
    serviceState,
    micOn,
    level,
    error,
    turns,
    baseUrl,
    connect,
    disconnect,
    toggleMic,
  };
}
