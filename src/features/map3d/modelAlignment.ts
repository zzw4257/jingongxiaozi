import type { FloorId, MapSessionState, Point } from "../map/types";

export type ModelPoint = [number, number, number];

const MAP_CENTER: Point = [620, 360];
const MODEL_SCALE = 0.00815;

type TransformOptions = {
  layerMode?: MapSessionState["layerMode"];
  activeFloor?: FloorId;
  lift?: number;
};

export function floorBaseY(floor: FloorId, options: TransformOptions = {}): number {
  const layerMode = options.layerMode ?? "exploded";
  if (layerMode === "single") return 0.08;

  const normalY = floor === "2F" ? modelAlignment.floorHeight : 0.08;
  if ((layerMode === "exploded" || layerMode === "twoFloor") && floor === "2F") {
    return normalY + modelAlignment.explodeHeight;
  }
  return normalY;
}

export function floorOffsetXZ(floor: FloorId, options: TransformOptions = {}): [number, number] {
  const layerMode = options.layerMode ?? "exploded";
  if (layerMode === "single" || layerMode === "section") return [0, 0];
  if (layerMode === "exploded" || layerMode === "twoFloor") {
    return floor === "2F" ? [-1.28, -1.06] : [0.42, 0.36];
  }
  return [0, 0];
}

export function mapPointToModel(point: Point, floor: FloorId, options: TransformOptions = {}): ModelPoint {
  const [offsetX, offsetZ] = floorOffsetXZ(floor, options);
  const x = (point[0] - MAP_CENTER[0]) * MODEL_SCALE + offsetX;
  const z = (point[1] - MAP_CENTER[1]) * MODEL_SCALE + offsetZ;
  const y = floorBaseY(floor, options) + (options.lift ?? 0);
  return [x, y, z];
}

export const modelAlignment = {
  displayScale: 0.0038,
  centerOffset: [0, 0, 0] as ModelPoint,
  floorHeight: 0.92,
  explodeHeight: 0.92,
  slabThickness: 0.045,
  wallHeight: 0.38,
  outerWallHeight: 0.54,
  defaultCamera: {
    position: [6.6, 4.8, 7.2] as ModelPoint,
    target: [0.16, 0.72, 0.18] as ModelPoint,
    fov: 36,
  },
  routeLift: 0.16,
  hotspotLift: 0.12,
};
