import robotExpert from "../../assets/ui/robot-expert.png";
import { AudioStatus } from "../../shared/AudioStatus";
import { SpokenAnswer } from "../../shared/SpokenAnswer";
import type { AudioChainState, Citation } from "../../shared/appTypes";

type Props = {
  answer: string;
  keywords: string[];
  citations: Citation[];
  audio: AudioChainState;
};

export function ExpertView({ answer, keywords, citations, audio }: Props) {
  return (
    <div className="response-screen expert-screen">
      <article className="response-card expert-answer-card">
        <SpokenAnswer text={answer} audio={audio} />
        <div className="keyword-row">
          {keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
        <AudioStatus audio={audio} compact />
      </article>
      <img className="expert-asset response-companion" src={robotExpert} alt="" draggable={false} />
      <div className="citation-list">
        {citations.map((citation) => (
          <article key={`${citation.title}-${citation.source}`} className="citation-card">
            <strong>{citation.title}</strong>
            <span>{citation.source}</span>
            {citation.excerpt && <p>{citation.excerpt}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
