export type AppMode = "standby" | "chat" | "expert" | "map";

export type StandbyPhase = "idle" | "listening";

export type Citation = {
  title: string;
  source: string;
  excerpt?: string;
};

export type BackendDirective =
  | { type: "idle"; emotion?: string }
  | { type: "listening"; hint?: string }
  | { type: "chat"; answer: string; keywords?: string[] }
  | { type: "expert"; answer: string; citations?: Citation[]; keywords?: string[] }
  | { type: "map"; request: MapDirectRequest };

export type MapDirectRequest = {
  startRoomId?: string;
  targetRoomId?: string;
  announce?: Array<"summary" | "distance" | "direction" | "floorChange">;
};

export type AppState =
  | {
      mode: "standby";
      phase: StandbyPhase;
      emotion: string;
      listeningHint?: string;
    }
  | {
      mode: "chat";
      answer: string;
      keywords: string[];
    }
  | {
      mode: "expert";
      answer: string;
      keywords: string[];
      citations: Citation[];
    }
  | {
      mode: "map";
      request?: MapDirectRequest;
    };

export const DEFAULT_APP_STATE: AppState = {
  mode: "standby",
  phase: "idle",
  emotion: "neutral",
};
