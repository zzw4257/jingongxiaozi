export type MiniProgramMapMessage =
  | { type: "map-ready"; title: string; hasRoute: boolean; request?: unknown }
  | { type: "map-state"; title: string; panel?: string; layerMode?: string; activeFloor?: string; routeStep?: string }
  | { type: "map-direct"; request?: unknown };

export function postMiniProgramMessage(message: MiniProgramMapMessage) {
  const wxBridge = typeof window !== "undefined" ? (window as Window & { wx?: { miniProgram?: { postMessage?: (payload: { data: MiniProgramMapMessage }) => void } } }).wx : undefined;
  wxBridge?.miniProgram?.postMessage?.({ data: message });
}
