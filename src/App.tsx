import { BookOpenText, Bot, Bug, MapPinned, MessageCircle, Mic2, MonitorSmartphone, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { applyBackendDirective, mockDirectives } from "./backend-bridge/directives";
import { ChatView } from "./features/chat/ChatView";
import { ExpertView } from "./features/expert/ExpertView";
import { MapApp } from "./features/map/MapApp";
import { StandbyView } from "./features/standby/StandbyView";
import type { AppState, BackendDirective, MapDirectRequest } from "./shared/appTypes";
import { DEFAULT_APP_STATE } from "./shared/appTypes";

export function App() {
  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE);
  const [debugOpen, setDebugOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<"kiosk" | "desktop">("kiosk");
  const [navOpen, setNavOpen] = useState(false);

  const activeMode = appState.mode;
  const activeRail = appState.mode === "standby" && appState.phase === "listening" ? "listening" : activeMode;
  const immersive = displayMode === "kiosk";

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
    setAppState({ mode: "map" });
  };

  const openChatManual = () => {
    handleDirective({
      type: "chat",
      answer: "这里是常态对话展示模式。后续由后端返回回答、核心词和语音输出状态。",
      keywords: ["常态对话", "核心词", "后端返回"],
    });
  };

  const openExpertManual = () => {
    handleDirective({
      type: "expert",
      answer: "这里是专家问答展示模式。后续由文档检索服务返回答案与引用信息。",
      keywords: ["专家问答", "文档检索"],
      citations: [{ title: "检索引用占位", source: "本地 mock", excerpt: "等待后端接入真实引用。" }],
    });
  };

  const openMapFromBackend = (request: MapDirectRequest) => {
    handleDirective({ type: "map", request });
  };

  useEffect(() => {
    (window as typeof window & { jingongOpenMap?: () => void }).jingongOpenMap = openMapManual;
    return () => {
      delete (window as typeof window & { jingongOpenMap?: () => void }).jingongOpenMap;
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
        {appState.mode === "chat" && <ChatView answer={appState.answer} keywords={appState.keywords} />}
        {appState.mode === "expert" && <ExpertView answer={appState.answer} keywords={appState.keywords} citations={appState.citations} />}
        {appState.mode === "map" && <MapApp initialRequest={appState.request} entrySource={appState.request ? "backend" : "manual"} onExit={() => setAppState(DEFAULT_APP_STATE)} />}
      </section>

      {immersive && (
        <button
          className={activeMode === "standby" ? "kiosk-nav-peek standby-entry" : "kiosk-nav-peek"}
          onClick={() => {
            if (activeMode === "standby") {
              openMapManual();
              return;
            }
            setNavOpen((open) => !open);
          }}
          aria-label={activeMode === "standby" ? "打开地图导航" : navOpen ? "收起模块入口" : "展开模块入口"}
          title={activeMode === "standby" ? "打开地图导航" : navOpen ? "收起模块入口" : "展开模块入口"}
        >
          {activeMode === "standby" ? (
            <>
              <MapPinned size={22} />
              <span>地图导航</span>
            </>
          ) : (
            <span className="peek-dot" aria-hidden="true" />
          )}
        </button>
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
    </main>
  );
}
