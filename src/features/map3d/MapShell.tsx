import { Layers3 } from "lucide-react";
import { useState } from "react";
import type { MapDirectRequest } from "../../shared/appTypes";
import { MapApp as LegacyMapApp } from "../map/MapApp";
import { Map3DApp } from "./Map3DApp";

type Props = {
  initialRequest?: MapDirectRequest;
  entrySource: "manual" | "backend";
  onExit?: () => void;
};

function shouldDefaultToLegacyMap() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const runtimeWindow = window as Window & { isTauri?: boolean; __TAURI_INTERNALS__?: unknown };
  return /Android/i.test(navigator.userAgent) && Boolean(runtimeWindow.isTauri || runtimeWindow.__TAURI_INTERNALS__);
}

export function MapShell({ initialRequest, entrySource, onExit }: Props) {
  const [version, setVersion] = useState<"model3d" | "legacy">(() => (shouldDefaultToLegacyMap() ? "legacy" : "model3d"));

  if (version === "legacy") {
    return (
      <div className="legacy-map-wrapper">
        <button className="legacy-return-chip" onClick={() => setVersion("model3d")} title="返回 3D 精确模型地图">
          <Layers3 size={18} />
          <span>3D 精确模型</span>
        </button>
        <LegacyMapApp initialRequest={initialRequest} entrySource={entrySource} onExit={onExit} />
      </div>
    );
  }

  return (
    <Map3DApp
      initialRequest={initialRequest}
      entrySource={entrySource}
      onExit={onExit}
      onOpenLegacy={() => setVersion("legacy")}
    />
  );
}
