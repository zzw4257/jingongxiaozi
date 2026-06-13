import { BookOpenText, Bot, Bug, ChevronRight, MapPinned, MessageCircle, Mic2, MonitorSmartphone, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyBackendDirective, mockDirectives } from "./backend-bridge/directives";
import { ChatView } from "./features/chat/ChatView";
import { ExpertView } from "./features/expert/ExpertView";
import { MapShell } from "./features/map3d/MapShell";
import { StandbyView } from "./features/standby/StandbyView";
import type { AppState, BackendDirective, MapDirectRequest } from "./shared/appTypes";
import { DEFAULT_APP_STATE, DEFAULT_AUDIO_STATE } from "./shared/appTypes";
import { postMiniProgramMessage } from "./shared/miniProgramBridge";
import { useDuplexKitRealtime } from "./duplexkit/useDuplexKitRealtime";

function shouldKeepMapForVoiceDirective(directive: BackendDirective) {
  return directive.type === "wake" || directive.type === "listening" || directive.type === "processing" || directive.type === "chat" || directive.type === "expert";
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
      <section className="duplex-control-dock">
        <span>{realtimeStatus}</span>
        {voiceControls}
      </section>

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
      </section>

      <section className="app-content">
        {appState.mode === "standby" && <StandbyView state={appState} onOpenMap={openMapManual} onOpenChat={openChatManual} onOpenExpert={openExpertManual} />}
        {appState.mode === "chat" && <ChatView answer={appState.answer} keywords={appState.keywords} audio={appState.audio} />}
        {appState.mode === "expert" && <ExpertView answer={appState.answer} keywords={appState.keywords} citations={appState.citations} audio={appState.audio} />}
        {appState.mode === "map" && <MapShell initialRequest={appState.request} entrySource={appState.request ? "backend" : "manual"} onExit={() => setAppState(DEFAULT_APP_STATE)} />}
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
          <button className={debugOpen ? "drawer-item active" : "drawer-item"} onClick={() => { setDebugOpen((open) => !open); setNavOpen(false); }}>
            <Bug size={22} />
            <span>后端调试</span>
          </button>
        </aside>
      )}

      {displayMode === "desktop" && (
        <button className={debugOpen ? "debug-fab active" : "debug-fab"} onClick={() => setDebugOpen((open) => !open)} title="后端指令模拟">
          {debugOpen ? <X size={24} /> : <Bug size={24} />}
        </button>
      )}

      {debugOpen && (
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
          <div className="duplex-panel">
            <div className="duplex-panel-title">DuplexKit 后端</div>
            <label>
              <span>Mac IP</span>
              <input value={duplexKit.host} inputMode="decimal" placeholder="10.x.x.x" onChange={(event) => duplexKit.setHost(event.target.value)} />
            </label>
            <label>
              <span>Port</span>
              <input value={duplexKit.port} inputMode="numeric" placeholder="5177" onChange={(event) => duplexKit.setPort(event.target.value)} />
            </label>
            <button className="directive-button strong" onClick={duplexKit.connectionState === "connected" ? duplexKit.disconnect : duplexKit.connect}>
              {duplexKit.connectionState === "connected" ? "断开 DuplexKit" : "连接 DuplexKit"}
            </button>
            <button className="directive-button" disabled={duplexKit.connectionState !== "connected"} onClick={duplexKit.toggleMic}>
              {duplexKit.micOn ? "停止实时语音" : "开始实时语音"}
            </button>
            <div className="duplex-meter" aria-label="DuplexKit microphone level">
              <span style={{ width: `${Math.round(duplexKit.level * 100)}%` }} />
            </div>
            <p>{duplexKit.connectionState} · {duplexKit.serviceState}</p>
            {duplexKit.error ? <p className="duplex-error">{duplexKit.error}</p> : null}
            {duplexKit.turns.slice(-3).map((turn) => (
              <article className="duplex-turn" key={turn.id}>
                <strong>{turn.role === "user" ? "我" : "后端"}</strong>
                <span>{turn.text}</span>
              </article>
            ))}
          </div>
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
