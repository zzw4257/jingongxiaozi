import { BookOpenText, Bot, Bug, MapPinned, MessageCircle, Mic2, MonitorSmartphone, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { applyBackendDirective, mockDirectives } from "./backend-bridge/directives";
import { ChatView } from "./features/chat/ChatView";
import { ExpertView } from "./features/expert/ExpertView";
import { MapApp } from "./features/map/MapApp";
import { StandbyView } from "./features/standby/StandbyView";
import type { AppState, BackendDirective, MapDirectRequest } from "./shared/appTypes";
import { DEFAULT_APP_STATE, DEFAULT_AUDIO_STATE } from "./shared/appTypes";

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

  useEffect(() => {
    setNavOpen(false);
  }, [activeRail]);

  useEffect(() => {
    if (displayMode === "kiosk") {
      setDebugOpen(false);
    }
  }, [appState.mode, displayMode]);

  const handleDirective = (directive: BackendDirective) => {
    setAppState(applyBackendDirective(directive));
  };

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

  return (
    <main className={`app-shell ${displayMode === "kiosk" ? "kiosk-shell" : "desktop-shell"} mode-${activeRail} ${immersive ? "immersive-mode" : ""} ${navOpen ? "nav-open" : ""}`}>
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">
          <Bot size={31} strokeWidth={2.4} />
        </div>
        <div>
          <h1>金工小子</h1>
          <p>机器人头顶展示终端 / 聆听状态 / 对话问答 / 金工中心地图导航</p>
        </div>
        <div className="header-status">
          <span>{title}</span>
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
          <span>聆听</span>
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
        {appState.mode === "map" && <MapApp initialRequest={appState.request} entrySource={appState.request ? "backend" : "manual"} onExit={() => setAppState(DEFAULT_APP_STATE)} />}
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

      {immersive && appState.mode !== "map" && !(appState.mode === "standby" && appState.phase === "idle") && (
        <button className="kiosk-nav-peek app-switch-entry" onClick={() => setNavOpen(true)} aria-label="打开模块切换" title="打开模块切换">
          <span className="peek-dot" />
        </button>
      )}

      {immersive && navOpen && appState.mode !== "map" && (
        <button className="kiosk-nav-backdrop" aria-label="关闭模块切换" onClick={() => setNavOpen(false)} />
      )}

      {displayMode === "desktop" && (
        <button className={debugOpen ? "debug-fab active" : "debug-fab"} onClick={() => setDebugOpen((open) => !open)} title="后端指令模拟">
          {debugOpen ? <X size={24} /> : <Bug size={24} />}
        </button>
      )}

      {displayMode === "desktop" && debugOpen && (
        <aside className="directive-panel floating" aria-label="后端指令调试">
          <div className="panel-title">
            <span>后端指令模拟</span>
            <button className="icon-button" onClick={() => setAppState(DEFAULT_APP_STATE)} title="回到待机">
              <RotateCcw size={17} />
            </button>
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
