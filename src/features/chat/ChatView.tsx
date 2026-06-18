import robotSpeaking from "../../assets/ui/robot-speaking.png";
import { AudioStatus } from "../../shared/AudioStatus";
import { SpokenAnswer } from "../../shared/SpokenAnswer";
import type { AudioChainState } from "../../shared/appTypes";

type Props = {
  answer: string;
  keywords: string[];
  audio: AudioChainState;
};

export function ChatView({ answer, keywords, audio }: Props) {
  return (
    <div className="response-screen chat-display-screen">
      <div className="response-avatar" aria-hidden="true">
        <img src={robotSpeaking} alt="" draggable={false} />
      </div>
      <article className="response-card spoken-card">
        <span className="eyebrow">常态对话</span>
        <SpokenAnswer text={answer} audio={audio} />
        <div className="keyword-row">
          {keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
        <AudioStatus audio={audio} compact />
      </article>
    </div>
  );
}
