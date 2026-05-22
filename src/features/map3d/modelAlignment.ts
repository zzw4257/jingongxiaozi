import type { FloorId, Point } from "../map/types";

export type ModelPoint = [number, number, number];

const MAP_CENTER: Point = [620, 360];
const MODEL_SCALE = 0.021;
const FLOOR_HEIGHT = 46;

export function mapPointToModel(point: Point, floor: FloorId): ModelPoint {
  const x = (point[0] - MAP_CENTER[0]) * MODEL_SCALE;
  const z = (point[1] - MAP_CENTER[1]) * MODEL_SCALE;
  const y = floor === "2F" ? FLOOR_HEIGHT * MODEL_SCALE : 0.22;
  return [x, y, z];
}

export const modelAlignment = {
  displayScale: 0.0038,
  centerOffset: [0, 0, 0] as ModelPoint,
  defaultCamera: {
    position: [7.5, 6.2, 9.5] as ModelPoint,
    target: [0, 0.15, 0] as ModelPoint,
    fov: 38,
  },
  routeLift: 0.28,
  hotspotLift: 0.42,
};
