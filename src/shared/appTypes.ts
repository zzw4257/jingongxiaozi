export type AppMode = "standby" | "chat" | "expert" | "map" | "duplex";

export type StandbyPhase = "idle" | "listening";

export type AudioChainState = {
  input: "idle" | "wake" | "listening" | "processing";
  output: "idle" | "speaking";
  source: "none" | "touch" | "backend" | "mock";
  level?: number;
  message?: string;
  speechStartedAt?: number;
  voiceLabel?: string;
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
  | { type: "map"; request: MapDirectRequest; audio?: Partial<AudioChainState> }
  | { type: "navigation.next"; routeId?: string; audio?: Partial<AudioChainState> }
  | { type: "navigation.previous"; routeId?: string; audio?: Partial<AudioChainState> }
  | { type: "navigation.status"; routeId?: string; audio?: Partial<AudioChainState> }
  | { type: "navigation.focus"; routeId?: string; audio?: Partial<AudioChainState> }
  | { type: "navigation.calibrate_heading"; routeId?: string; audio?: Partial<AudioChainState> };

export type MapDirectRequest = {
  startRoomId?: string;
  targetRoomId?: string;
  layerMode?: "single" | "twoFloor" | "allFloors" | "exploded" | "section" | "raised202";
  activeFloor?: "1F" | "2F";
  announce?: Array<"summary" | "distance" | "direction" | "floorChange">;
};

export type NavigationProgressPayload = {
  type: "navigation_progress";
  routeId: string;
  activeLegIndex: number;
  totalLegs: number;
  routeSummary: string;
  fromLabel: string;
  checkpointLabel: string;
  checkpointKind: "door" | "corridor" | "turn" | "stair" | "room" | "destination";
  instruction: string;
  distanceMeters: number;
  remainingMeters: number;
  remainingSeconds: number;
  completed: boolean;
  announce: boolean;
  reason: "route_started" | "step_changed" | "manual_next" | "manual_previous" | "status_requested" | "completed";
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
    }
  | {
      mode: "duplex";
      audio: AudioChainState;
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
