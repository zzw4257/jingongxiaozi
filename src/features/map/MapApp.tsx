import { ArrowLeft, Compass, Layers, Map as MapIcon, Maximize2, RotateCcw, Route, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import mapLayered from "../../assets/ui/map-layered.png";
import roomCardAsset from "../../assets/ui/room-card.png";
import routeStairs from "../../assets/ui/route-stairs.png";
import type { MapDirectRequest } from "../../shared/appTypes";
import { areaLabels, jingongMapData } from "./data/mapData";
import { MapCanvas } from "./components/MapCanvas";
import { calculateRoute, formatSeconds, getRoomById } from "./routeService";
import type { AreaType, FloorId, MapRoom, MapSessionState, RouteResult } from "./types";

type Props = {
  initialRequest?: MapDirectRequest;
  entrySource: "manual" | "backend";
  onExit?: () => void;
};

const defaultSession = (entrySource: "manual" | "backend", request?: MapDirectRequest): MapSessionState => ({
  entrySource,
  selectedRoomId: request?.targetRoomId,
  startRoomId: request?.startRoomId,
  targetRoomId: request?.targetRoomId,
  viewMode: "2_5d",
  layerMode: "exploded",
  activeFloor: undefined,
  announce: request?.announce ?? [],
});

const viewPresets: Array<{
  id: string;
  title: string;
  description: string;
  viewMode: MapSessionState["viewMode"];
  layerMode: MapSessionState["layerMode"];
  activeFloor?: FloorId;
}> = [
  {
    id: "overview",
    title: "2.5D 分层总览",
    description: "默认展示上下层错位关系，适合跨层路线和建筑浏览。",
    viewMode: "2_5d",
    layerMode: "exploded",
  },
  {
    id: "one-floor",
    title: "一层平面",
    description: "只看一层空间。跨层路线会在本层楼梯处断点提示。",
    viewMode: "2d",
    layerMode: "single",
    activeFloor: "1F",
  },
  {
    id: "two-floor",
    title: "二层平面",
    description: "只看二层空间。用于确认二层房间、门点和内部楼梯。",
    viewMode: "2d",
    layerMode: "single",
    activeFloor: "2F",
  },
  {
    id: "compare",
    title: "一二层对照",
    description: "上下分开显示，适合核对楼梯上下落点和层间对应。",
    viewMode: "2d",
    layerMode: "twoFloor",
  },
];

export function MapApp({ initialRequest, entrySource, onExit }: Props) {
  const [session, setSession] = useState<MapSessionState>(() => defaultSession(entrySource, initialRequest));
  const [areaFilter, setAreaFilter] = useState<AreaType | "all">("all");
  const [zoom, setZoom] = useState(1);
  const [viewAngle, setViewAngle] = useState(0);
  const [detailRoomId, setDetailRoomId] = useState<string | undefined>();
  const [mobileSheet, setMobileSheet] = useState<"none" | "route" | "layers" | "room" | "debug">("none");
  const orbitDrag = useRef<{ pointerId: number; startX: number; startAngle: number; moved: boolean } | undefined>();
  const suppressRoomTapUntil = useRef(0);

  useEffect(() => {
    setSession(defaultSession(entrySource, initialRequest));
  }, [entrySource, initialRequest]);

  const startRoomId = session.startRoomId ?? (session.targetRoomId ? jingongMapData.defaultStartRoomId : undefined);
  const route = useMemo<RouteResult | undefined>(() => {
    if (!startRoomId || !session.targetRoomId) return undefined;
    return calculateRoute(jingongMapData, startRoomId, session.targetRoomId);
  }, [session.targetRoomId, startRoomId]);

  const selectedRoom = getRoomById(jingongMapData, session.selectedRoomId);
  const targetRoom = getRoomById(jingongMapData, session.targetRoomId);
  const startRoom = getRoomById(jingongMapData, startRoomId);

  const rooms = useMemo(() => {
    return jingongMapData.rooms.filter((room) => {
      if (areaFilter !== "all" && room.area !== areaFilter) return false;
      if (session.layerMode === "single" && session.activeFloor && room.floor !== session.activeFloor) return false;
      if (session.layerMode === "twoFloor") return room.floor === "1F" || room.floor === "2F";
      return true;
    });
  }, [areaFilter, session.activeFloor, session.layerMode]);

  const updateRouteEndpoint = (key: "startRoomId" | "targetRoomId", roomId: string) => {
    setSession((current) => ({
      ...current,
      [key]: roomId || undefined,
      selectedRoomId: key === "targetRoomId" ? roomId || current.selectedRoomId : current.selectedRoomId,
      routeId: undefined,
    }));
  };

  const handleRoomClick = (room: MapRoom) => {
    if (orbitDrag.current?.moved || Date.now() < suppressRoomTapUntil.current) return;
    setSession((current) => ({ ...current, selectedRoomId: room.id }));
    setMobileSheet("room");
  };

  const handleRoomDoubleClick = (room: MapRoom) => {
    setDetailRoomId(room.id);
    setSession((current) => ({ ...current, selectedRoomId: room.id }));
  };

  const startNavigationToSelected = () => {
    if (!session.selectedRoomId) return;
    setSession((current) => ({
      ...current,
      targetRoomId: current.selectedRoomId,
      startRoomId: current.startRoomId,
      routeId: `${current.startRoomId ?? jingongMapData.defaultStartRoomId}->${current.selectedRoomId}`,
    }));
  };

  const clearRoute = () => {
    setSession((current) => ({
      ...current,
      targetRoomId: undefined,
      startRoomId: undefined,
      routeId: undefined,
      announce: [],
    }));
  };

  const detailRoom = getRoomById(jingongMapData, detailRoomId);

  const applyViewPreset = (preset: (typeof viewPresets)[number]) => {
    setSession((current) => ({
      ...current,
      viewMode: preset.viewMode,
      layerMode: preset.layerMode,
      activeFloor: preset.activeFloor,
    }));
    setZoom(1);
    setViewAngle(0);
  };

  const closeMobileSheet = () => {
    setMobileSheet("none");
  };

  const beginOrbitDrag = (event: PointerEvent<HTMLElement>) => {
    if (session.viewMode !== "2_5d") return;
    const target = event.target as HTMLElement;
    if (target.closest("button, select, .route-panel, .room-popover, .map-sidebar, .map-tools")) return;
    orbitDrag.current = { pointerId: event.pointerId, startX: event.clientX, startAngle: viewAngle, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveOrbitDrag = (event: PointerEvent<HTMLElement>) => {
    if (!orbitDrag.current || orbitDrag.current.pointerId !== event.pointerId) return;
    const delta = event.clientX - orbitDrag.current.startX;
    if (Math.abs(delta) > 8) orbitDrag.current.moved = true;
    setViewAngle((orbitDrag.current.startAngle + delta * 0.35 + 360) % 360);
  };

  const endOrbitDrag = (event: PointerEvent<HTMLElement>) => {
    if (orbitDrag.current?.pointerId === event.pointerId) {
      if (orbitDrag.current.moved) suppressRoomTapUntil.current = Date.now() + 260;
      window.setTimeout(() => {
        orbitDrag.current = undefined;
      }, 0);
    }
  };

  return (
    <div className="map-app">
      <div className="map-mobile-rail" aria-label="地图快捷操作">
        {onExit && (
          <button onClick={onExit} title="返回待机">
            <ArrowLeft size={22} />
            <span>返回</span>
          </button>
        )}
        <button className={mobileSheet === "route" ? "active" : ""} onClick={() => setMobileSheet((sheet) => (sheet === "route" ? "none" : "route"))} title="路线">
          <Route size={22} />
          <span>路线</span>
        </button>
        <button className={mobileSheet === "layers" ? "active" : ""} onClick={() => setMobileSheet((sheet) => (sheet === "layers" ? "none" : "layers"))} title="视图和楼层">
          <Layers size={22} />
          <span>图层</span>
        </button>
        <button onClick={() => setViewAngle((current) => (current + 45) % 360)} title="切换视角">
          <Compass size={22} />
          <span>视角</span>
        </button>
        <button onClick={() => { setZoom(1); setViewAngle(0); setSession((current) => ({ ...current, viewMode: "2_5d", layerMode: "exploded", activeFloor: undefined })); }} title="回到总览">
          <Maximize2 size={22} />
          <span>总览</span>
        </button>
      </div>

      <aside className="map-sidebar">
        <section className="sidebar-section">
          <h3>
            <Layers size={16} />
            楼层切换
          </h3>
          <button className={session.activeFloor === "1F" ? "control active" : "control"} onClick={() => setSession((current) => ({ ...current, activeFloor: "1F", layerMode: "single" }))}>
            一层
          </button>
          <button className={session.activeFloor === "2F" ? "control active" : "control"} onClick={() => setSession((current) => ({ ...current, activeFloor: "2F", layerMode: "single" }))}>
            二层
          </button>
        </section>

        <section className="sidebar-section">
          <h3>
            <MapIcon size={16} />
            视图模式
          </h3>
          <button className={session.viewMode === "2d" ? "control active" : "control"} onClick={() => setSession((current) => ({ ...current, viewMode: "2d" }))}>
            2D
          </button>
          <button className={session.viewMode === "2_5d" ? "control active" : "control"} onClick={() => setSession((current) => ({ ...current, viewMode: "2_5d" }))}>
            2.5D
          </button>
        </section>

        <section className="sidebar-section">
          <h3>
            <Layers size={16} />
            图层筛选
          </h3>
          {[
            ["allFloors", "全部楼层"],
            ["single", "仅当前层"],
            ["twoFloor", "一二层"],
            ["exploded", "分层展开"],
          ].map(([mode, label]) => (
            <button key={mode} className={session.layerMode === mode ? "control active soft" : "control"} onClick={() => setSession((current) => ({ ...current, layerMode: mode as MapSessionState["layerMode"] }))}>
              {label}
            </button>
          ))}
        </section>

        <section className="sidebar-section">
          <h3>
            <Search size={16} />
            功能区
          </h3>
          <button className={areaFilter === "all" ? "control active soft" : "control"} onClick={() => setAreaFilter("all")}>
            全部空间
          </button>
          {(Object.keys(areaLabels) as AreaType[]).map((area) => (
            <button key={area} className={areaFilter === area ? "control active soft" : "control"} onClick={() => setAreaFilter(area)}>
              {areaLabels[area]}
            </button>
          ))}
        </section>
      </aside>

      <section
        className="map-stage"
        onPointerDown={beginOrbitDrag}
        onPointerMove={moveOrbitDrag}
        onPointerUp={endOrbitDrag}
        onPointerCancel={endOrbitDrag}
      >
        <div className="map-topbar">
          <div>
            <span className="crumb">当前位置：</span>
            <strong>{selectedRoom ? `${selectedRoom.floor} / ${selectedRoom.roomNo} ${selectedRoom.name}` : "金工中心总览"}</strong>
          </div>
          <div className="segmented">
            <button className={session.layerMode === "allFloors" ? "selected" : ""} onClick={() => setSession((current) => ({ ...current, layerMode: "allFloors", activeFloor: undefined }))}>
              全部楼层
            </button>
            <button className={session.activeFloor === "1F" ? "selected" : ""} onClick={() => setSession((current) => ({ ...current, layerMode: "single", activeFloor: "1F" }))}>
              仅一层
            </button>
            <button className={session.activeFloor === "2F" ? "selected" : ""} onClick={() => setSession((current) => ({ ...current, layerMode: "single", activeFloor: "2F" }))}>
              仅二层
            </button>
            <button className={session.layerMode === "exploded" ? "selected" : ""} onClick={() => setSession((current) => ({ ...current, layerMode: "exploded", activeFloor: undefined }))}>
              分层展开
            </button>
          </div>
        </div>

        <MapCanvas
          rooms={rooms}
          allRooms={jingongMapData.rooms}
          selectedRoomId={session.selectedRoomId}
          targetRoomId={session.targetRoomId}
          startRoomId={startRoomId}
          route={route}
          viewMode={session.viewMode}
          layerMode={session.layerMode}
          zoom={zoom}
          rotation={viewAngle}
          onRoomClick={handleRoomClick}
          onRoomDoubleClick={handleRoomDoubleClick}
        />

        {selectedRoom && (
          <article className="room-popover">
            <button className="icon-button close" onClick={() => setSession((current) => ({ ...current, selectedRoomId: undefined }))}>
              <X size={16} />
            </button>
            <span className="badge">{areaLabels[selectedRoom.area]}</span>
            <h3>
              {selectedRoom.roomNo} {selectedRoom.name}
            </h3>
            <p>{selectedRoom.description}</p>
            <div className="tag-row">
              {selectedRoom.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="room-actions">
              <button onClick={() => setDetailRoomId(selectedRoom.id)}>查看详情</button>
              <button className="primary-action" onClick={startNavigationToSelected}>
                开始导航
              </button>
            </div>
          </article>
        )}

        <div className="map-tools">
          <button onClick={() => setZoom((current) => Math.min(1.8, current + 0.1))}>+</button>
          <button onClick={() => setZoom((current) => Math.max(0.65, current - 0.1))}>-</button>
          <button onClick={() => setViewAngle((current) => (current + 45) % 360)} title="切换视角">
            <Compass size={18} />
          </button>
          <button onClick={() => { setZoom(1); setViewAngle(0); }}>
            <RotateCcw size={18} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>

        <div className="map-legend">
          <strong>图例</strong>
          {Object.entries(areaLabels).map(([area, label]) => (
            <span key={area} className={`legend-item area-${area}`}>
              <i />
              {label}
            </span>
          ))}
          <span className="legend-item">
            <b className="route-sample" />
            推荐路线
          </span>
          <span className="scale-bar">0 —— 5m —— 10m —— 20m</span>
        </div>
      </section>

      <aside className="route-panel">
        <div className="panel-title">
          <span>
            <Route size={17} />
            路径导航
          </span>
          <button className="icon-button" onClick={clearRoute} title="清除路线">
            <X size={16} />
          </button>
        </div>

        <label>
          起点
          <select value={startRoomId ?? ""} onChange={(event) => updateRouteEndpoint("startRoomId", event.target.value)}>
            <option value="">使用默认 101</option>
            {jingongMapData.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNo} {room.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          终点
          <select value={session.targetRoomId ?? ""} onChange={(event) => updateRouteEndpoint("targetRoomId", event.target.value)}>
            <option value="">未选择</option>
            {jingongMapData.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNo} {room.name}
              </option>
            ))}
          </select>
        </label>

        {route ? (
          <section className="route-summary">
            <strong>推荐路线</strong>
            <div className="metric-grid">
              <div>
                <span>总距离</span>
                <b>{route.totalMeters}m</b>
              </div>
              <div>
                <span>预计步行</span>
                <b>{formatSeconds(route.estimatedSeconds)}</b>
              </div>
            </div>
            <ol>
              {route.announceLines.slice(2, 8).map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ol>
            <p className="route-hint">按比例尺 1 单位约 {jingongMapData.scaleMetersPerUnit}m 估算。</p>
          </section>
        ) : (
          <section className="empty-route">
            <strong>尚未生成路线</strong>
            <p>选择终点或点击房间卡片中的“开始导航”。</p>
          </section>
        )}

        {session.entrySource === "backend" && (
          <section className="backend-note">
            <strong>后端启动参数</strong>
            <p>本次由 MapDirect 打开，但当前地图状态可继续手动修改。</p>
          </section>
        )}

        <section className="room-mini">
          <strong>当前选择</strong>
          <span>{selectedRoom ? `${selectedRoom.roomNo} ${selectedRoom.name}` : "未选择房间"}</span>
          <span>起点：{startRoom ? `${startRoom.roomNo} ${startRoom.name}` : "默认 101"}</span>
          <span>终点：{targetRoom ? `${targetRoom.roomNo} ${targetRoom.name}` : "未选择"}</span>
        </section>
      </aside>

      {mobileSheet !== "none" && (
        <div className="mobile-sheet-backdrop" onClick={closeMobileSheet}>
          <section className={`map-mobile-sheet sheet-${mobileSheet}`} onClick={(event) => event.stopPropagation()}>
            <button className="sheet-handle" aria-label="收起面板" onClick={closeMobileSheet} />
            <div className="sheet-title">
              <strong>
                {mobileSheet === "route" && "路线导航"}
                {mobileSheet === "layers" && "视图与楼层"}
                {mobileSheet === "room" && "空间信息"}
                {mobileSheet === "debug" && "调试"}
              </strong>
              <button className="icon-button" onClick={() => setMobileSheet("none")} title="关闭">
                <X size={18} />
              </button>
            </div>

            {mobileSheet === "layers" && (
              <div className="mobile-preset-list">
                <img className="sheet-asset sheet-map-asset" src={mapLayered} alt="" draggable={false} />
                {viewPresets.map((preset) => {
                  const active =
                    session.viewMode === preset.viewMode &&
                    session.layerMode === preset.layerMode &&
                    session.activeFloor === preset.activeFloor;
                  return (
                    <button key={preset.id} className={active ? "preset-card active" : "preset-card"} onClick={() => applyViewPreset(preset)}>
                      <span>{preset.title}</span>
                      <small>{preset.description}</small>
                    </button>
                  );
                })}
                <div className="mobile-orbit-controls">
                  <button onClick={() => setViewAngle((current) => (current + 45) % 360)}>旋转视角</button>
                  <button onClick={() => { setZoom((current) => Math.min(1.5, current + 0.1)); }}>放大</button>
                  <button onClick={() => { setZoom((current) => Math.max(0.78, current - 0.1)); }}>缩小</button>
                </div>
              </div>
            )}

            {mobileSheet === "route" && (
              <div className="mobile-route-content">
                <img className="sheet-asset sheet-route-asset" src={routeStairs} alt="" draggable={false} />
                <label>
                  起点
                  <select value={startRoomId ?? ""} onChange={(event) => updateRouteEndpoint("startRoomId", event.target.value)}>
                    <option value="">使用默认 101</option>
                    {jingongMapData.rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.roomNo} {room.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  终点
                  <select value={session.targetRoomId ?? ""} onChange={(event) => updateRouteEndpoint("targetRoomId", event.target.value)}>
                    <option value="">未选择</option>
                    {jingongMapData.rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.roomNo} {room.name}</option>
                    ))}
                  </select>
                </label>
                {route ? (
                  <section className="route-summary mobile">
                    <div className="metric-grid">
                      <div><span>总距离</span><b>{route.totalMeters}m</b></div>
                      <div><span>预计步行</span><b>{formatSeconds(route.estimatedSeconds)}</b></div>
                    </div>
                    <ol>
                      {route.announceLines.slice(2, 6).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
                    </ol>
                  </section>
                ) : (
                  <p className="sheet-empty">选择终点后显示推荐路线。</p>
                )}
                <button className="sheet-danger" onClick={clearRoute}>清除路线</button>
              </div>
            )}

            {mobileSheet === "room" && selectedRoom && (
              <div className="mobile-room-content">
                <img className="sheet-asset sheet-room-asset" src={roomCardAsset} alt="" draggable={false} />
                <span className="badge">{areaLabels[selectedRoom.area]}</span>
                <h3>{selectedRoom.roomNo} {selectedRoom.name}</h3>
                <p>{selectedRoom.description}</p>
                <div className="tag-row">
                  {selectedRoom.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="room-actions">
                  <button onClick={() => setDetailRoomId(selectedRoom.id)}>查看详情</button>
                  <button className="primary-action" onClick={startNavigationToSelected}>开始导航</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {detailRoom && (
        <div className="detail-backdrop" onClick={() => setDetailRoomId(undefined)}>
          <article className="detail-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button close" onClick={() => setDetailRoomId(undefined)}>
              <X size={18} />
            </button>
            <span className="badge">{detailRoom.floor} / {areaLabels[detailRoom.area]}</span>
            <h2>{detailRoom.roomNo} {detailRoom.name}</h2>
            <div className="image-placeholder">{detailRoom.imagePlaceholder}</div>
            <p>{detailRoom.description}</p>
            <div className="tag-row">
              {detailRoom.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <button className="primary-action" onClick={() => { updateRouteEndpoint("targetRoomId", detailRoom.id); setDetailRoomId(undefined); }}>
              设为导航终点
            </button>
          </article>
        </div>
      )}
    </div>
  );
}
