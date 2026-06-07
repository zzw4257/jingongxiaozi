export type AppMode = "standby" | "chat" | "expert" | "map";

export type StandbyPhase = "idle" | "listening";

export type AudioChainState = {
  input: "idle" | "wake" | "listening" | "processing";
  output: "idle" | "speaking";
  source: "none" | "touch" | "backend" | "mock";
  level?: number;
  message?: string;
};

export type Citation = {
  title: string;
  source: string;
  excerpt?: string;
};

export type BackendDirective =
  | { type: "idle"; emotion?: string }
  | { type: "wake"; level?: number; hint?: string }
  | { type: "listening"; hint?: string; level?: number }
  | { type: "processing"; hint?: string }
  | { type: "chat"; answer: string; keywords?: string[]; audio?: Partial<AudioChainState> }
  | { type: "expert"; answer: string; citations?: Citation[]; keywords?: string[]; audio?: Partial<AudioChainState> }
  | { type: "map"; request: MapDirectRequest; audio?: Partial<AudioChainState> };

export type MapDirectRequest = {
  startRoomId?: string;
  targetRoomId?: string;
  layerMode?: "single" | "twoFloor" | "allFloors" | "exploded" | "section" | "raised202";
  activeFloor?: "1F" | "2F";
  announce?: Array<"summary" | "distance" | "direction" | "floorChange">;
};

export type AppState =
  | {
      mode: "standby";
      phase: StandbyPhase;
      emotion: string;
      audio: AudioChainState;
      listeningHint?: string;
    }
  | {
      mode: "chat";
      answer: string;
      keywords: string[];
      audio: AudioChainState;
    }
  | {
      mode: "expert";
      answer: string;
      keywords: string[];
      citations: Citation[];
      audio: AudioChainState;
    }
  | {
      mode: "map";
      audio: AudioChainState;
      request?: MapDirectRequest;
    };

export const DEFAULT_AUDIO_STATE: AudioChainState = {
  input: "idle",
  output: "idle",
  source: "none",
};

export const DEFAULT_APP_STATE: AppState = {
  mode: "standby",
  phase: "idle",
  emotion: "neutral",
  audio: DEFAULT_AUDIO_STATE,
};
