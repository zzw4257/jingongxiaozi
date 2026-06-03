import type { FloorId, MapSessionState, Point } from "../map/types";

export type ModelPoint = [number, number, number];

const MAP_CENTER: Point = [620, 360];
const MODEL_SCALE = 0.00815;

type Raised202Space = {
  roomPrefix: string;
  label: string;
  height: number;
  platformPolygon: Point[];
  corridorPolygon: Point[];
  center: Point;
  note: string;
};

export const raised202Space: Raised202Space = {
  roomPrefix: "202",
  label: "202 二层半",
  height: 0.46,
  platformPolygon: [
    [620, 88],
    [1058, 88],
    [1058, 350],
    [620, 350],
  ],
  corridorPolygon: [
    [620, 205],
    [920, 205],
    [920, 255],
    [620, 255],
  ],
  center: [820, 228],
  note: "202 区域高于普通二层，按二层半平台显示；导航拓扑仍接入二层公共走廊。",
};

type TransformOptions = {
  layerMode?: MapSessionState["layerMode"];
  activeFloor?: FloorId;
  lift?: number;
  semanticId?: string;
};

export function floorBaseY(floor: FloorId, options: TransformOptions = {}): number {
  const layerMode = options.layerMode ?? "allFloors";
  if (layerMode === "single") return floor === "2F" ? modelAlignment.floorHeight : 0.08;
  if (layerMode === "raised202") return modelAlignment.floorHeight;

  const visualFloorHeight = layerMode === "section" ? modelAlignment.floorHeight * 1.08 : modelAlignment.floorHeight;
  const normalY = floor === "2F" ? visualFloorHeight : 0.08;
  if (layerMode === "exploded" && floor === "2F") {
    return modelAlignment.floorHeight + modelAlignment.explodeHeight;
  }
  return normalY;
}

export function floorOffsetXZ(floor: FloorId, options: TransformOptions = {}): [number, number] {
  const layerMode = options.layerMode ?? "allFloors";
  if (layerMode === "single" || layerMode === "section" || layerMode === "raised202") return [0, 0];
  if (layerMode === "exploded") {
    return floor === "2F" ? [-0.46, -0.38] : [0.16, 0.13];
  }
  return [0, 0];
}

function anchoredFloorPoint(point: Point, floor: FloorId, semanticId?: string): Point {
  if (floor !== "2F" || !semanticId) return point;
  const anchor = semanticAnchors2F.find((candidate) => candidate.match(semanticId));
  if (!anchor) return point;
  return [point[0] + anchor.offset[0], point[1] + anchor.offset[1]];
}

export function mapPointToModel(point: Point, floor: FloorId, options: TransformOptions = {}): ModelPoint {
  const [offsetX, offsetZ] = floorOffsetXZ(floor, options);
  const anchoredPoint = anchoredFloorPoint(point, floor, options.semanticId);
  const x = (anchoredPoint[0] - MAP_CENTER[0]) * MODEL_SCALE + offsetX;
  const z = (anchoredPoint[1] - MAP_CENTER[1]) * MODEL_SCALE + offsetZ;
  const y = floorBaseY(floor, options) + (options.lift ?? 0);
  return [x, y, z];
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isRaised202RoomId(roomId?: string): boolean {
  return Boolean(roomId?.startsWith(raised202Space.roomPrefix));
}

const semanticAnchors2F: Array<{ id: string; offset: Point; match: (semanticId: string) => boolean }> = [
  {
    id: "anchor-104-independent-2f",
    offset: [-320, 95],
    match: (semanticId) => semanticId.includes("104-2F") || semanticId.includes("stair-104-upper") || semanticId.includes("stair-104-2f"),
  },
  {
    id: "anchor-106-independent-2f",
    offset: [136.5, 210],
    match: (semanticId) => semanticId.includes("106-2F") || semanticId.includes("stair-106-upper") || semanticId.includes("stair-106-2f"),
  },
  {
    id: "anchor-108-independent-2f",
    offset: [-14, 290],
    match: (semanticId) =>
      semanticId.includes("108-2F") ||
      semanticId.includes("stair-108-upper") ||
      semanticId.includes("stair-108-2f") ||
      ["208", "209", "c2-108", "c2-west"].some((id) => semanticId.includes(id)),
  },
  {
    id: "anchor-public-202-2f",
    offset: [162.5, 290],
    match: (semanticId) =>
      semanticId.includes("stair-public-upper") ||
      semanticId.includes("stair-public-2f") ||
      semanticId.includes("201") ||
      semanticId.includes("202") ||
      semanticId.includes("raised-202") ||
      semanticId.includes("restroom-2f-east") ||
      semanticId.includes("c2-main") ||
      semanticId.includes("c2-202") ||
      semanticId.includes("2F-corridor-0") ||
      semanticId.includes("2F-corridor-1"),
  },
];

export function isPointInRaised202Space(point: Point): boolean {
  return pointInPolygon(point, raised202Space.platformPolygon);
}

export function raised202LiftForRoom(roomId?: string, floor?: FloorId): number {
  return floor === "2F" && isRaised202RoomId(roomId) ? raised202Space.height : 0;
}

export function raised202LiftForPoint(point: Point, floor: FloorId): number {
  return floor === "2F" && isPointInRaised202Space(point) ? raised202Space.height : 0;
}

export const modelAlignment = {
  displayScale: 0.0038,
  centerOffset: [0, 0, 0] as ModelPoint,
  mapCenter: MAP_CENTER,
  modelScale: MODEL_SCALE,
  floorHeight: 0.92,
  explodeHeight: 1.18,
  slabThickness: 0.045,
  wallHeight: 0.38,
  outerWallHeight: 0.54,
  defaultCamera: {
    position: [6.45, 5.95, 8.55] as ModelPoint,
    target: [-0.02, 0.7, 0.16] as ModelPoint,
    fov: 34,
  },
  routeLift: 0.18,
  hotspotLift: 0.12,
  semanticAnchors2F,
};
