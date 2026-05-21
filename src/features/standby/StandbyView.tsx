import { BookOpenText, MapPinned, MessageCircle } from "lucide-react";
import mapBuildingPin from "../../assets/ui/map-building-pin.png";
import robotExpert from "../../assets/ui/robot-expert.png";
import robotListening from "../../assets/ui/robot-listening.png";
import robotSpeaking from "../../assets/ui/robot-speaking.png";
import robotStandby from "../../assets/ui/robot-standby.png";
import { AudioStatus } from "../../shared/AudioStatus";
import type { AppState } from "../../shared/appTypes";

type Props = {
  state: Extract<AppState, { mode: "standby" }>;
  onOpenMap: () => void;
  onOpenChat: () => void;
  onOpenExpert: () => void;
};

export function StandbyView({ state, onOpenMap, onOpenChat, onOpenExpert }: Props) {
  const listening = state.phase === "listening";

  return (
    <div className="standby-screen">
      <button className="robot-expression-stage" aria-label={listening ? "正在聆听，打开地图导航" : "待机表情，打开地图导航"} onClick={onOpenMap} onTouchStart={onOpenMap}>
        <img className={listening ? "robot-expression-image listening" : "robot-expression-image"} src={listening ? robotListening : robotStandby} alt="" draggable={false} />
        {listening && (
          <div className="voice-wave" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <i key={index} style={{ animationDelay: `${index * 45}ms` }} />
            ))}
          </div>
        )}
      </button>
      <div className="standby-copy">
        <span className="eyebrow">{listening ? "正在聆听" : "待机中"}</span>
        <h2>{listening ? "我在听" : "金工小子"}</h2>
        <p>{listening ? state.listeningHint ?? "等待后端判断下一步展示模式" : "触摸屏幕或靠近说话即可开始。"}</p>
        <AudioStatus audio={state.audio} />
      </div>
      <div className="launcher-grid" aria-label="内置应用入口">
        <button className="launcher-card primary" onClick={(event) => { event.stopPropagation(); onOpenMap(); }}>
          <img className="launcher-asset" src={mapBuildingPin} alt="" draggable={false} />
          <MapPinned size={30} />
          <span>地图导航</span>
          <small>独立浏览 / 起终点导航 / 2.5D 分层</small>
        </button>
        <button className="launcher-card" onClick={(event) => { event.stopPropagation(); onOpenChat(); }}>
          <img className="launcher-asset" src={robotSpeaking} alt="" draggable={false} />
          <MessageCircle size={28} />
          <span>常态对话</span>
          <small>普通问答结果展示</small>
        </button>
        <button className="launcher-card" onClick={(event) => { event.stopPropagation(); onOpenExpert(); }}>
          <img className="launcher-asset" src={robotExpert} alt="" draggable={false} />
          <BookOpenText size={28} />
          <span>专家问答</span>
          <small>检索答案与引用展示</small>
        </button>
      </div>
    </div>
  );
}
