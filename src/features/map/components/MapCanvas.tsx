import { jingongMapData } from "../data/mapData";
import type {
  DoorSegment,
  FloorGeometry,
  FloorId,
  MapRoom,
  MapSessionState,
  Point,
  RouteResult,
  StairGeometry,
  WallSegment,
} from "../types";

type Props = {
  rooms: MapRoom[];
  allRooms: MapRoom[];
  selectedRoomId?: string;
  targetRoomId?: string;
  startRoomId?: string;
  route?: RouteResult;
  viewMode: MapSessionState["viewMode"];
  layerMode: MapSessionState["layerMode"];
  zoom: number;
  rotation: number;
  onRoomClick: (room: MapRoom) => void;
  onRoomDoubleClick: (room: MapRoom) => void;
};

type ProjectedFloor = {
  floor: FloorGeometry;
  base: Point;
  scale: number;
  skew: Point;
  yaw: number;
  zLift: number;
  wallLift: number;
};

const WORLD_BOUNDS = {
  minX: 40,
  minY: 0,
  maxX: 1200,
  maxY: 720,
};

const FLAT_SINGLE_TARGETS: Record<FloorId, { base: Point; scale: number }> = {
  "1F": { base: [72, 74], scale: 0.87 },
  "2F": { base: [74, 54], scale: 0.88 },
};

const FLAT_SPLIT_TARGETS: Record<FloorId, { base: Point; scale: number }> = {
  "2F": { base: [188, 34], scale: 0.56 },
  "1F": { base: [168, 370], scale: 0.56 },
};

const ISO_TARGETS: Record<MapSessionState["layerMode"], Record<FloorId, { base: Point; scale: number; zLift: number }>> = {
  single: {
    "1F": { base: [118, 128], scale: 0.82, zLift: 0 },
    "2F": { base: [118, 104], scale: 0.82, zLift: 0 },
  },
  twoFloor: {
    "1F": { base: [102, 382], scale: 0.49, zLift: 0 },
    "2F": { base: [222, 190], scale: 0.49, zLift: 62 },
  },
  allFloors: {
    "1F": { base: [102, 382], scale: 0.49, zLift: 0 },
    "2F": { base: [222, 190], scale: 0.49, zLift: 62 },
  },
  exploded: {
    "1F": { base: [112, 392], scale: 0.48, zLift: 0 },
    "2F": { base: [244, 198], scale: 0.48, zLift: 62 },
  },
};

function orbitView(angleDegrees: number): { skew: Point; offset: Point; yaw: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    skew: [0.22, -0.16],
    offset: [52 + 20 * Math.sin(radians), 54 + 14 * Math.cos(radians)],
    yaw: radians * 0.72,
  };
}

const areaClass = (room: MapRoom) => `space-fill area-${room.area}`;

const compactText = (value: string): string =>
  value
    .replace("智能制造创新创业实验室", "智能制造")
    .replace("CAD/CAM 云设计中心", "CAD/CAM")
    .replace("WEDM 编程设计", "WEDM 编程")
    .replace("数字化制造中心", "数字化中心");

const ellipsize = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const visibleFloorIds = (rooms: MapRoom[]): FloorId[] => {
  const ids = new Set(rooms.map((room) => room.floor));
  return (["2F", "1F"] as FloorId[]).filter((floor) => ids.has(floor));
};

const pointList = (points: Point[]): string => points.map((point) => `${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");

const polygonCenter = (polygon: Point[]): Point => {
  const total = polygon.reduce<Point>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
};

function flatProject(point: Point, floor: FloorId, layerMode: Props["layerMode"]): Point {
  const target = layerMode === "single" ? FLAT_SINGLE_TARGETS[floor] : FLAT_SPLIT_TARGETS[floor];
  return [
    target.base[0] + (point[0] - WORLD_BOUNDS.minX) * target.scale,
    target.base[1] + (point[1] - WORLD_BOUNDS.minY) * target.scale,
  ];
}

function isoFloor(floor: FloorGeometry, layerMode: Props["layerMode"], rotation: number): ProjectedFloor {
  const target = ISO_TARGETS[layerMode][floor.id] ?? ISO_TARGETS.exploded[floor.id];
  const angle = orbitView(rotation);
  return {
    floor,
    base: [target.base[0] + angle.offset[0], target.base[1] + angle.offset[1]],
    scale: target.scale,
    skew: angle.skew,
    yaw: angle.yaw,
    zLift: target.zLift,
    wallLift: floor.height * 0.34,
  };
}

function isoProject(point: Point, floorProjector: ProjectedFloor): Point {
  const centerX = (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / 2;
  const centerY = (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY) / 2;
  const rawX = point[0] - WORLD_BOUNDS.minX - centerX;
  const rawY = point[1] - WORLD_BOUNDS.minY - centerY;
  const cos = Math.cos(floorProjector.yaw);
  const sin = Math.sin(floorProjector.yaw);
  const x = rawX * cos - rawY * sin + centerX;
  const y = rawX * sin + rawY * cos + centerY;
  return [
    floorProjector.base[0] + x * floorProjector.scale + y * floorProjector.scale * floorProjector.skew[0],
    floorProjector.base[1] + y * floorProjector.scale + x * floorProjector.scale * floorProjector.skew[1] - floorProjector.zLift,
  ];
}

function projectPoint(point: Point, floor: FloorId, viewMode: Props["viewMode"], layerMode: Props["layerMode"], rotation = 0): Point {
  if (viewMode === "2d") return flatProject(point, floor, layerMode);
  const floorGeometry = jingongMapData.floors.find((candidate) => candidate.id === floor)!;
  return isoProject(point, isoFloor(floorGeometry, layerMode, rotation));
}

function projectPolygon(points: Point[], floor: FloorId, viewMode: Props["viewMode"], layerMode: Props["layerMode"], rotation = 0): Point[] {
  return points.map((point) => projectPoint(point, floor, viewMode, layerMode, rotation));
}

function wallFacePoints(wall: WallSegment, viewMode: Props["viewMode"], layerMode: Props["layerMode"], rotation = 0): Point[] {
  const topA = projectPoint(wall.from, wall.floor, viewMode, layerMode, rotation);
  const topB = projectPoint(wall.to, wall.floor, viewMode, layerMode, rotation);
  if (viewMode === "2d") return [topA, topB];
  const floor = jingongMapData.floors.find((candidate) => candidate.id === wall.floor)!;
  const lift = isoFloor(floor, layerMode, rotation).wallLift;
  return [topA, topB, [topB[0], topB[1] + lift], [topA[0], topA[1] + lift]];
}

function roomById(roomId?: string): MapRoom | undefined {
  return jingongMapData.rooms.find((room) => room.id === roomId);
}

function routeDisplayPoints(route: RouteResult | undefined, viewMode: Props["viewMode"], layerMode: Props["layerMode"], rotation = 0): Point[] {
  if (!route) return [];
  return route.points.map((point) => projectPoint(point.point, point.floor, viewMode, layerMode, rotation));
}

function routeDisplaySegments(
  route: RouteResult | undefined,
  viewMode: Props["viewMode"],
  layerMode: Props["layerMode"],
  floorIds: FloorId[],
  rotation = 0,
): Point[][] {
  if (!route) return [];
  const visible = new Set(floorIds);
  const segments: Point[][] = [];
  let current: Point[] = [];

  route.points.forEach((routePoint) => {
    if (!visible.has(routePoint.floor)) {
      if (current.length > 1) segments.push(current);
      current = [];
      return;
    }

    current.push(projectPoint(routePoint.point, routePoint.floor, viewMode, layerMode, rotation));
  });

  if (current.length > 1) segments.push(current);
  return segments;
}

function renderFloor(floor: FloorGeometry, viewMode: Props["viewMode"], layerMode: Props["layerMode"], rotation = 0) {
  const outline = projectPolygon(floor.outline, floor.id, viewMode, layerMode, rotation);
  if (viewMode === "2d") {
    return (
      <g key={floor.id} className={`floor-geometry flat-floor ${floor.id === "1F" ? "onef" : "twof"}`}>
        <polygon points={pointList(outline)} className="floor-shell-flat" />
        {floor.corridorPolygons.map((corridor, index) => (
          <polygon key={`${floor.id}-corridor-${index}`} points={pointList(projectPolygon(corridor, floor.id, viewMode, layerMode, rotation))} className="corridor-surface" />
        ))}
      </g>
    );
  }

  const floorProjector = isoFloor(floor, layerMode, rotation);
  const bottom = outline.map<Point>((point) => [point[0] + 26, point[1] + floorProjector.wallLift + 18]);
  return (
    <g key={floor.id} className={`floor-geometry iso-floor ${floor.id === "1F" ? "onef" : "twof"}`}>
      <polygon points={pointList(bottom)} className="floor-slab-side" />
      <polygon points={pointList(outline)} className="floor-shell-iso" />
      {floor.corridorPolygons.map((corridor, index) => (
        <polygon key={`${floor.id}-corridor-${index}`} points={pointList(projectPolygon(corridor, floor.id, viewMode, layerMode, rotation))} className="corridor-surface iso" />
      ))}
      <text x={outline[0][0] + 18} y={outline[0][1] + 34} className="floor-plate-label">
        {floor.label}
      </text>
    </g>
  );
}

function renderWalls(walls: WallSegment[], viewMode: Props["viewMode"], layerMode: Props["layerMode"], rotation = 0) {
  if (viewMode === "2d") {
    return walls.map((wall) => {
      const [a, b] = wallFacePoints(wall, viewMode, layerMode, rotation);
      return <line key={wall.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={`wall-line ${wall.kind}`} />;
    });
  }

  return walls
    .filter((wall) => wall.kind !== "inner" || wall.thickness > 1)
    .map((wall) => (
      <polygon key={wall.id} points={pointList(wallFacePoints(wall, viewMode, layerMode, rotation))} className={`wall-face ${wall.kind}`} />
    ));
}

function renderDoors(doors: DoorSegment[], visibleRooms: MapRoom[], viewMode: Props["viewMode"], layerMode: Props["layerMode"], rotation = 0) {
  const visibleRoomIds = new Set(visibleRooms.map((room) => room.id));
  return doors
    .filter((door) => visibleRoomIds.has(door.connects[0]))
    .map((door) => {
      const point = projectPoint(door.point, door.floor, viewMode, layerMode, rotation);
      return <circle key={door.id} cx={point[0]} cy={point[1]} r={viewMode === "2d" ? 4 : 5} className="door-gap" />;
    });
}

function renderStair(
  stair: StairGeometry,
  viewMode: Props["viewMode"],
  layerMode: Props["layerMode"],
  isOnRoute: boolean,
  floorIds: FloorId[],
  rotation = 0,
) {
  const showLower = floorIds.includes(stair.lowerFloor);
  const showUpper = floorIds.includes(stair.upperFloor);
  const lower = showLower ? projectPolygon(stair.lowerLanding, stair.lowerFloor, viewMode, layerMode, rotation) : undefined;
  const upper = showUpper ? projectPolygon(stair.upperLanding, stair.upperFloor, viewMode, layerMode, rotation) : undefined;
  const lowerCenter = lower ? polygonCenter(lower) : undefined;
  const upperCenter = upper ? polygonCenter(upper) : undefined;
  const showShaft = Boolean(isOnRoute && lowerCenter && upperCenter);
  return (
    <g key={stair.id} className={`stair-geometry ${stair.access} ${isOnRoute ? "on-route" : ""}`}>
      {lower && <polygon points={pointList(lower)} className="stair-landing lower" />}
      {upper && <polygon points={pointList(upper)} className="stair-landing upper" />}
      {showShaft && (
        <>
          <line x1={lowerCenter![0]} y1={lowerCenter![1]} x2={upperCenter![0]} y2={upperCenter![1]} className="stair-rise-link" />
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
            const x = lowerCenter![0] + (upperCenter![0] - lowerCenter![0]) * ratio;
            const y = lowerCenter![1] + (upperCenter![1] - lowerCenter![1]) * ratio;
            return <line key={ratio} x1={x - 10} y1={y + 4} x2={x + 10} y2={y - 4} className="stair-tread" />;
          })}
        </>
      )}
      {lowerCenter && <text x={lowerCenter[0] + 10} y={lowerCenter[1] - 10} className="stair-label lower-label">
        {stair.access === "internal" ? "内梯" : "楼梯"}
      </text>}
      {upperCenter && <text x={upperCenter[0] + 10} y={upperCenter[1] - 10} className="stair-label upper-label">
        {stair.label}
      </text>}
    </g>
  );
}

export function MapCanvas({
  rooms,
  allRooms,
  selectedRoomId,
  targetRoomId,
  startRoomId,
  route,
  viewMode,
  layerMode,
  zoom,
  rotation,
  onRoomClick,
  onRoomDoubleClick,
}: Props) {
  const floorIds = visibleFloorIds(rooms);
  const visibleRoomIds = new Set(rooms.map((room) => room.id));
  const visibleFloors = jingongMapData.floors.filter((floor) => floorIds.includes(floor.id));
  const visibleWalls = jingongMapData.walls.filter((wall) => floorIds.includes(wall.floor));
  const visibleDoors = jingongMapData.doors.filter((door) => floorIds.includes(door.floor));
  const viewRotation = viewMode === "2_5d" ? rotation : 0;
  const routeSegments = routeDisplaySegments(route, viewMode, layerMode, floorIds, viewRotation);
  const routeNodeIds = new Set(route?.steps.flatMap((step) => [step.fromNodeId, step.toNodeId]) ?? []);
  const startRoom = roomById(startRoomId);
  const targetRoom = roomById(targetRoomId);

  const roomCenter = (room: MapRoom): Point => projectPoint(room.labelPoint, room.floor, viewMode, layerMode, viewRotation);
  const pinPoint = (room?: MapRoom): Point | undefined => (room ? roomCenter(room) : undefined);
  const startPoint = pinPoint(startRoom);
  const targetPoint = pinPoint(targetRoom);

  return (
    <div className={`map-canvas-shell ${viewMode === "2_5d" ? "isometric" : "flat"}`}>
      <svg
        className="map-canvas"
        viewBox="0 0 1180 760"
        role="img"
        aria-label="金工中心建筑几何地图"
        style={{
          transform: `scale(${zoom})`,
        }}
      >
        <defs>
          <filter id="roomShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#63758c" floodOpacity="0.22" />
          </filter>
          <filter id="routeGlow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#086cff" floodOpacity="0.55" />
          </filter>
        </defs>

        <g className="map-world">
          {visibleFloors.map((floor) => renderFloor(floor, viewMode, layerMode, viewRotation))}

          {rooms.map((room) => {
            const points = projectPolygon(room.polygon, room.floor, viewMode, layerMode, viewRotation);
            const label = projectPoint(room.labelPoint, room.floor, viewMode, layerMode, viewRotation);
            const isSelected = selectedRoomId === room.id;
            const isTarget = targetRoomId === room.id;
            const isStart = startRoomId === room.id;
            const compactName = compactText(room.name);
            const showName = viewMode === "2d" ? room.rect.width > 76 && room.rect.height > 52 : room.rect.width > 120 && room.rect.height > 64;
            const shortNo = room.roomNo.length > 8 ? room.roomNo.replace("-2F", "·2").replace("-1F", "·1") : room.roomNo;
            const labelRoomNo = ellipsize(room.roomNo, viewMode === "2d" ? 9 : 7);
            const labelName = ellipsize(compactName, viewMode === "2d" ? 7 : 5);
            return (
              <g
                key={room.id}
                className={`room-group ${isSelected ? "selected" : ""} ${isTarget ? "target" : ""} ${isStart ? "start" : ""}`}
                onClick={() => onRoomClick(room)}
                onDoubleClick={() => onRoomDoubleClick(room)}
              >
                <polygon points={pointList(points)} className={areaClass(room)} filter={viewMode === "2_5d" ? "url(#roomShadow)" : undefined} />
                <text x={label[0]} y={label[1] - (showName ? 7 : 0)} className="room-no upright-label">
                  {viewMode === "2_5d" ? shortNo : labelRoomNo}
                </text>
                {showName && (
                  <text x={label[0]} y={label[1] + 12} className="room-name upright-label">
                  {labelName}
                  </text>
                )}
              </g>
            );
          })}

          <g className="wall-layer">{renderWalls(visibleWalls, viewMode, layerMode, viewRotation)}</g>
          <g className="door-layer">{renderDoors(visibleDoors, rooms, viewMode, layerMode, viewRotation)}</g>
          <g className="stair-layer">
            {jingongMapData.stairs
              .filter((stair) => floorIds.includes(stair.lowerFloor) || floorIds.includes(stair.upperFloor))
              .map((stair) => renderStair(stair, viewMode, layerMode, routeNodeIds.has(stair.lowerNodeId) && routeNodeIds.has(stair.upperNodeId), floorIds, viewRotation))}
          </g>

          {routeSegments.map((routePoints, index) => (
            <polyline key={`${route?.id ?? "route"}-${index}`} points={pointList(routePoints)} className="route-line" filter="url(#routeGlow)" />
          ))}

          {route?.points.map((routePoint, index) => {
            if (routePoint.kind !== "internal-stair" && routePoint.kind !== "stair") return null;
            if (!floorIds.includes(routePoint.floor)) return null;
            const point = projectPoint(routePoint.point, routePoint.floor, viewMode, layerMode, viewRotation);
            return <circle key={`${route.id}-stair-step-${index}`} cx={point[0]} cy={point[1]} r="9" className="route-stair-dot" />;
          })}

          {startPoint && visibleRoomIds.has(startRoomId ?? "") && (
            <g className="pin start-pin" transform={`translate(${startPoint[0]}, ${startPoint[1]})`}>
              <circle r="13" />
              <text y="5">起</text>
            </g>
          )}
          {targetPoint && visibleRoomIds.has(targetRoomId ?? "") && (
            <g className="pin target-pin" transform={`translate(${targetPoint[0]}, ${targetPoint[1]})`}>
              <path d="M0 -17 C10 -17 17 -9 17 0 C17 12 0 25 0 25 C0 25 -17 12 -17 0 C-17 -9 -10 -17 0 -17Z" />
              <circle r="6" />
            </g>
          )}

          {viewMode === "2d" && (
            <g className="north-scale">
              <path d="M1080 86 L1094 128 L1080 120 L1066 128Z" />
              <text x="1080" y="75">N</text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
