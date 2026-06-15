import { useEffect, useMemo, useState } from "react";
import type { AudioChainState } from "./appTypes";

type Props = {
  text: string;
  audio: AudioChainState;
};

type Token = {
  value: string;
  speakable: boolean;
};

function tokenizeSpeech(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*|[\u4e00-\u9fa5]|[^\s]/g;
  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    tokens.push({ value, speakable: /[A-Za-z0-9\u4e00-\u9fa5]/.test(value) });
  }
  return tokens;
}

function activeTokenIndex(tokens: Token[], startedAt?: number) {
  if (!startedAt) return -1;
  const speakableIndexes = tokens.map((token, index) => (token.speakable ? index : -1)).filter((index) => index >= 0);
  if (speakableIndexes.length === 0) return -1;
  const elapsed = Math.max(0, Date.now() - startedAt);
  const estimatedMs = Math.max(1500, speakableIndexes.length * 210);
  const progress = Math.min(0.995, elapsed / estimatedMs);
  return speakableIndexes[Math.min(speakableIndexes.length - 1, Math.floor(progress * speakableIndexes.length))];
}

function sizeClass(text: string) {
  if (text.length > 96) return "dense";
  if (text.length > 56) return "medium";
  return "short";
}

export function SpokenAnswer({ text, audio }: Props) {
  const tokens = useMemo(() => tokenizeSpeech(text), [text]);
  const [activeIndex, setActiveIndex] = useState(() => activeTokenIndex(tokens, audio.speechStartedAt));
  const speaking = audio.output === "speaking";

  useEffect(() => {
    if (!speaking || !audio.speechStartedAt) {
      setActiveIndex(-1);
      return;
    }
    const update = () => setActiveIndex(activeTokenIndex(tokens, audio.speechStartedAt));
    update();
    const timer = window.setInterval(update, 120);
    return () => window.clearInterval(timer);
  }, [audio.speechStartedAt, speaking, tokens]);

  return (
    <p className={`spoken-answer spoken-answer-${sizeClass(text)} ${speaking ? "is-speaking" : ""}`}>
      {tokens.map((token, index) => (
        <span
          key={`${index}-${token.value}`}
          className={`spoken-token ${token.speakable ? "speakable" : "punctuation"} ${index === activeIndex ? "active" : ""}`}
        >
          {token.value}
        </span>
      ))}
    </p>
  );
}
