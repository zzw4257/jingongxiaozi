import { BookOpenText, Bot, Bug, ChevronRight, MapPinned, MessageCircle, Mic2, MonitorSmartphone, PlugZap, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { applyBackendDirective, mockDirectives } from "./backend-bridge/directives";
import { ChatView } from "./features/chat/ChatView";
import { ExpertView } from "./features/expert/ExpertView";
import { MapShell } from "./features/map3d/MapShell";
import { StandbyView } from "./features/standby/StandbyView";
import type { AppState, BackendDirective, MapDirectRequest } from "./shared/appTypes";
import { DEFAULT_APP_STATE, DEFAULT_AUDIO_STATE } from "./shared/appTypes";
import { postMiniProgramMessage } from "./shared/miniProgramBridge";
import { useDuplexKitRealtime } from "./duplexkit/useDuplexKitRealtime";

const STATUS_DOT_STORAGE_KEY = "duplexkit.statusDot.position";

function shouldKeepMapForVoiceDirective(directive: BackendDirective) {
  return directive.type === "wake" || directive.type === "listening" || directive.type === "processing" || directive.type === "chat" || directive.type === "expert";
}

function clampStatusDotPosition(position: { x: number; y: number }) {
  const margin = 10;
  const size = 44;
  const width = window.innerWidth || 1080;
  const height = window.innerHeight || 720;
  return {
    x: Math.min(Math.max(position.x, margin), Math.max(margin, width - size - margin)),
    y: Math.min(Math.max(position.y, margin), Math.max(margin, height - size - margin)),
  };
}

function readStatusDotPosition() {
  try {
    const raw = window.localStorage.getItem(STATUS_DOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return clampStatusDotPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return null;
  }
}

function writeStatusDotPosition(position: { x: number; y: number }) {
  try {
    window.localStorage.setItem(STATUS_DOT_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // The dot still drags in this session if WebView storage is unavailable.
  }
}

function DraggableStatusDot({
  recording,
  realtimeStatus,
  onOpen,
}: {
  recording: boolean;
  realtimeStatus: string;
  onOpen: () => void;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const latestPositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef({
    timer: 0,
    pointerId: -1,
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    suppressClick: false,
  });

  useEffect(() => {
    const updateDefaultPosition = () => {
      setPosition((current) => {
        const next = current ?? readStatusDotPosition() ?? clampStatusDotPosition({ x: window.innerWidth - 112, y: 14 });
        latestPositionRef.current = next;
        return next;
      });
    };
    updateDefaultPosition();
    window.addEventListener("resize", updateDefaultPosition);
    return () => window.removeEventListener("resize", updateDefaultPosition);
  }, []);

  const clearLongPress = () => {
    if (dragRef.current.timer) {
      window.clearTimeout(dragRef.current.timer);
      dragRef.current.timer = 0;
    }
  };

  const finishDrag = () => {
    clearLongPress();
    const latestPosition = latestPositionRef.current ?? position;
    if (dragRef.current.active && latestPosition) {
      writeStatusDotPosition(latestPosition);
      dragRef.current.suppressClick = true;
      window.setTimeout(() => {
        dragRef.current.suppressClick = false;
      }, 0);
    }
    dragRef.current.active = false;
    setDragging(false);
  };

  return (
    <button
      className={`duplex-status-dot ${recording ? "recording" : ""} ${dragging ? "dragging" : ""}`}
      style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
      onClick={(event) => {
        if (dragRef.current.suppressClick) {
          event.preventDefault();
          return;
        }
        onOpen();
      }}
      onPointerDown={(event) => {
        const current = position ?? clampStatusDotPosition({ x: window.innerWidth - 112, y: 14 });
        latestPositionRef.current = current;
        dragRef.current.pointerId = event.pointerId;
        dragRef.current.active = false;
        dragRef.current.moved = false;
        dragRef.current.startX = event.clientX;
        dragRef.current.startY = event.clientY;
        dragRef.current.initialX = current.x;
        dragRef.current.initialY = current.y;
        clearLongPress();
        dragRef.current.timer = window.setTimeout(() => {
          dragRef.current.active = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }, 350);
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== dragRef.current.pointerId) return;
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        if (!dragRef.current.active && Math.hypot(dx, dy) > 8) {
          clearLongPress();
          return;
        }
        if (!dragRef.current.active) return;
        dragRef.current.moved = true;
        const nextPosition = clampStatusDotPosition({ x: dragRef.current.initialX + dx, y: dragRef.current.initialY + dy });
        latestPositionRef.current = nextPosition;
        setPosition(nextPosition);
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-label={`${realtimeStatus}，长按拖动`}
      title={`${realtimeStatus}，长按拖动`}
    >
      {recording ? <Mic2 size={19} /> : <PlugZap size={19} />}
    </button>
  );
}

function DuplexConnectionView({
  duplexKit,
  realtimeStatus,
  voiceControls,
}: {
  duplexKit: ReturnType<typeof useDuplexKitRealtime>;
  realtimeStatus: string;
  voiceControls: ReactNode;
}) {
  return (
    <section className="duplex-page">
      <div className="duplex-connection-card">
        <div className="duplex-page-heading">
          <span className="duplex-page-icon">
            <PlugZap size={28} />
          </span>
          <div>
            <h2>后端连接</h2>
            <p>DuplexKit Realtime WebSocket</p>
          </div>
        </div>

        <div className="duplex-status-row">
          <span>状态</span>
          <strong>{realtimeStatus}</strong>
        </div>
        <div className="duplex-status-row">
          <span>地址</span>
          <strong>{duplexKit.baseUrl || "未配置"}</strong>
        </div>

        <div className="duplex-form-grid">
          <label>
            <span>Mac IP</span>
            <input value={duplexKit.host} inputMode="decimal" placeholder="10.x.x.x" onChange={(event) => duplexKit.setHost(event.target.value)} />
          </label>
          <label>
            <span>Port</span>
            <input value={duplexKit.port} inputMode="numeric" placeholder="5177" onChange={(event) => duplexKit.setPort(event.target.value)} />
          </label>
        </div>

        <div className="duplex-page-actions">
          <button className="directive-button strong" onClick={duplexKit.connectionState === "connected" ? duplexKit.disconnect : duplexKit.connect}>
            {duplexKit.connectionState === "connected" ? "断开后端" : "连接后端"}
          </button>
          <button className="directive-button" disabled={duplexKit.connectionState !== "connected"} onClick={duplexKit.toggleMic}>
            {duplexKit.micOn ? "停止聆听" : "开始聆听"}
          </button>
        </div>

        <div className="duplex-meter" aria-label="DuplexKit microphone level">
          <span style={{ width: `${Math.round(duplexKit.level * 100)}%` }} />
        </div>
        <p className="duplex-connection-note">{duplexKit.connectionState} · {duplexKit.serviceState}</p>
        {duplexKit.error ? <p className="duplex-error">{duplexKit.error}</p> : null}
        <div className="duplex-page-voice">{voiceControls}</div>
      </div>

      <div className="duplex-turn-list" aria-label="最近对话">
        {duplexKit.turns.length === 0 ? (
          <p className="duplex-empty">暂无对话</p>
        ) : (
          duplexKit.turns.slice(-6).map((turn) => (
            <article className="duplex-turn" key={turn.id}>
              <strong>{turn.role === "user" ? "我" : "后端"}</strong>
              <span>{turn.text}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function App() {
  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE);
  const [debugOpen, setDebugOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<"kiosk" | "desktop">("kiosk");
  const [navOpen, setNavOpen] = useState(false);
  const [qaDirectiveIndex, setQaDirectiveIndex] = useState(0);

  const activeMode = appState.mode;
  const activeRail = appState.mode === "standby" && appState.phase === "listening" ? "listening" : activeMode;
  const immersive = displayMode === "kiosk";
  const qaHotspotEnabled = import.meta.env.VITE_QA_HOTSPOT === "1";
  const debugControlsEnabled = import.meta.env.VITE_SHOW_BACKEND_MOCKS === "1";

  const handleDirective = useCallback((directive: BackendDirective) => {
    setAppState((current) => {
      if (current.mode === "map" && shouldKeepMapForVoiceDirective(directive)) {
        return current;
      }
      return applyBackendDirective(directive);
    });
  }, []);

  const duplexKit = useDuplexKitRealtime({ onDirective: handleDirective });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const startRoomId = params.get("startRoomId") || undefined;
    const targetRoomId = params.get("targetRoomId") || undefined;
    const requestedLayerMode = params.get("layerMode") as MapDirectRequest["layerMode"] | null;
    const requestedActiveFloor = params.get("activeFloor") as MapDirectRequest["activeFloor"] | null;
    const announce = params.get("announce")?.split(",").filter(Boolean) as MapDirectRequest["announce"] | undefined;
    if (mode !== "map") return;
    const layerMode = requestedLayerMode && ["single", "twoFloor", "allFloors", "exploded", "section", "raised202"].includes(requestedLayerMode) ? requestedLayerMode : undefined;
    const activeFloor = requestedActiveFloor === "1F" || requestedActiveFloor === "2F" ? requestedActiveFloor : undefined;
    const request: MapDirectRequest = {
      ...(startRoomId ? { startRoomId } : {}),
      ...(targetRoomId ? { targetRoomId } : {}),
      ...(layerMode ? { layerMode } : {}),
      ...(activeFloor ? { activeFloor } : {}),
      ...(announce?.length ? { announce } : {}),
    };
    setAppState({
      mode: "map",
      request: targetRoomId || startRoomId || layerMode || activeFloor ? request : undefined,
      audio: { ...DEFAULT_AUDIO_STATE, source: "backend", message: "小程序入口打开地图" },
    });
    postMiniProgramMessage({ type: "map-direct", request });
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [activeRail]);

  const openMapManual = () => {
    setAppState({ mode: "map", audio: { ...DEFAULT_AUDIO_STATE, source: "touch", message: "手动打开地图" } });
  };

  const openChatManual = () => {
    handleDirective({
      type: "chat",
      answer: "这里是常态对话展示模式。后续由后端返回回答、核心词和语音输出状态。",
      keywords: ["常态对话", "核心词", "后端返回"],
      audio: { source: "touch", output: "speaking", message: "手动调试播报" },
    });
  };

  const openExpertManual = () => {
    handleDirective({
      type: "expert",
      answer: "这里是专家问答展示模式。后续由文档检索服务返回答案与引用信息。",
      keywords: ["专家问答", "文档检索"],
      audio: { source: "touch", output: "speaking", message: "手动调试专家播报" },
      citations: [{ title: "检索引用占位", source: "本地 mock", excerpt: "等待后端接入真实引用。" }],
    });
  };

  const openMapFromBackend = (request: MapDirectRequest) => {
    handleDirective({ type: "map", request });
  };

  const openDuplexConnection = () => {
    setAppState({ mode: "duplex", audio: { ...DEFAULT_AUDIO_STATE, source: "touch", message: "打开后端连接页面" } });
  };

  useEffect(() => {
    const apiWindow = window as typeof window & {
      jingongOpenMap?: () => void;
      jingongApplyDirective?: (directive: BackendDirective) => void;
    };
    apiWindow.jingongOpenMap = openMapManual;
    apiWindow.jingongApplyDirective = handleDirective;

    const onDirective = (event: Event) => {
      const directive = (event as CustomEvent<BackendDirective>).detail;
      if (directive) handleDirective(directive);
    };
    window.addEventListener("jingong:directive", onDirective);
    postMiniProgramMessage({ type: "map-ready", title: "金工小子", hasRoute: false });
    return () => {
      delete apiWindow.jingongOpenMap;
      delete apiWindow.jingongApplyDirective;
      window.removeEventListener("jingong:directive", onDirective);
    };
  }, []);

  const title = useMemo(() => {
    if (appState.mode === "standby") return appState.phase === "listening" ? "正在聆听" : "待机展示";
    if (appState.mode === "chat") return "常态对话";
    if (appState.mode === "expert") return "专家问答";
    if (appState.mode === "duplex") return "后端连接";
    return "地图导航";
  }, [appState]);

  const realtimeStatus = useMemo(() => {
    if (duplexKit.micOn) return "开麦中";
    if (duplexKit.connectionState === "connected") return "已连接，未开麦";
    if (duplexKit.connectionState === "connecting") return "连接中";
    if (duplexKit.connectionState === "error") return "连接失败";
    return "未连接";
  }, [duplexKit.connectionState, duplexKit.micOn]);

  const voiceControlLabel = useMemo(() => {
    if (duplexKit.micOn) return "停止聆听";
    if (duplexKit.connectionState === "connected") return "开始聆听";
    if (duplexKit.connectionState === "connecting") return "连接中";
    if (duplexKit.connectionState === "error") return "重新连接";
    return "连接后端";
  }, [duplexKit.connectionState, duplexKit.micOn]);

  const handleVoiceControl = () => {
    if (duplexKit.connectionState === "connected") {
      duplexKit.toggleMic();
      return;
    }
    if (duplexKit.connectionState !== "connecting") {
      duplexKit.connect();
    }
  };

  const voiceControls = (
    <div className="duplex-control-group" aria-label="DuplexKit 语音控制">
      <button
        className={`duplex-voice-toggle ${duplexKit.micOn ? "recording" : ""}`}
        onClick={handleVoiceControl}
        disabled={duplexKit.connectionState === "connecting"}
        title={duplexKit.connectionState === "connected" ? "开始或停止手机麦克风推流" : "连接 DuplexKit 后端"}
      >
        <Mic2 size={18} />
        <span>{voiceControlLabel}</span>
      </button>
      {duplexKit.connectionState === "connected" && (
        <button className="duplex-disconnect-toggle" onClick={duplexKit.disconnect} title="断开 DuplexKit 后端并停止麦克风">
          <X size={17} />
          <span>断开</span>
        </button>
      )}
    </div>
  );

  return (
    <main className={`app-shell ${displayMode === "kiosk" ? "kiosk-shell" : "desktop-shell"} mode-${activeRail} ${immersive ? "immersive-mode" : ""} ${navOpen ? "nav-open" : ""}`}>
      {appState.mode !== "duplex" && duplexKit.connectionState !== "idle" && (
        <DraggableStatusDot recording={duplexKit.micOn} realtimeStatus={realtimeStatus} onOpen={openDuplexConnection} />
      )}

      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <Bot size={31} strokeWidth={2.4} />
        </div>
        <div>
          <h1>金工小子</h1>
          <p>机器人头顶展示终端 / 聆听状态 / 对话问答 / 金工中心地图导航</p>
        </div>
        <div className="header-status">
          <span>{title} · {realtimeStatus}</span>
        </div>
        <button
          className="display-mode-toggle"
          onClick={() => setDisplayMode((mode) => (mode === "kiosk" ? "desktop" : "kiosk"))}
          title={displayMode === "kiosk" ? "切换到桌面端布局" : "切换到机器人展示端布局"}
        >
          <MonitorSmartphone size={18} />
          <span>{displayMode === "kiosk" ? "展示端" : "桌面端"}</span>
        </button>
      </header>

      <section className="mode-rail" aria-label="模块入口">
        <button className={activeRail === "standby" ? "rail-button active" : "rail-button"} onClick={() => setAppState(DEFAULT_APP_STATE)}>
          <Bot size={20} />
          <span>待机</span>
        </button>
        <button className={activeRail === "listening" ? "rail-button active" : "rail-button"} onClick={() => handleDirective({ type: "listening", hint: "我在听，请说出需求" })}>
          <Mic2 size={20} />
          <span>聆听展示</span>
        </button>
        <button className={activeMode === "map" ? "rail-button primary active" : "rail-button primary"} onClick={openMapManual}>
          <MapPinned size={20} />
          <span>地图</span>
        </button>
        <button className={activeMode === "chat" ? "rail-button active" : "rail-button"} onClick={openChatManual}>
          <MessageCircle size={20} />
          <span>对话</span>
        </button>
        <button className={activeMode === "expert" ? "rail-button active" : "rail-button"} onClick={openExpertManual}>
          <BookOpenText size={20} />
          <span>专家</span>
        </button>
        <button className={activeMode === "duplex" ? "rail-button active" : "rail-button"} onClick={openDuplexConnection}>
          <PlugZap size={20} />
          <span>后端</span>
        </button>
      </section>

      <section className="app-content">
        {appState.mode === "standby" && <StandbyView state={appState} onOpenMap={openMapManual} onOpenChat={openChatManual} onOpenExpert={openExpertManual} />}
        {appState.mode === "chat" && <ChatView answer={appState.answer} keywords={appState.keywords} audio={appState.audio} />}
        {appState.mode === "expert" && <ExpertView answer={appState.answer} keywords={appState.keywords} citations={appState.citations} audio={appState.audio} />}
        {appState.mode === "map" && <MapShell initialRequest={appState.request} entrySource={appState.request ? "backend" : "manual"} onExit={() => setAppState(DEFAULT_APP_STATE)} />}
        {appState.mode === "duplex" && <DuplexConnectionView duplexKit={duplexKit} realtimeStatus={realtimeStatus} voiceControls={voiceControls} />}
      </section>

      {immersive && appState.mode === "standby" && appState.phase === "idle" && (
        <button
          className="kiosk-nav-peek standby-entry"
          onClick={() => {
            openMapManual();
          }}
          aria-label="打开地图导航"
          title="打开地图导航"
        >
          <MapPinned size={22} />
          <span>地图导航</span>
        </button>
      )}

      {immersive && appState.mode !== "map" && (
        <button className="app-drawer-handle" onClick={() => setNavOpen(true)} aria-label="打开应用抽屉" title="打开应用抽屉">
          <ChevronRight size={22} />
        </button>
      )}

      {immersive && navOpen && appState.mode !== "map" && (
        <button className="kiosk-nav-backdrop" aria-label="关闭模块切换" onClick={() => setNavOpen(false)} />
      )}

      {immersive && navOpen && appState.mode !== "map" && (
        <aside className="app-drawer-panel" aria-label="内置应用抽屉">
          <div className="app-drawer-title">
            <strong>金工小子</strong>
            <button className="icon-button" onClick={() => setNavOpen(false)} title="关闭">
              <X size={18} />
            </button>
          </div>
          <button className={activeRail === "standby" ? "drawer-item active" : "drawer-item"} onClick={() => { setAppState(DEFAULT_APP_STATE); setNavOpen(false); }}>
            <Bot size={22} />
            <span>待机表情</span>
          </button>
          <button className={activeRail === "listening" ? "drawer-item active" : "drawer-item"} onClick={() => { handleDirective({ type: "listening", hint: "我在听，请说出需求" }); setNavOpen(false); }}>
            <Mic2 size={22} />
            <span>聆听展示</span>
          </button>
          <button className={activeMode === "map" ? "drawer-item primary active" : "drawer-item primary"} onClick={() => { openMapManual(); setNavOpen(false); }}>
            <MapPinned size={22} />
            <span>3D 精确模型地图</span>
          </button>
          <button className={activeMode === "chat" ? "drawer-item active" : "drawer-item"} onClick={() => { openChatManual(); setNavOpen(false); }}>
            <MessageCircle size={22} />
            <span>对话展示</span>
          </button>
          <button className={activeMode === "expert" ? "drawer-item active" : "drawer-item"} onClick={() => { openExpertManual(); setNavOpen(false); }}>
            <BookOpenText size={22} />
            <span>专家问答</span>
          </button>
          <button className={activeMode === "duplex" ? "drawer-item active" : "drawer-item"} onClick={() => { openDuplexConnection(); setNavOpen(false); }}>
            <PlugZap size={22} />
            <span>后端连接</span>
          </button>
          {debugControlsEnabled && (
            <button className={debugOpen ? "drawer-item active" : "drawer-item"} onClick={() => { setDebugOpen((open) => !open); setNavOpen(false); }}>
              <Bug size={22} />
              <span>后端调试</span>
            </button>
          )}
        </aside>
      )}

      {debugControlsEnabled && displayMode === "desktop" && (
        <button className={debugOpen ? "debug-fab active" : "debug-fab"} onClick={() => setDebugOpen((open) => !open)} title="后端指令模拟">
          {debugOpen ? <X size={24} /> : <Bug size={24} />}
        </button>
      )}

      {debugControlsEnabled && debugOpen && (
        <aside className="directive-panel floating" aria-label="后端指令调试">
          <div className="panel-title">
            <span>后端指令模拟</span>
            <span className="panel-actions">
              <button className="icon-button" onClick={() => setAppState(DEFAULT_APP_STATE)} title="回到待机">
                <RotateCcw size={17} />
              </button>
              <button className="icon-button" onClick={() => setDebugOpen(false)} title="关闭调试">
                <X size={17} />
              </button>
            </span>
          </div>
          {mockDirectives.map((item) => (
            <button key={item.label} className="directive-button" onClick={() => handleDirective(item.directive)}>
              {item.label}
            </button>
          ))}
          <button className="directive-button strong" onClick={() => openMapFromBackend({ targetRoomId: "108-2F04", announce: ["summary", "distance", "floorChange"] })}>
            MapDirect: 去 108 钳工
          </button>
        </aside>
      )}

      {qaHotspotEnabled && immersive && (
        <button
          className="qa-hotspot"
          aria-label="QA 指令循环"
          onClick={() => {
            const item = mockDirectives[qaDirectiveIndex % mockDirectives.length];
            handleDirective(item.directive);
            setQaDirectiveIndex((index) => index + 1);
          }}
        />
      )}
    </main>
  );
}
