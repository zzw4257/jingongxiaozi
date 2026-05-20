import robotExpert from "../../assets/ui/robot-expert.png";
import type { Citation } from "../../shared/appTypes";

type Props = {
  answer: string;
  keywords: string[];
  citations: Citation[];
};

export function ExpertView({ answer, keywords, citations }: Props) {
  return (
    <div className="response-screen expert-screen">
      <img className="expert-asset" src={robotExpert} alt="" draggable={false} />
      <article className="response-card expert-answer-card">
        <span className="eyebrow">专家问答</span>
        <h2>工程训练知识回答</h2>
        <p className="spoken-answer">{answer}</p>
        <div className="keyword-row">
          {keywords.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      </article>
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
