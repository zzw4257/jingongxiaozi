import { Mic2, Radio, Volume2 } from "lucide-react";
import type { AudioChainState } from "./appTypes";

type Props = {
  audio: AudioChainState;
  compact?: boolean;
};

function statusText(audio: AudioChainState) {
  if (audio.output === "speaking") return audio.message ?? "正在播报";
  if (audio.input === "processing") return audio.message ?? "正在理解";
  if (audio.input === "listening") return audio.message ?? "正在聆听";
  if (audio.input === "wake") return audio.message ?? "近场唤醒";
  return audio.message ?? "待机";
}

export function AudioStatus({ audio, compact = false }: Props) {
  const active = audio.output === "speaking" || audio.input !== "idle";
  const level = Math.max(0.08, Math.min(1, audio.level ?? (active ? 0.58 : 0.18)));
  const bars = Array.from({ length: compact ? 7 : 13 });

  return (
    <div className={`audio-status ${active ? "active" : ""} ${compact ? "compact" : ""}`} data-input={audio.input} data-output={audio.output}>
      <div className="audio-status-icon" aria-hidden="true">
        {audio.output === "speaking" ? <Volume2 size={compact ? 18 : 22} /> : audio.input === "processing" ? <Radio size={compact ? 18 : 22} /> : <Mic2 size={compact ? 18 : 22} />}
      </div>
      <div className="audio-status-body">
        <span>{statusText(audio)}</span>
        <div className="audio-meter" aria-hidden="true">
          {bars.map((_, index) => (
            <i
              key={index}
              style={{
                animationDelay: `${index * 58}ms`,
                transform: `scaleY(${0.45 + level * (((index % 4) + 1) / 4)})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
