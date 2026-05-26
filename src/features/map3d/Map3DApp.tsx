import {
  ArrowLeft,
  Box,
  Bug,
  Compass,
  Crosshair,
  CheckCircle2,
  Layers,
  LocateFixed,
  Maximize2,
  Navigation,
  Navigation2,
  Route,
  RotateCcw,
  RotateCw,
  ScanLine,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CSSProperties } from "react";
import type { MapDirectRequest } from "../../shared/appTypes";
import { postMiniProgramMessage } from "../../shared/miniProgramBridge";
import { areaLabels, jingongMapData } from "../map/data/mapData";
import { calculateRoute, formatSeconds, getRoomById } from "../map/routeService";
import type { AreaType, DoorSegment, FloorId, MapProgressUpdate, MapRoom, MapSessionState, Point, RouteProgressState, RouteResult, StairGeometry } from "../map/types";
import {
  floorBaseY,
  isPointInRaised202Space,
  isRaised202RoomId,
  mapPointToModel,
  modelAlignment,
  raised202LiftForPoint,
  raised202LiftForRoom,
  raised202Space,
} from "./modelAlignment";

type Props = {
  initialRequest?: MapDirectRequest;
  entrySource: "manual" | "backend";
  onExit?: () => void;
  onOpenLegacy?: () => void;
};

type PanelId = "none" | "route" | "layers" | "view" | "room" | "debug";
type CameraMode = "perspective" | "orthographic";
type LoadState = "loading" | "ready" | "fallback" | "error";
type CameraPreset = "overview" | "lowIso" | "top" | "route";
type CameraPresetState = CameraPreset | "free";
type LabelDensity = "far" | "mid" | "near";
type DeviceHeadingState = {
  heading?: number;
  supported: boolean;
  calibrated: boolean;
  calibrationOffset: number;
};
type LabelAnchor = {
  roomId: string;
  text: string;
  compactText?: string;
  fullText?: string;
  minDensity?: LabelDensity;
  floor: FloorId;
  priority: number;
  active: boolean;
  start: boolean;
  target: boolean;
  position: THREE.Vector3;
  variant?: "room" | "compact-room" | "corridor" | "stair" | "floor" | "note" | "route" | "door";
};
type LabelLayout = LabelAnchor & {
  x: number;
  y: number;
  visible: boolean;
};
type HeadingLayout = {
  x: number;
  y: number;
  visible: boolean;
};

function activeLegUi(route?: RouteResult, leg?: RouteResult["guidanceLegs"][number]) {
  if (!route || !leg) {
    return {
      title: "尚未生成路线",
      checkpoint: "选择终点后开始",
      confirmText: "到达后继续",
      isLast: false,
      progress: "--",
    };
  }
  const isLast = leg.index >= route.guidanceLegs.length - 1;
  return {
    title: leg.instruction,
    checkpoint: leg.checkpointLabel,
    confirmText: isLast ? "已到达终点" : `${leg.actionLabel}，继续`,
    mapHint: "收起面板后也可点地图标记继续",
    isLast,
    progress: `${leg.index + 1}/${route.guidanceLegs.length}`,
  };
}

const DEFAULT_LAYER: MapSessionState["layerMode"] = "exploded";
const TAP_SELECT_THRESHOLD = 16;
const labelDensityRank: Record<LabelDensity, number> = { far: 0, mid: 1, near: 2 };
const singleFloorFocus: Record<FloorId, { position: THREE.Vector3; target: THREE.Vector3; zoom: number }> = {
  "1F": {
    position: new THREE.Vector3(5.4, 7.15, 6.85),
    target: new THREE.Vector3(-0.15, 0.36, 0.46),
    zoom: 0.86,
  },
  "2F": {
    position: new THREE.Vector3(6.55, 7.2, 6.4),
    target: new THREE.Vector3(-0.48, 1.1, 0.78),
    zoom: 0.82,
  },
};
const raised202Focus = {
  position: new THREE.Vector3(4.85, 5.85, 4.65),
  target: new THREE.Vector3(2.1, 1.55, -0.05),
  zoom: 1.18,
};
const roomColor: Record<AreaType, number> = {
  teaching: 0x7fc76f,
  processing: 0xff9b59,
  lab: 0xb98be6,
  office: 0xffc857,
  service: 0x74a7f2,
  other: 0xd7dde7,
};
const spaceColor = {
  corridor: 0xbfe7ff,
  service: 0xcfe3ff,
  restroom: 0xd6f4ea,
  storage: 0xe4e9f0,
  reserved: 0xf0e9d8,
  stair: 0xd3994e,
  void: 0xf4f6f8,
  room: 0xffffff,
} as const;
const EXPLODED_FLOOR_OPACITY: Record<FloorId, number> = {
  "1F": 0.94,
  "2F": 0.82,
};
const FLOOR_SHELL_COLOR: Record<FloorId, number> = {
  "1F": 0xf6efe5,
  "2F": 0xf8fafc,
};
const explodedSecondFloorIslands: Array<{ id: string; label: string; polygon: Point[]; semanticId: string; lift?: number }> = [
  {
    id: "2f-island-108-west",
    label: "108 独立二层",
    semanticId: "108-2F-island",
    polygon: [
      [90, 15],
      [520, 15],
      [520, 345],
      [90, 345],
    ],
  },
  {
    id: "2f-island-202-platform",
    label: "202 二层半",
    semanticId: "202-island",
    lift: raised202Space.height,
    polygon: [
      [620, 88],
      [1058, 88],
      [1058, 350],
      [620, 350],
    ],
  },
  {
    id: "2f-island-office-south",
    label: "204-210 办公区",
    semanticId: "c2-office-island",
    polygon: [
      [235, 625],
      [520, 625],
      [520, 705],
      [235, 705],
    ],
  },
  {
    id: "2f-island-104",
    label: "104 独立二层",
    semanticId: "104-2F-island",
    polygon: [
      [1050, 160],
      [1180, 160],
      [1180, 280],
      [1050, 280],
    ],
  },
  {
    id: "2f-island-106",
    label: "106 独立二层",
    semanticId: "106-2F-island",
    polygon: [
      [760, 15],
      [930, 15],
      [930, 95],
      [760, 95],
    ],
  },
];
const roomCssClass: Record<AreaType, string> = {
  teaching: "teaching",
  processing: "processing",
  lab: "lab",
  office: "office",
  service: "service",
  other: "other",
};

const defaultSession = (entrySource: "manual" | "backend", request?: MapDirectRequest): MapSessionState => ({
  entrySource,
  selectedRoomId: request?.targetRoomId,
  startRoomId: request?.startRoomId,
  targetRoomId: request?.targetRoomId,
  viewMode: "2_5d",
  layerMode: DEFAULT_LAYER,
  activeFloor: undefined,
  announce: request?.announce ?? [],
});

const floorLabel: Record<FloorId, string> = {
  "1F": "一层",
  "2F": "二层",
};

const floorDisplayLabel = (room: MapRoom): string => (isRaised202RoomId(room.id) ? "二层半" : floorLabel[room.floor]);

const independentSecondFloorRoomIds = new Set(["104-2F01", "106-2F"]);

function isIndependentSecondFloorRoom(room: MapRoom): boolean {
  return room.floor === "2F" && (independentSecondFloorRoomIds.has(room.id) || room.id.startsWith("108-2F"));
}

function isRaised202Room(room: MapRoom): boolean {
  return room.floor === "2F" && room.id.startsWith(raised202Space.roomPrefix);
}

function isPublicSecondFloorRoom(room: MapRoom): boolean {
  return room.floor === "2F" && !isRaised202Room(room) && !isIndependentSecondFloorRoom(room);
}

const compactRoomName = (room: MapRoom): string => {
  const name = room.name
    .replace("智能制造创新创业实验室", "智能制造")
    .replace("CAD/CAM 云设计中心", "CAD/CAM")
    .replace("数字化制造中心", "数字化中心")
    .replace("WEDM 编程设计", "WEDM");
  return `${room.roomNo} ${name}`;
};

const visibleRoomsForSession = (session: MapSessionState): MapRoom[] =>
  jingongMapData.rooms.filter((room) => {
    if (session.layerMode === "raised202") return isRaised202Room(room);
    if (session.layerMode === "single" && session.activeFloor === "2F") return isPublicSecondFloorRoom(room);
    if (session.layerMode === "single" && session.activeFloor) return room.floor === session.activeFloor;
    return true;
  });

const overviewLabelRoomIds = new Set([
  "101",
  "104-1F01",
  "106",
  "107-core",
  "108-lobby",
  "202-5",
  "208",
  "210",
]);

function shouldShowRoomLabel(room: MapRoom, session: MapSessionState, startRoomId?: string) {
  if (room.id === session.selectedRoomId || room.id === session.targetRoomId || room.id === startRoomId) return true;
  if (session.layerMode === "single" || session.layerMode === "section" || session.layerMode === "raised202") return true;
  return true;
}

function roomMinDensity(room: MapRoom, session: MapSessionState, startRoomId?: string, hasRoute = false): LabelDensity {
  if (room.id === session.selectedRoomId || room.id === session.targetRoomId || room.id === startRoomId) return "far";
  if (hasRoute && !overviewLabelRoomIds.has(room.id)) return "near";
  if (overviewLabelRoomIds.has(room.id)) return "far";
  if (session.layerMode === "raised202") return "mid";
  if (session.layerMode === "single" || session.layerMode === "section") return "mid";
  return "near";
}

function cameraLabelDensity(camera: THREE.Camera, controls?: OrbitControls | null): LabelDensity {
  if (camera instanceof THREE.OrthographicCamera) {
    if (camera.zoom >= 1.18) return "near";
    if (camera.zoom >= 0.86) return "mid";
    return "far";
  }
  const target = controls?.target ?? new THREE.Vector3(...modelAlignment.defaultCamera.target);
  const distance = camera.position.distanceTo(target);
  if (distance <= 5.6) return "near";
  if (distance <= 8.6) return "mid";
  return "far";
}

function densityText(label: LabelAnchor, density: LabelDensity): string {
  if (label.active || label.target || label.start) return label.fullText ?? label.text;
  if (density === "near") return label.fullText ?? label.text;
  return label.compactText ?? label.text;
}

function densityVariant(label: LabelAnchor, density: LabelDensity): LabelAnchor["variant"] {
  if (label.variant !== "room") return label.variant;
  if (label.active || label.target || label.start || density === "near") return "room";
  return "compact-room";
}

function isSingleFloorFocusMode(session: MapSessionState) {
  return session.layerMode === "single" || session.layerMode === "raised202";
}

function layerChipTitle(session: MapSessionState) {
  if (session.layerMode === "single" && session.activeFloor === "1F") return "一层精看";
  if (session.layerMode === "single" && session.activeFloor === "2F") return "二层公共区";
  if (session.layerMode === "raised202") return "202 二层半";
  if (session.layerMode === "exploded") return "分层总览";
  if (session.layerMode === "section") return "剖切导览";
  return "全楼总览";
}

function layerChipHint(session: MapSessionState) {
  if (session.layerMode === "single" && session.activeFloor === "2F") return "不含 202 二层半";
  if (session.layerMode === "single") return "门洞、走廊和房间边界已增强";
  if (session.layerMode === "raised202") return "聚焦 202 高平台";
  if (session.layerMode === "exploded") return "默认分开看各层";
  if (session.layerMode === "section") return "淡化模型看内部路线";
  return "右侧可切路线/图层";
}

function routeLabelNudge(roomId: string): { x: number; y: number } {
  if (roomId === "route-current-location") return { x: -22, y: 30 };
  if (roomId === "route-next-portal") return { x: 24, y: -26 };
  if (roomId === "route-target-location") return { x: 0, y: -34 };
  return { x: 0, y: 0 };
}

function createCamera(mode: CameraMode, width: number, height: number): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  const aspect = Math.max(0.1, width / Math.max(1, height));
  if (mode === "orthographic") {
    const frustum = 10.8;
    const camera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.05,
      200,
    );
    camera.position.set(8.4, 7.2, 9.2);
    return camera;
  }

  const camera = new THREE.PerspectiveCamera(modelAlignment.defaultCamera.fov, aspect, 0.05, 220);
  camera.position.fromArray(modelAlignment.defaultCamera.position);
  return camera;
}

function shapeFromPolygon(polygon: Point[], floor: FloorId, session: MapSessionState, semanticId?: string) {
  const first = mapPointToModel(polygon[0], floor, { layerMode: session.layerMode, activeFloor: session.activeFloor, semanticId });
  const shape = new THREE.Shape();
  shape.moveTo(first[0], first[2]);
  polygon.slice(1).forEach((point) => {
    const [x, , z] = mapPointToModel(point, floor, { layerMode: session.layerMode, activeFloor: session.activeFloor, semanticId });
    shape.lineTo(x, z);
  });
  shape.closePath();
  return shape;
}

function extrudedPolygonMesh(
  polygon: Point[],
  floor: FloorId,
  session: MapSessionState,
  height: number,
  material: THREE.Material,
  lift = 0,
  semanticId?: string,
) {
  const shape = shapeFromPolygon(polygon, floor, session, semanticId);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = floorBaseY(floor, { layerMode: session.layerMode, activeFloor: session.activeFloor }) + lift;
  return mesh;
}

function floorVisibility(roomFloor: FloorId, session: MapSessionState) {
  if (session.layerMode === "raised202") return roomFloor === "2F";
  return !(session.layerMode === "single" && session.activeFloor && roomFloor !== session.activeFloor);
}

function polygonRaised202Score(polygon: Point[], floor: FloorId): number {
  if (floor !== "2F" || polygon.length === 0) return 0;
  const hits = polygon.filter(isPointInRaised202Space).length;
  return hits / polygon.length;
}

function polygonIsRaised202(polygon: Point[], floor: FloorId): boolean {
  return polygonRaised202Score(polygon, floor) > 0.65;
}

function semanticIdIsRaised202(semanticId?: string): boolean {
  return Boolean(
    semanticId?.includes("202") ||
      semanticId?.includes("c2-202") ||
      semanticId?.includes("2F-corridor-1") ||
      semanticId?.includes("2f-corridor-1"),
  );
}

function semanticIdIsIndependentSecondFloor(semanticId?: string): boolean {
  return Boolean(
    semanticId?.includes("104-2F") ||
      semanticId?.includes("106-2F") ||
      semanticId?.includes("108-2F") ||
      semanticId?.includes("stair-104-upper") ||
      semanticId?.includes("stair-104-2f") ||
      semanticId?.includes("stair-106-upper") ||
      semanticId?.includes("stair-106-2f") ||
      semanticId?.includes("stair-108-upper") ||
      semanticId?.includes("stair-108-2f") ||
      semanticId?.includes("c2-108") ||
      semanticId?.includes("c2-west"),
  );
}

function semanticVisibleForSession(floor: FloorId, session: MapSessionState, options: { point?: Point; polygon?: Point[]; roomId?: string; semanticId?: string } = {}) {
  if (!floorVisibility(floor, session)) return false;
  const raised =
    (options.roomId !== undefined && options.roomId.startsWith(raised202Space.roomPrefix)) ||
    semanticIdIsRaised202(options.semanticId) ||
    (options.point !== undefined && floor === "2F" && isPointInRaised202Space(options.point)) ||
    (options.polygon !== undefined && polygonIsRaised202(options.polygon, floor));
  if (session.layerMode === "raised202") return raised;
  if (session.layerMode === "single" && session.activeFloor === "2F") return !raised && !semanticIdIsIndependentSecondFloor(options.semanticId);
  return true;
}

function stairCenter(polygon: Point[]): Point {
  const total = polygon.reduce<Point>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
}

function splitWallSegments(
  wall: (typeof jingongMapData.walls)[number],
  doors: DoorSegment[],
): Array<{ from: Point; to: Point }> {
  const dx = wall.to[0] - wall.from[0];
  const dy = wall.to[1] - wall.from[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1) return [{ from: wall.from, to: wall.to }];
  const cuts = doors
    .filter((door) => door.floor === wall.floor)
    .map((door) => {
      const endpoints = [door.from, door.to].map((point) => {
        const t = ((point[0] - wall.from[0]) * dx + (point[1] - wall.from[1]) * dy) / lengthSq;
        const projected: Point = [wall.from[0] + dx * t, wall.from[1] + dy * t];
        return { t, distance: Math.hypot(projected[0] - point[0], projected[1] - point[1]) };
      });
      return {
        min: Math.max(0, Math.min(endpoints[0].t, endpoints[1].t)),
        max: Math.min(1, Math.max(endpoints[0].t, endpoints[1].t)),
        distance: Math.max(endpoints[0].distance, endpoints[1].distance),
      };
    })
    .filter((cut) => cut.distance < 2.2 && cut.max - cut.min > 0.01)
    .sort((a, b) => a.min - b.min);
  if (cuts.length === 0) return [{ from: wall.from, to: wall.to }];
  const segments: Array<{ from: Point; to: Point }> = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.min > cursor + 0.012) {
      segments.push({
        from: [wall.from[0] + dx * cursor, wall.from[1] + dy * cursor],
        to: [wall.from[0] + dx * cut.min, wall.from[1] + dy * cut.min],
      });
    }
    cursor = Math.max(cursor, cut.max);
  }
  if (cursor < 0.988) segments.push({ from: [wall.from[0] + dx * cursor, wall.from[1] + dy * cursor], to: wall.to });
  return segments;
}

function stairIsOnRoute(stair: StairGeometry, route?: RouteResult) {
  if (!route) return false;
  return route.steps.some(
    (step) =>
      step.kind.includes("stair") &&
      ((step.fromNodeId === stair.lowerNodeId && step.toNodeId === stair.upperNodeId) ||
        (step.fromNodeId === stair.upperNodeId && step.toNodeId === stair.lowerNodeId)),
  );
}

function centerlineIsOnRoute(centerline: (typeof jingongMapData.centerlines)[number], route?: RouteResult) {
  if (!route) return false;
  return route.steps.some(
    (step) =>
      (step.fromNodeId === centerline.from && step.toNodeId === centerline.to) ||
      (step.fromNodeId === centerline.to && step.toNodeId === centerline.from),
  );
}

function tubeBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const curve = new THREE.LineCurve3(a, b);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 8, false), material);
}

function pointMarker(position: THREE.Vector3, radius: number, material: THREE.Material) {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), material);
  marker.position.copy(position);
  return marker;
}

function addDirectionalArrow(root: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material, scale = 1) {
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (length < 0.16) return;
  const midpoint = from.clone().lerp(to, 0.62);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.18 * scale, 24), material);
  cone.position.copy(midpoint);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  root.add(cone);
}

function addDirectionalArrows(root: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material, scale = 1) {
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (length < 0.26) {
    addDirectionalArrow(root, from, to, material, scale);
    return;
  }
  const count = THREE.MathUtils.clamp(Math.floor(length / 0.72), 1, 4);
  for (let index = 0; index < count; index += 1) {
    const ratio = (index + 1) / (count + 1);
    const localFrom = from.clone().lerp(to, Math.max(0.06, ratio - 0.08));
    const localTo = from.clone().lerp(to, Math.min(0.94, ratio + 0.08));
    addDirectionalArrow(root, localFrom, localTo, material.clone(), scale);
  }
}

function makeDisc(position: THREE.Vector3, radius: number, material: THREE.Material) {
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.012, 36), material);
  disc.position.copy(position);
  disc.position.y -= 0.018;
  return disc;
}

function makeBeaconRing(position: THREE.Vector3, radius: number, color: number, opacity = 0.76) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.026, 10, 54),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
  );
  ring.position.copy(position);
  ring.position.y += 0.018;
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function orientedBox(
  center: THREE.Vector3,
  length: number,
  height: number,
  width: number,
  angle: number,
  material: THREE.Material,
  name: string,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), material);
  mesh.position.copy(center);
  mesh.rotation.y = angle;
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function stairBasis(a: THREE.Vector3, b: THREE.Vector3) {
  const horizontal = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
  if (horizontal.lengthSq() < 0.0001) horizontal.set(1, 0, 0);
  horizontal.normalize();
  const side = new THREE.Vector3(-horizontal.z, 0, horizontal.x);
  const angle = -Math.atan2(horizontal.z, horizontal.x);
  return { horizontal, side, angle };
}

function addRouteStairGuide(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, material: THREE.Material) {
  const { side } = stairBasis(a, b);
  const halfWidth = side.clone().multiplyScalar(0.25);
  [0.18, 0.34, 0.5, 0.66, 0.82].forEach((ratio, index) => {
    const center = a.clone().lerp(b, ratio);
    center.y += 0.13;
    const tread = tubeBetween(center.clone().sub(halfWidth), center.clone().add(halfWidth), 0.035, material);
    tread.name = `route-stair-guide-tread-${index}`;
    root.add(tread);
  });
}

function addStairPairGeometry(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, options: { active: boolean; publicAccess: boolean }) {
  const { horizontal, side, angle } = stairBasis(a, b);
  const horizontalDistance = Math.max(0.5, new THREE.Vector3(b.x - a.x, 0, b.z - a.z).length());
  const verticalDistance = Math.max(0.32, Math.abs(b.y - a.y));
  const stepCount = options.publicAccess ? 12 : 9;
  const run = Math.max(0.13, horizontalDistance / stepCount);
  const rise = verticalDistance / stepCount;
  const stairWidth = options.publicAccess ? 0.68 : 0.48;
  const pairMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xffa000 : options.publicAccess ? 0x8a9bad : 0xb68b57,
    emissive: options.active ? 0xb85d00 : 0x000000,
    emissiveIntensity: options.active ? 0.58 : 0,
    roughness: 0.42,
    metalness: 0.02,
  });
  const treadMaterial = pairMaterial.clone();
  const riserMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xd77600 : options.publicAccess ? 0x6d7f91 : 0x8e6840,
    emissive: options.active ? 0x8b3d00 : 0x000000,
    emissiveIntensity: options.active ? 0.3 : 0,
    roughness: 0.56,
    metalness: 0.02,
  });
  const railMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xffc45a : options.publicAccess ? 0x53657a : 0x6d5135,
    emissive: options.active ? 0x9d5300 : 0x000000,
    emissiveIntensity: options.active ? 0.36 : 0,
    roughness: 0.32,
    metalness: 0.08,
  });
  const nosingMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xfff0bd : options.publicAccess ? 0xf4f7fb : 0xf4dfbf,
    emissive: options.active ? 0xffb340 : 0x000000,
    emissiveIntensity: options.active ? 0.18 : 0,
    roughness: 0.36,
    metalness: 0.02,
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: options.active ? 0xffd27a : options.publicAccess ? 0xd8e1ea : 0xe9d0ad,
    transparent: true,
    opacity: options.active ? 0.34 : 0.1,
  });
  const landingMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xffb33c : options.publicAccess ? 0xb8c4d0 : 0xcaa06a,
    emissive: options.active ? 0x7c3f00 : 0x000000,
    emissiveIntensity: options.active ? 0.18 : 0,
    roughness: 0.6,
    metalness: 0.02,
  });

  root.add(makeDisc(a.clone(), stairWidth * 0.66, haloMaterial.clone()));
  root.add(makeDisc(b.clone(), stairWidth * 0.66, haloMaterial.clone()));
  root.add(orientedBox(a.clone().add(new THREE.Vector3(0, 0.03, 0)), stairWidth * 1.08, 0.06, stairWidth * 0.78, angle, landingMaterial.clone(), "stair-lower-platform"));
  root.add(orientedBox(b.clone().add(new THREE.Vector3(0, 0.03, 0)), stairWidth * 1.08, 0.06, stairWidth * 0.78, angle, landingMaterial.clone(), "stair-upper-platform"));

  for (let index = 0; index < stepCount; index++) {
    const ratio = (index + 0.5) / stepCount;
    const center = a.clone().lerp(b, ratio);
    center.y = Math.min(a.y, b.y) + rise * (index + 0.5);
    const tread = orientedBox(center.clone().add(new THREE.Vector3(0, 0.018, 0)), run * 0.96, 0.044, stairWidth, angle, treadMaterial.clone(), `stair-tread-${index}`);
    root.add(tread);
    const nosingCenter = center.clone().add(horizontal.clone().multiplyScalar(run * 0.41)).add(new THREE.Vector3(0, 0.04, 0));
    const nosing = orientedBox(nosingCenter, 0.016, 0.016, stairWidth * 0.98, angle, nosingMaterial.clone(), `stair-nosing-${index}`);
    root.add(nosing);

    const riserCenter = center.clone().sub(horizontal.clone().multiplyScalar(run * 0.45));
    riserCenter.y -= Math.max(0.01, rise * 0.28);
    const riser = orientedBox(riserCenter, 0.018, Math.max(0.035, rise * 0.7), stairWidth * 0.96, angle, riserMaterial.clone(), `stair-riser-${index}`);
    root.add(riser);
  }

  const railOffset = side.clone().multiplyScalar(stairWidth * 0.58);
  const railLift = new THREE.Vector3(0, 0.22, 0);
  const leftRailStart = a.clone().add(railOffset).add(railLift);
  const leftRailEnd = b.clone().add(railOffset).add(railLift);
  const rightRailStart = a.clone().sub(railOffset).add(railLift);
  const rightRailEnd = b.clone().sub(railOffset).add(railLift);
  root.add(tubeBetween(leftRailStart, leftRailEnd, options.active ? 0.026 : 0.018, railMaterial.clone()));
  root.add(tubeBetween(rightRailStart, rightRailEnd, options.active ? 0.026 : 0.018, railMaterial.clone()));
  root.add(tubeBetween(a.clone().add(railOffset).add(new THREE.Vector3(0, 0.06, 0)), b.clone().add(railOffset).add(new THREE.Vector3(0, 0.06, 0)), options.active ? 0.03 : 0.022, railMaterial.clone()));
  root.add(tubeBetween(a.clone().sub(railOffset).add(new THREE.Vector3(0, 0.06, 0)), b.clone().sub(railOffset).add(new THREE.Vector3(0, 0.06, 0)), options.active ? 0.03 : 0.022, railMaterial.clone()));
  [0, 0.33, 0.66, 1].forEach((ratio, index) => {
    const base = a.clone().lerp(b, ratio);
    const leftBase = base.clone().add(railOffset);
    const rightBase = base.clone().sub(railOffset);
    root.add(tubeBetween(leftBase, leftBase.clone().add(railLift), options.active ? 0.018 : 0.012, railMaterial.clone()));
    const rightPost = tubeBetween(rightBase, rightBase.clone().add(railLift), options.active ? 0.018 : 0.012, railMaterial.clone());
    rightPost.name = `stair-post-${index}`;
    root.add(rightPost);
  });

  addDirectionalArrow(root, a, b, pairMaterial.clone(), options.active ? 1.18 : 0.9);
  if (options.active) addRouteStairGuide(root, a, b, pairMaterial.clone());
}

function doorSegmentToVector(door: DoorSegment, endpoint: "from" | "to", session: MapSessionState, lift = 0.12) {
  const point = endpoint === "from" ? door.from : door.to;
  const [x, y, z] = mapPointToModel(point, door.floor, {
    layerMode: session.layerMode,
    activeFloor: session.activeFloor,
    semanticId: door.connects[0],
    lift: modelAlignment.slabThickness + lift + raised202LiftForPoint(point, door.floor),
  });
  return new THREE.Vector3(x, y, z);
}

function raisedPlatformRim(session: MapSessionState, material: THREE.Material) {
  const root = new THREE.Group();
  const polygon = raised202Space.platformPolygon;
  const modelOptions = { layerMode: session.layerMode, activeFloor: session.activeFloor };
  for (let index = 0; index < polygon.length; index++) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    const start = new THREE.Vector3(
      ...mapPointToModel(from, "2F", {
        ...modelOptions,
        lift: modelAlignment.slabThickness + raised202Space.height / 2,
      }),
    );
    const end = new THREE.Vector3(
      ...mapPointToModel(to, "2F", {
        ...modelOptions,
        lift: modelAlignment.slabThickness + raised202Space.height / 2,
      }),
    );
    const length = start.distanceTo(end);
    if (length < 0.001) continue;
    const side = new THREE.Mesh(new THREE.BoxGeometry(length, raised202Space.height, 0.026), material);
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    side.position.copy(midpoint);
    side.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
    side.name = `raised-202-rim-${index}`;
    root.add(side);
  }
  return root;
}

function raisedPlatformOutline(session: MapSessionState, material: THREE.Material, lift = 0.12) {
  const root = new THREE.Group();
  const polygon = raised202Space.platformPolygon;
  const modelOptions = { layerMode: session.layerMode, activeFloor: session.activeFloor };
  const points = [...polygon, polygon[0]].map((point) => {
    const [x, y, z] = mapPointToModel(point, "2F", {
      ...modelOptions,
      semanticId: "raised-202-outline",
      lift: modelAlignment.slabThickness + raised202Space.height + lift,
    });
    return new THREE.Vector3(x, y, z);
  });
  points.slice(0, -1).forEach((point, index) => {
    root.add(tubeBetween(point, points[index + 1], session.layerMode === "exploded" ? 0.026 : 0.034, material.clone()));
  });
  polygon.forEach((point, index) => {
    const [x, y, z] = mapPointToModel(point, "2F", {
      ...modelOptions,
      semanticId: "raised-202-outline-post",
      lift: modelAlignment.slabThickness + raised202Space.height * 0.56,
    });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, raised202Space.height * 0.76, 16), material.clone());
    post.position.set(x, y, z);
    post.name = `raised-202-corner-post-${index}`;
    root.add(post);
  });
  return root;
}

function addRaisedOutlineForPolygon(
  root: THREE.Group,
  polygon: Point[],
  floor: FloorId,
  session: MapSessionState,
  semanticId: string,
  material: THREE.Material,
  lift = 0.09,
  radius = 0.018,
) {
  const modelOptions = { layerMode: session.layerMode, activeFloor: session.activeFloor };
  const points = [...polygon, polygon[0]].map((point) => {
    const [x, y, z] = mapPointToModel(point, floor, {
      ...modelOptions,
      semanticId,
      lift: modelAlignment.slabThickness + lift,
    });
    return new THREE.Vector3(x, y, z);
  });
  points.slice(0, -1).forEach((point, index) => {
    const edge = tubeBetween(point, points[index + 1], radius, material.clone());
    edge.name = `${semanticId}-outline-${index}`;
    root.add(edge);
  });
}

function routePointToVector(point: RouteResult["points"][number], session: MapSessionState) {
  const [x, y, z] = mapPointToModel(point.point, point.floor, {
    layerMode: session.layerMode,
    activeFloor: session.activeFloor,
    semanticId: point.nodeId,
    lift: modelAlignment.routeLift + raised202LiftForPoint(point.point, point.floor),
  });
  return new THREE.Vector3(x, y, z);
}

function routeNodeToVector(nodeId: string, route: RouteResult, session: MapSessionState) {
  const point = route.points.find((candidate) => candidate.nodeId === nodeId);
  return point ? routePointToVector(point, session) : undefined;
}

function routePointIndex(nodeId: string, route: RouteResult) {
  return route.points.findIndex((point) => point.nodeId === nodeId);
}

function activeGuidanceLeg(route?: RouteResult, progress?: RouteProgressState) {
  if (!route || route.guidanceLegs.length === 0) return undefined;
  const requested = progress?.routeId === route.id ? progress.activeLegIndex : 0;
  return route.guidanceLegs[THREE.MathUtils.clamp(requested, 0, route.guidanceLegs.length - 1)];
}

function routeUsesRaised202(route?: RouteResult) {
  if (!route) return false;
  if (route.startRoomId.startsWith("202") || route.targetRoomId.startsWith("202")) return true;
  return route.points.some((point) => point.nodeId.includes("202") || point.nodeId === "c2-202");
}

function normalizeRadians(radians: number) {
  return ((radians % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

function bearingBetween(a: THREE.Vector3, b: THREE.Vector3) {
  return normalizeRadians(Math.atan2(b.x - a.x, b.z - a.z));
}

function useDeviceHeading(): DeviceHeadingState & {
  setCalibrationOffset: (offset: number) => void;
} {
  const [state, setState] = useState<DeviceHeadingState>({
    supported: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
    calibrated: false,
    calibrationOffset: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const degrees = typeof webkitHeading === "number" ? webkitHeading : typeof event.alpha === "number" ? 360 - event.alpha : undefined;
      if (degrees === undefined || Number.isNaN(degrees)) return;
      const radians = normalizeRadians(THREE.MathUtils.degToRad(degrees));
      setState((current) => ({
        ...current,
        heading: current.heading === undefined ? radians : normalizeRadians(current.heading * 0.82 + radians * 0.18),
        supported: true,
      }));
    };
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  const setCalibrationOffset = useCallback((offset: number) => {
    setState((current) => ({ ...current, calibrated: true, calibrationOffset: offset }));
  }, []);

  return { ...state, setCalibrationOffset };
}

function withOpacity<T extends THREE.Material>(material: T, opacity: number): T {
  material.transparent = opacity < 1;
  material.opacity = opacity;
  return material;
}

function semanticPlaneMaterial(options: {
  color: number;
  opacity: number;
  roughness?: number;
  emissive?: number;
  emissiveIntensity?: number;
}) {
  return new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness ?? 0.82,
    metalness: 0.01,
    transparent: options.opacity < 1,
    opacity: options.opacity,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    depthWrite: options.opacity >= 0.86,
  });
}

function updateCameraSize(camera: THREE.Camera, width: number, height: number) {
  const aspect = Math.max(0.1, width / Math.max(1, height));
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    return;
  }

  if (camera instanceof THREE.OrthographicCamera) {
    const frustum = 10.8;
    camera.left = (-frustum * aspect) / 2;
    camera.right = (frustum * aspect) / 2;
    camera.top = frustum / 2;
    camera.bottom = -frustum / 2;
    camera.updateProjectionMatrix();
  }
}

function materialList(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (material) {
      materialList(material).forEach((item) => {
        const maybeMap = item as THREE.Material & { map?: THREE.Texture };
        maybeMap.map?.dispose();
        item.dispose();
      });
    }
  });
}

export function Map3DApp({ initialRequest, entrySource, onExit, onOpenLegacy }: Props) {
  const [session, setSession] = useState<MapSessionState>(() => defaultSession(entrySource, initialRequest));
  const [panel, setPanel] = useState<PanelId>("none");
  const [routePage, setRoutePage] = useState<"setup" | "details">("setup");
  const [cameraMode, setCameraMode] = useState<CameraMode>("perspective");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [statusText, setStatusText] = useState("正在加载 3D 精确模型");
  const [labelLayout, setLabelLayout] = useState<LabelLayout[]>([]);
  const [headingLayout, setHeadingLayout] = useState<HeadingLayout | undefined>();
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPresetState>("overview");
  const [routeProgress, setRouteProgress] = useState<RouteProgressState | undefined>();
  const headingState = useDeviceHeading();

  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const semanticModelRootRef = useRef<THREE.Group | null>(null);
  const semanticRootRef = useRef<THREE.Group | null>(null);
  const routeRootRef = useRef<THREE.Group | null>(null);
  const interactiveObjectsRef = useRef<THREE.Object3D[]>([]);
  const labelAnchorsRef = useRef<LabelAnchor[]>([]);
  const labelSignatureRef = useRef("");
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeCameraPresetRef = useRef<CameraPresetState>("overview");
  const headingAnchorRef = useRef<THREE.Vector3 | undefined>();
  const headingLayoutSignatureRef = useRef("");
  const sessionLayerModeRef = useRef<MapSessionState["layerMode"]>(session.layerMode);

  useEffect(() => {
    setSession(defaultSession(entrySource, initialRequest));
    setPanel("none");
    setRoutePage("setup");
  }, [entrySource, initialRequest]);

  useEffect(() => {
    activeCameraPresetRef.current = activeCameraPreset;
  }, [activeCameraPreset]);

  useEffect(() => {
    sessionLayerModeRef.current = session.layerMode;
  }, [session.layerMode]);

  const startRoomId = session.startRoomId ?? (session.targetRoomId ? jingongMapData.defaultStartRoomId : undefined);
  const route = useMemo<RouteResult | undefined>(() => {
    if (!startRoomId || !session.targetRoomId) return undefined;
    return calculateRoute(jingongMapData, startRoomId, session.targetRoomId);
  }, [session.targetRoomId, startRoomId]);
  const selectedRoom = getRoomById(jingongMapData, session.selectedRoomId);
  const targetRoom = getRoomById(jingongMapData, session.targetRoomId);
  const startRoom = getRoomById(jingongMapData, startRoomId);
  const activeLeg = activeGuidanceLeg(route, routeProgress);
  const activeLegDisplay = activeLegUi(route, activeLeg);
  const headingBearing = headingState.heading === undefined ? undefined : normalizeRadians(headingState.heading + headingState.calibrationOffset);
  const headingAnchor = useMemo(() => {
    if (route && activeLeg) {
      return routeNodeToVector(activeLeg.fromNodeId, route, session);
    }
    if (startRoom) {
      const [x, y, z] = mapPointToModel(startRoom.center, startRoom.floor, {
        layerMode: session.layerMode,
        activeFloor: session.activeFloor,
        semanticId: startRoom.id,
        lift: 0.86 + raised202LiftForRoom(startRoom.id, startRoom.floor),
      });
      return new THREE.Vector3(x, y, z);
    }
    return undefined;
  }, [activeLeg, route, session.activeFloor, session.layerMode, startRoom]);

  useEffect(() => {
    headingAnchorRef.current = headingAnchor;
  }, [headingAnchor]);

  useEffect(() => {
    postMiniProgramMessage({
      type: "map-state",
      title: route ? `${startRoom?.roomNo ?? "101"} → ${targetRoom?.roomNo ?? session.targetRoomId ?? ""}` : layerChipTitle(session),
      panel,
      layerMode: session.layerMode,
      activeFloor: session.activeFloor,
      routeStep: activeLeg?.instruction,
    });
  }, [activeLeg?.instruction, panel, route, session.activeFloor, session.layerMode, session.targetRoomId, startRoom?.roomNo, targetRoom?.roomNo]);

  useEffect(() => {
    if (!route) {
      setRouteProgress(undefined);
      return;
    }
    setRouteProgress((current) => {
      if (current?.routeId === route.id) {
        return {
          ...current,
          activeLegIndex: THREE.MathUtils.clamp(current.activeLegIndex, 0, Math.max(0, route.guidanceLegs.length - 1)),
        };
      }
      return { routeId: route.id, activeLegIndex: 0, source: session.entrySource === "backend" ? "backend" : "manual" };
    });
  }, [route?.id, route?.guidanceLegs.length, route, session.entrySource]);

  const visibleRooms = useMemo(() => visibleRoomsForSession(session), [session]);

  const applyCameraPreset = useCallback((preset: CameraPreset, syncState = true) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const presets: Record<CameraPreset, { position: THREE.Vector3; target: THREE.Vector3; zoom?: number; fov?: number }> = {
      overview: {
        position: new THREE.Vector3(...modelAlignment.defaultCamera.position),
        target: new THREE.Vector3(...modelAlignment.defaultCamera.target),
        fov: modelAlignment.defaultCamera.fov,
        zoom: 0.9,
      },
      lowIso: {
        position: new THREE.Vector3(9.4, 8.2, 10.6),
        target: new THREE.Vector3(0.02, 1.68, 0.12),
        fov: 46,
        zoom: 0.9,
      },
      top: {
        position: new THREE.Vector3(0, 11.4, 0.001),
        target: new THREE.Vector3(0, 0.72, 0),
        fov: 32,
        zoom: 0.88,
      },
      route: {
        position: new THREE.Vector3(7.6, 4.95, 8.4),
        target: new THREE.Vector3(0.1, 1.3, 0.08),
        fov: 36,
        zoom: 0.9,
      },
    };
    const next = presets[preset];
    if (camera instanceof THREE.OrthographicCamera) {
      camera.position.copy(next.position);
      camera.up.set(0, 0, -1);
      camera.zoom = next.zoom ?? 0.92;
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.copy(next.position);
      camera.up.set(0, 1, 0);
      camera.fov = next.fov ?? modelAlignment.defaultCamera.fov;
      camera.updateProjectionMatrix();
    }
    controls.target.copy(next.target);
    controls.update();
    if (syncState) setActiveCameraPreset(preset);
  }, []);

  const switchCameraMode = useCallback((mode: CameraMode) => {
    const preset: CameraPreset = mode === "orthographic" ? "top" : "overview";
    setActiveCameraPreset(preset);
    if (mode === "orthographic") {
      setSession((current) => ({
        ...current,
        layerMode: current.layerMode === "allFloors" || current.layerMode === "exploded" ? "section" : current.layerMode,
      }));
    }
    setCameraMode(mode);
    setTimeout(() => applyCameraPreset(preset), 0);
  }, [applyCameraPreset]);

  const fitCamera = useCallback(() => {
    applyCameraPreset(sessionLayerModeRef.current === "exploded" ? "lowIso" : "overview");
  }, [applyCameraPreset]);

  const focusRoute = useCallback(() => {
    applyCameraPreset(route ? "route" : "overview");
  }, [applyCameraPreset, route]);

  const focusSingleFloor = useCallback((floor: FloorId) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const preset = sessionLayerModeRef.current === "raised202" ? raised202Focus : singleFloorFocus[floor];
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.copy(preset.position);
      camera.fov = 34;
      camera.up.set(0, 1, 0);
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.OrthographicCamera) {
      camera.position.set(0, 10.6, 0.001);
      camera.zoom = preset.zoom;
      camera.up.set(0, 0, -1);
      camera.updateProjectionMatrix();
    }
    controls.target.copy(preset.target);
    controls.update();
    setActiveCameraPreset("free");
  }, []);

  const markCameraFree = useCallback(() => {
    setActiveCameraPreset((current) => (current === "free" ? current : "free"));
  }, []);

  const rotateCamera = useCallback((radians: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.rotateLeft(radians);
    controls.update();
    markCameraFree();
  }, [markCameraFree]);

  const zoomCamera = useCallback((factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.45, 2.8);
      camera.updateProjectionMatrix();
    } else {
      const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
      const nextDistance = THREE.MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance);
      offset.setLength(nextDistance);
      camera.position.copy(controls.target).add(offset);
      if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix();
    }
    controls.update();
    markCameraFree();
  }, [markCameraFree]);

  const panCamera = useCallback((direction: "left" | "right" | "up" | "down") => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize();
    const distance = Math.max(offset.length(), 1);
    const amount = distance * 0.085;
    const delta = new THREE.Vector3();
    if (direction === "left") delta.addScaledVector(right, -amount);
    if (direction === "right") delta.addScaledVector(right, amount);
    if (direction === "up") delta.addScaledVector(up, amount);
    if (direction === "down") delta.addScaledVector(up, -amount);
    camera.position.add(delta);
    controls.target.add(delta);
    controls.update();
    markCameraFree();
  }, [markCameraFree]);

  const updateLabels = useCallback(() => {
    const host = hostRef.current;
    const camera = cameraRef.current;
    if (!host || !camera) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const density = cameraLabelDensity(camera, controlsRef.current);
    const projected = labelAnchorsRef.current
      .filter((anchor) => labelDensityRank[density] >= labelDensityRank[anchor.minDensity ?? "far"])
      .map((anchor) => {
        const variant = densityVariant(anchor, density);
        const text = densityText(anchor, density);
        const nudge = routeLabelNudge(anchor.roomId);
        const vector = anchor.position.clone().project(camera);
        return {
          ...anchor,
          text,
          variant,
          x: (vector.x * 0.5 + 0.5) * width + nudge.x,
          y: (-vector.y * 0.5 + 0.5) * height + nudge.y,
          visible: vector.z > -1 && vector.z < 1,
        };
      })
      .sort((a, b) => b.priority - a.priority);

    const occupied: Array<{ x: number; y: number; width: number; height: number }> = [];
    const laidOut = projected.map((label) => {
      const widthHint =
        label.active || label.target || label.start
          ? 128
          : label.variant === "compact-room"
            ? 54
          : label.variant === "note"
              ? 138
              : label.variant === "route"
                ? 126
              : label.variant === "corridor"
                ? 112
                : 92;
      const heightHint = label.variant === "compact-room" ? 24 : label.variant === "door" ? 22 : label.variant === "route" ? 32 : 30;
      const box = { x: label.x - widthHint / 2, y: label.y - heightHint / 2, width: widthHint, height: heightHint };
      const outside = box.x < 8 || box.y < 8 || box.x + box.width > width - 84 || box.y + box.height > height - 8;
      const isCompactRoom = label.variant === "compact-room";
      const trackCollisions = !isCompactRoom || density !== "near";
      const collides = trackCollisions && occupied.some(
        (item) =>
          box.x < item.x + item.width &&
          box.x + box.width > item.x &&
          box.y < item.y + item.height &&
          box.y + box.height > item.y,
      );
      const allowPriorityOverride = label.priority >= 90 && !label.roomId.startsWith("route-");
      const visible = label.visible && !outside && (!collides || allowPriorityOverride || (isCompactRoom && density === "near"));
      if (visible && trackCollisions) occupied.push(box);
      return { ...label, visible };
    });
    const signature = laidOut
      .filter((label) => label.visible)
      .map((label) => `${label.roomId}:${Math.round(label.x)}:${Math.round(label.y)}:${label.active ? 1 : 0}:${label.start ? 1 : 0}:${label.target ? 1 : 0}:${label.variant ?? "room"}`)
      .join("|");
    if (signature !== labelSignatureRef.current) {
      labelSignatureRef.current = signature;
      setLabelLayout(laidOut);
    }

    const headingAnchor = headingAnchorRef.current;
    if (!headingAnchor) {
      if (headingLayoutSignatureRef.current !== "hidden") {
        headingLayoutSignatureRef.current = "hidden";
        setHeadingLayout(undefined);
      }
      return;
    }
    const vector = headingAnchor.clone().project(camera);
    const visible = vector.z > -1 && vector.z < 1;
    const x = THREE.MathUtils.clamp((vector.x * 0.5 + 0.5) * width, 72, width - 124);
    const y = THREE.MathUtils.clamp((-vector.y * 0.5 + 0.5) * height - 48, 58, height - 82);
    const headingSignature = `${visible ? 1 : 0}:${Math.round(x)}:${Math.round(y)}`;
    if (headingSignature !== headingLayoutSignatureRef.current) {
      headingLayoutSignatureRef.current = headingSignature;
      setHeadingLayout({ x, y, visible });
    }
  }, []);

  const attachControls = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    controlsRef.current?.dispose();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 1.08;
    controls.panSpeed = 0.96;
    controls.minDistance = 1.65;
    controls.maxDistance = 38;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.keyPanSpeed = 18;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    if (camera instanceof THREE.OrthographicCamera) {
      controls.enableRotate = false;
      controls.screenSpacePanning = true;
    }
    controls.addEventListener("start", markCameraFree);
    controls.target.fromArray(modelAlignment.defaultCamera.target);
    controls.update();
    controlsRef.current = controls;
  }, [markCameraFree]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f9fc);
    scene.fog = new THREE.Fog(0xf7f9fc, 19, 48);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = createCamera("perspective", host.clientWidth, host.clientHeight);
    cameraRef.current = camera;
    attachControls();
    fitCamera();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x879ab2, 1.02));
    const sun = new THREE.DirectionalLight(0xffffff, 1.78);
    sun.position.set(4, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fc8ff, 0.52);
    fill.position.set(-6, 4, -5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.54);
    rim.position.set(-3, 6, 8);
    scene.add(rim);

    const grid = new THREE.GridHelper(12, 12, 0xabc0d7, 0xe0e8f2);
    grid.position.y = -0.03;
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    scene.add(grid);

    const loader = new GLTFLoader();
    loader.setResourcePath("/map-models/textures/");
    let cancelled = false;

    const loadModel = (url: string, fallback: boolean) => {
      loader.load(
        url,
        (gltf) => {
          if (cancelled) {
            disposeObject(gltf.scene);
            return;
          }
          modelRootRef.current?.removeFromParent();
          if (modelRootRef.current) disposeObject(modelRootRef.current);

          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const maxAxis = Math.max(size.x, size.y, size.z, 1);
          const calibrationFit = jingongMapData.calibration.runtimeFit.centeredScale;
          const scale = Number.isFinite(calibrationFit) && calibrationFit > 0 ? calibrationFit : 8.6 / maxAxis;

          model.position.sub(center);
          model.scale.setScalar(scale);
          model.visible = sessionLayerModeRef.current !== "exploded";
          model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              materialList(mesh.material).forEach((material) => {
                const displayMaterial = material as THREE.MeshStandardMaterial;
                if ("color" in displayMaterial) displayMaterial.color.set(0xb8c2ce);
                if ("emissive" in displayMaterial) displayMaterial.emissive.set(0x000000);
                material.side = THREE.DoubleSide;
                material.transparent = true;
                material.opacity = sessionLayerModeRef.current === "exploded" ? 0.035 : 0.2;
                material.depthWrite = false;
                material.needsUpdate = true;
              });
            }
          });
          model.position.y = -0.015;
          scene.add(model);
          modelRootRef.current = model;
          setLoadState(fallback ? "fallback" : "ready");
          setStatusText(fallback ? "正在显示 STL 备用几何模型" : "3D 精确模型已加载");
          fitCamera();
        },
        undefined,
        () => {
          if (!fallback) {
            setStatusText("3DS 转换模型加载失败，切换 STL 备用模型");
            loadModel("/map-models/jingong-fallback.glb", true);
            return;
          }
          setLoadState("error");
          setStatusText("模型加载失败，保留语义导航叠加层");
        },
      );
    };

    loadModel("/map-models/jingong.glb", false);

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.floor(entry.contentRect.width));
      const height = Math.max(1, Math.floor(entry.contentRect.height));
      renderer.setSize(width, height, false);
      if (cameraRef.current) updateCameraSize(cameraRef.current, width, height);
    });
    resizeObserver.observe(host);

    let frame = 0;
    const animate = () => {
      controlsRef.current?.update();
      updateLabels();
      if (cameraRef.current) renderer.render(scene, cameraRef.current);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controlsRef.current?.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      disposeObject(scene);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRootRef.current = null;
      semanticModelRootRef.current = null;
      semanticRootRef.current = null;
      routeRootRef.current = null;
      interactiveObjectsRef.current = [];
      labelAnchorsRef.current = [];
      labelSignatureRef.current = "";
      headingAnchorRef.current = undefined;
      headingLayoutSignatureRef.current = "";
    };
  }, [attachControls, fitCamera, updateLabels]);

  useEffect(() => {
    const host = hostRef.current;
    const oldCamera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!host || !oldCamera || !renderer) return;
    const camera = createCamera(cameraMode, host.clientWidth, host.clientHeight);
    cameraRef.current = camera;
    attachControls();
    const preset = activeCameraPresetRef.current === "free" ? "overview" : activeCameraPresetRef.current;
    applyCameraPreset(preset, false);
  }, [applyCameraPreset, attachControls, cameraMode]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const model = modelRootRef.current;
    if (!renderer || !model) return;

    const singleFocus = isSingleFloorFocusMode(session);
    model.visible = session.layerMode !== "exploded";
    const modelOpacity =
      singleFocus
        ? session.layerMode === "raised202"
          ? 0.06
          : 0.1
        : session.layerMode === "section"
        ? 0.32
        : session.layerMode === "exploded"
            ? 0.035
            : 0.7;
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      materialList(mesh.material).forEach((material) => {
        const displayMaterial = material as THREE.MeshStandardMaterial;
        if ("color" in displayMaterial) displayMaterial.color.set(session.layerMode === "exploded" ? 0xb8c2ce : 0xa8b5c4);
        if ("emissive" in displayMaterial) displayMaterial.emissive.set(0x000000);
        material.transparent = true;
        material.opacity = modelOpacity;
        material.depthWrite = modelOpacity >= 0.66;
        material.needsUpdate = true;
      });
    });

    renderer.clippingPlanes =
      session.layerMode === "section"
        ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.74)]
        : session.layerMode === "single" && session.activeFloor === "1F"
          ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.56)]
          : [];
  }, [session.activeFloor, session.layerMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (semanticRootRef.current) {
      scene.remove(semanticRootRef.current);
      disposeObject(semanticRootRef.current);
    }
    if (semanticModelRootRef.current) {
      scene.remove(semanticModelRootRef.current);
      disposeObject(semanticModelRootRef.current);
    }

    const building = new THREE.Group();
    building.name = "semantic-building";
    const markers = new THREE.Group();
    markers.name = "semantic-markers";
    const labels: LabelAnchor[] = [];
    const interactive: THREE.Object3D[] = [];
    const activeRoomId = session.selectedRoomId;
    const modelOptions = { layerMode: session.layerMode, activeFloor: session.activeFloor };
    const singleFocus = isSingleFloorFocusMode(session);

    const corridorMaterial = new THREE.MeshStandardMaterial({
      color: singleFocus ? 0x63d4ff : session.layerMode === "exploded" ? 0xe6f5fb : 0xd7effb,
      emissive: singleFocus ? 0x064866 : 0x000000,
      emissiveIntensity: singleFocus ? 0.18 : 0,
      roughness: 0.78,
      metalness: 0.02,
      transparent: true,
      opacity: singleFocus ? 0.96 : session.layerMode === "exploded" ? 0.72 : 0.72,
    });
    const raisedCorridorMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "exploded" ? 0x4db8dc : 0x6bd4ff,
      emissive: session.layerMode === "exploded" ? 0x063f58 : 0x0f5f86,
      emissiveIntensity: session.layerMode === "exploded" ? 0.1 : 0.16,
      roughness: 0.72,
      metalness: 0.02,
      transparent: true,
      opacity: session.layerMode === "exploded" ? 0.82 : 0.82,
    });
    const corridorEdgeMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "exploded" ? 0x236f95 : 0x0a8dcc,
      emissive: 0x063f6d,
      emissiveIntensity: session.layerMode === "exploded" ? 0.04 : 0.1,
      roughness: 0.45,
      metalness: 0.02,
      transparent: true,
      opacity: session.layerMode === "exploded" ? 0.84 : 0.78,
    });
    const raisedPlatformSideMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "exploded" ? 0x6f859a : 0x2388a8,
      emissive: 0x06384b,
      emissiveIntensity: session.layerMode === "exploded" ? 0 : 0.08,
      roughness: 0.7,
      metalness: 0.04,
      transparent: true,
      opacity: session.layerMode === "raised202" ? 0.74 : 0.52,
    });
    const floorEdgeMaterial = new THREE.LineBasicMaterial({ color: singleFocus ? 0x52677f : 0x7d8fa3, transparent: true, opacity: singleFocus ? 0.92 : 0.72 });
    const floorShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x9aabbf,
      transparent: true,
      opacity: session.layerMode === "exploded" ? 0.16 : 0.08,
      depthWrite: false,
    });
    const raisedEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x004f8f,
      emissive: 0x004b72,
      emissiveIntensity: 0.24,
      roughness: 0.42,
      metalness: 0.02,
      transparent: true,
      opacity: 0.96,
    });
    const centerlineMaterial = new THREE.MeshStandardMaterial({
      color: singleFocus ? 0x005fd6 : 0x0b6cff,
      emissive: 0x073c9b,
      emissiveIntensity: 0.18,
      roughness: 0.34,
      metalness: 0.02,
      transparent: true,
      opacity: singleFocus ? 1 : 0.94,
    });
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x9ecfff,
      emissiveIntensity: 0.24,
      roughness: 0.25,
      metalness: 0.02,
    });
    const inferredDoorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc85a,
      emissive: 0xb46000,
      emissiveIntensity: 0.18,
      roughness: 0.28,
      metalness: 0.02,
    });
    const outerWallMaterial = new THREE.MeshStandardMaterial({
      color: singleFocus ? 0x8fa2b7 : session.layerMode === "exploded" ? 0xaebdcb : 0xc7d2df,
      roughness: 0.78,
      metalness: 0.02,
      transparent: true,
      opacity: singleFocus ? 1 : session.layerMode === "exploded" ? 1 : 0.98,
    });
    const innerWallMaterial = new THREE.MeshStandardMaterial({
      color: singleFocus ? 0xc5d0dc : session.layerMode === "exploded" ? 0xd1dbe6 : 0xe8eef5,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      opacity: singleFocus ? 0.98 : session.layerMode === "exploded" ? 0.98 : 0.94,
    });
    const lowWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xc7d1dd,
      roughness: 0.8,
      metalness: 0.01,
      transparent: true,
      opacity: 0.82,
    });
    const serviceMaterials = Object.fromEntries(
      Object.entries(spaceColor).map(([kind, color]) => [
        kind,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.76,
          metalness: 0.02,
          transparent: true,
          opacity: kind === "corridor" ? 0.78 : 0.52,
        }),
      ]),
    ) as Record<keyof typeof spaceColor, THREE.MeshStandardMaterial>;

    for (const floor of jingongMapData.floors) {
      if (!floorVisibility(floor.id, session)) continue;
      const useExplodedSecondFloorIslands = session.layerMode === "exploded" && floor.id === "2F";
      const shouldDrawWholeFloorShell =
        !useExplodedSecondFloorIslands &&
        (floor.id === "1F" ||
          session.layerMode === "single" ||
          session.layerMode === "raised202" ||
          session.layerMode === "exploded" ||
          session.layerMode === "allFloors" ||
          session.layerMode === "section");
      const shellOutline =
        session.layerMode === "raised202" && floor.id === "2F"
          ? raised202Space.platformPolygon
          : floor.outline;
      if (shouldDrawWholeFloorShell) {
        const floorShellOpacity = session.layerMode === "exploded" ? EXPLODED_FLOOR_OPACITY[floor.id] : 1;
        const slab = extrudedPolygonMesh(
          shellOutline.length >= 3 ? shellOutline : floor.outline,
          floor.id,
          session,
          modelAlignment.slabThickness,
          semanticPlaneMaterial({
            color: FLOOR_SHELL_COLOR[floor.id],
            opacity: floorShellOpacity,
            roughness: floor.id === "2F" ? 0.9 : 0.84,
          }),
        );
        slab.name = `${floor.id}-semantic-slab`;
        slab.receiveShadow = true;
        building.add(slab);
        const outlineSource = shellOutline.length >= 3 ? shellOutline : floor.outline;
        const shadow = extrudedPolygonMesh(outlineSource, floor.id, session, 0.004, floorShadowMaterial.clone(), -0.022, `${floor.id}-shadow`);
        shadow.name = `${floor.id}-soft-shadow`;
        building.add(shadow);

        const outlinePoints = [...outlineSource, outlineSource[0]].map((point) => {
          const [x, y, z] = mapPointToModel(point, floor.id, { ...modelOptions, lift: modelAlignment.slabThickness + 0.012 });
          return new THREE.Vector3(x, y, z);
        });
        building.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints), floorEdgeMaterial.clone()));
        if (session.layerMode === "exploded" && floor.id === "2F") {
          outlinePoints.slice(0, -1).forEach((point, pointIndex) => {
            const edge = tubeBetween(point, outlinePoints[pointIndex + 1], 0.026, floorEdgeMaterial.clone());
            edge.name = `2F-floor-strong-edge-${pointIndex}`;
            building.add(edge);
          });
        }
      }

      if (useExplodedSecondFloorIslands) {
        explodedSecondFloorIslands.forEach((island) => {
          const slab = extrudedPolygonMesh(
            island.polygon,
            "2F",
            session,
            modelAlignment.slabThickness,
            semanticPlaneMaterial({
              color: island.id.includes("202") ? 0xf7fbfd : 0xf7f9fc,
              opacity: island.id.includes("202") ? 0.62 : 0.88,
              roughness: 0.9,
            }),
            island.lift ?? 0,
            island.semanticId,
          );
          slab.name = `${island.id}-semantic-slab`;
          slab.receiveShadow = true;
          building.add(slab);
          const shadow = extrudedPolygonMesh(island.polygon, "2F", session, 0.004, floorShadowMaterial.clone(), (island.lift ?? 0) - 0.026, `${island.semanticId}-shadow`);
          shadow.name = `${island.id}-soft-shadow`;
          building.add(shadow);
          addRaisedOutlineForPolygon(building, island.polygon, "2F", session, island.semanticId, floorEdgeMaterial.clone(), (island.lift ?? 0) + 0.045, island.id.includes("202") ? 0.022 : 0.018);
        });
      }

      floor.corridorPolygons.forEach((corridor, index) => {
        const isRaisedCorridor = polygonIsRaised202(corridor, floor.id);
        const routeTouchesRaised202 = routeUsesRaised202(route);
      const showRaisedCorridor =
          semanticVisibleForSession(floor.id, session, { polygon: corridor, semanticId: `${floor.id}-corridor-${index}` }) ||
          (isRaisedCorridor && routeTouchesRaised202 && !(session.layerMode === "single" && session.activeFloor === "2F"));
        if (!showRaisedCorridor) return;
        const corridorLift = isRaisedCorridor ? raised202Space.height : 0;
        const corridorMesh = extrudedPolygonMesh(
          corridor,
          floor.id,
          session,
          singleFocus ? 0.032 : isRaisedCorridor ? 0.02 : 0.014,
          (isRaisedCorridor ? raisedCorridorMaterial : corridorMaterial).clone(),
          corridorLift,
          `${floor.id}-corridor-${index}`,
        );
        corridorMesh.name = `${floor.id}-corridor-${index}`;
        corridorMesh.position.y += modelAlignment.slabThickness + 0.01;
        building.add(corridorMesh);

        const corridorLinePoints = [...corridor, corridor[0]].map((point) => {
          const [x, y, z] = mapPointToModel(point, floor.id, {
            ...modelOptions,
            semanticId: `${floor.id}-corridor-${index}`,
            lift: modelAlignment.slabThickness + 0.045 + corridorLift,
          });
          return new THREE.Vector3(x, y, z);
        });
        corridorLinePoints.slice(0, -1).forEach((point, pointIndex) => {
          const next = corridorLinePoints[pointIndex + 1];
          const outlineTube = tubeBetween(point, next, isRaisedCorridor ? 0.018 : 0.014, (isRaisedCorridor ? raisedEdgeMaterial : corridorEdgeMaterial).clone());
          outlineTube.name = `${floor.id}-corridor-${index}-outline-${pointIndex}`;
          building.add(outlineTube);
        });

        const corridorCenter = stairCenter(corridor);
        labels.push({
          roomId: `${floor.id}-corridor-${index}`,
          text: isRaisedCorridor ? "202 二层半过道" : `${floor.id === "1F" ? "一层" : "二层"}过道`,
          compactText: isRaisedCorridor ? "202 过道" : `${floor.id} 过道`,
          fullText: isRaisedCorridor ? "202 二层半过道" : `${floor.id === "1F" ? "一层" : "二层"}过道`,
          minDensity: isRaisedCorridor ? "far" : "mid",
          floor: floor.id,
          priority: isRaisedCorridor ? 78 : 36,
          active: false,
          start: false,
          target: false,
          variant: "corridor",
          position: new THREE.Vector3(
            ...mapPointToModel(corridorCenter, floor.id, {
              ...modelOptions,
              semanticId: `${floor.id}-corridor-${index}`,
              lift: modelAlignment.slabThickness + (singleFocus ? 0.3 : 0.2) + corridorLift,
            }),
          ),
        });
      });

      labels.push({
        roomId: `floor-${floor.id}`,
        text: floor.label,
        compactText: floor.id,
        fullText: floor.label,
        minDensity: "far",
        floor: floor.id,
        priority: 18,
        active: false,
        start: false,
        target: false,
        variant: "floor",
        position: new THREE.Vector3(...mapPointToModel(floor.outline[0], floor.id, { ...modelOptions, lift: 0.42 })),
      });
    }

    for (const mapSpace of jingongMapData.spaces) {
      if (mapSpace.kind === "room" || mapSpace.kind === "corridor" || mapSpace.kind === "stair") continue;
      if (!semanticVisibleForSession(mapSpace.floor, session, { polygon: mapSpace.polygon, semanticId: mapSpace.id })) continue;
      const raisedLift = raised202LiftForPoint(mapSpace.center, mapSpace.floor);
      const material = serviceMaterials[mapSpace.kind] ?? serviceMaterials.reserved;
      const mesh = extrudedPolygonMesh(mapSpace.polygon, mapSpace.floor, session, 0.025, material.clone(), raisedLift, mapSpace.id);
      mesh.position.y += modelAlignment.slabThickness + 0.018;
      mesh.name = `space-${mapSpace.id}`;
      building.add(mesh);
      const outline = [...mapSpace.polygon, mapSpace.polygon[0]].map((point) => {
        const [x, y, z] = mapPointToModel(point, mapSpace.floor, {
          ...modelOptions,
          semanticId: mapSpace.id,
          lift: modelAlignment.slabThickness + 0.08 + raisedLift,
        });
        return new THREE.Vector3(x, y, z);
      });
      building.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline), floorEdgeMaterial.clone()));
      labels.push({
        roomId: mapSpace.id,
        text: mapSpace.label,
        compactText: mapSpace.kind === "restroom" ? "卫生间" : mapSpace.kind === "storage" ? "仓储" : "服务",
        fullText: mapSpace.label,
        minDensity: "near",
        floor: mapSpace.floor,
        priority: singleFocus ? (mapSpace.labelPriority ?? 16) + 22 : mapSpace.labelPriority ?? 16,
        active: false,
        start: false,
        target: false,
        variant: "note",
        position: new THREE.Vector3(
          ...mapPointToModel(mapSpace.center, mapSpace.floor, {
            ...modelOptions,
            semanticId: mapSpace.id,
            lift: modelAlignment.slabThickness + 0.22 + raisedLift,
          }),
        ),
      });
    }

    const routeTouchesRaised202 = routeUsesRaised202(route);
    if (floorVisibility("2F", session) && (session.layerMode === "raised202" || session.layerMode === "exploded" || routeTouchesRaised202) && !(session.layerMode === "single" && session.activeFloor === "2F")) {
      const showSeparateRaisedPlatform = session.layerMode === "raised202" || (routeTouchesRaised202 && session.layerMode !== "exploded");
      if (showSeparateRaisedPlatform) {
        const raisedPlatform = extrudedPolygonMesh(
          raised202Space.platformPolygon,
          "2F",
          session,
          session.layerMode === "raised202" ? 0.052 : 0.022,
          semanticPlaneMaterial({
            color: session.layerMode === "raised202" ? 0xe9fbff : 0xf4f8fb,
            opacity: session.layerMode === "raised202" ? 0.94 : 0.42,
            roughness: 0.88,
          }),
          raised202Space.height,
          "raised-202",
        );
        raisedPlatform.position.y += modelAlignment.slabThickness + 0.012;
        raisedPlatform.name = "raised-202-platform";
        building.add(raisedPlatform);
      }
      if (session.layerMode !== "exploded") {
        building.add(raisedPlatformRim(session, raisedPlatformSideMaterial.clone()));
      }
      labels.push({
        roomId: "raised-202-note",
        text: raised202Space.label,
        compactText: "202",
        fullText: raised202Space.label,
        minDensity: "far",
        floor: "2F",
        priority: 96,
        active: false,
        start: false,
        target: false,
        variant: "note",
        position: new THREE.Vector3(
          ...mapPointToModel(raised202Space.center, "2F", {
            ...modelOptions,
            semanticId: "raised-202",
            lift: modelAlignment.slabThickness + raised202Space.height + 0.5,
          }),
        ),
      });
    }

    for (const room of visibleRooms) {
      const active = room.id === activeRoomId;
      const target = room.id === session.targetRoomId;
      const start = room.id === startRoomId;
      const raisedLift = raised202LiftForRoom(room.id, room.floor);
      const emphasizedRoom = active || target || start;
      const roomIsRouteContext = Boolean(route && (room.id === route.startRoomId || room.id === route.targetRoomId));
      const hideRoomLabelForRouteEndpoint = Boolean(route && (room.id === route.startRoomId || room.id === route.targetRoomId));
      const subduedSemanticFill = session.layerMode === "allFloors" && !emphasizedRoom && !roomIsRouteContext;
      const singleRoomFill = singleFocus && !emphasizedRoom;
      const material = new THREE.MeshStandardMaterial({
        color: active || target ? 0x0b6cff : start ? 0x19a15f : subduedSemanticFill ? 0xf4f6f8 : roomColor[room.area],
        roughness: subduedSemanticFill || singleRoomFill ? 0.76 : 0.62,
        metalness: 0.02,
        transparent: true,
        opacity: active || target || start ? 0.9 : singleRoomFill ? 0.64 : subduedSemanticFill ? 0.18 : session.layerMode === "exploded" && room.floor === "2F" ? 0.66 : 0.56,
      });
      const roomHeight = emphasizedRoom
        ? raisedLift > 0
          ? 0.08
          : 0.06
        : singleFocus
          ? 0.03
          : session.layerMode === "exploded" && room.floor === "2F"
            ? 0.034
            : 0.018;
      const roomMesh = extrudedPolygonMesh(room.polygon, room.floor, session, roomHeight, material, raisedLift, room.id);
      roomMesh.position.y += modelAlignment.slabThickness + (subduedSemanticFill ? 0.014 : session.layerMode === "exploded" && room.floor === "2F" ? 0.035 : 0.025);
      roomMesh.name = `room-${room.id}`;
      roomMesh.userData.roomId = room.id;
      roomMesh.castShadow = true;
      roomMesh.receiveShadow = true;
      building.add(roomMesh);
      interactive.push(roomMesh);

      const linePoints = [...room.polygon, room.polygon[0]].map((point) => {
        const [x, y, z] = mapPointToModel(point, room.floor, {
          ...modelOptions,
          semanticId: room.id,
          lift: modelAlignment.slabThickness + (session.layerMode === "exploded" && room.floor === "2F" ? 0.13 : 0.088) + raisedLift,
        });
        return new THREE.Vector3(x, y, z);
      });
      const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), floorEdgeMaterial.clone());
      outline.name = `room-${room.id}-outline`;
      building.add(outline);
      if (active || target || start || (raisedLift > 0 && !subduedSemanticFill) || (session.layerMode === "exploded" && room.floor === "2F")) {
        linePoints.slice(0, -1).forEach((point, index) => {
          const edgeTube = tubeBetween(point, linePoints[index + 1], active || target || start ? 0.015 : session.layerMode === "exploded" && room.floor === "2F" ? 0.012 : 0.01, (raisedLift > 0 ? raisedEdgeMaterial : corridorEdgeMaterial).clone());
          edgeTube.name = `room-${room.id}-edge-${index}`;
          building.add(edgeTube);
        });
      }

      const [x, y, z] = mapPointToModel(room.center, room.floor, {
        ...modelOptions,
        semanticId: room.id,
        lift: modelAlignment.hotspotLift + 0.13 + raisedLift,
      });
      const hotspot = new THREE.Mesh(
        new THREE.CylinderGeometry(active || target || start ? 0.12 : 0.058, active || target || start ? 0.12 : 0.058, 0.05, 24),
        new THREE.MeshStandardMaterial({
          color: target ? 0xff3f6c : start ? 0x18a058 : active ? 0x0b6cff : 0xffffff,
          emissive: target ? 0x5a0012 : active ? 0x06236b : 0x000000,
          roughness: 0.42,
          metalness: 0.02,
        }),
      );
      hotspot.position.set(x, y, z);
      hotspot.userData.roomId = room.id;
      hotspot.castShadow = true;
      markers.add(hotspot);
      interactive.push(hotspot);

      if (!hideRoomLabelForRouteEndpoint && shouldShowRoomLabel(room, session, startRoomId)) {
        const forceFullLabel = active || target || start || overviewLabelRoomIds.has(room.id) || session.layerMode === "raised202";
        const fullLabel = `${target ? "终点 " : start ? "起点 " : ""}${compactRoomName(room)}`;
        const compactLabel = target ? "终点" : start ? "起点" : room.roomNo;
        labels.push({
          roomId: room.id,
          text: forceFullLabel ? fullLabel : room.roomNo,
          compactText: compactLabel,
          fullText: fullLabel,
          minDensity: singleFocus ? "far" : roomMinDensity(room, session, startRoomId, Boolean(route)),
          floor: room.floor,
          priority: active || target || start ? 100 : singleFocus ? 62 : isRaised202RoomId(room.id) ? 68 : overviewLabelRoomIds.has(room.id) ? 60 : 34,
          active,
          start,
          target,
          variant: "room",
          position: new THREE.Vector3(x, y + (active || target || start ? 0.24 : 0.16), z),
        });
      }
    }

    for (const wall of jingongMapData.walls) {
      if (session.layerMode === "exploded" && wall.floor === "2F" && wall.kind === "outer") continue;
      const roomWallMatch = wall.id.match(/^wall-(.+)-\d+$/);
      const wallRoom = roomWallMatch ? getRoomById(jingongMapData, roomWallMatch[1]) : undefined;
      if (session.layerMode === "single" && session.activeFloor === "2F" && wallRoom && !isPublicSecondFloorRoom(wallRoom)) continue;
      if (session.layerMode === "raised202" && wallRoom && !isRaised202Room(wallRoom)) continue;
      if (!semanticVisibleForSession(wall.floor, session, { point: stairCenter([wall.from, wall.to]), semanticId: wall.id })) continue;
      const raisedLift = raised202LiftForPoint(wall.from, wall.floor) || raised202LiftForPoint(wall.to, wall.floor);
      const explodedSecondFloorBoost = session.layerMode === "exploded" && wall.floor === "2F" ? 1.16 : 1;
      const height = wall.kind === "outer"
        ? modelAlignment.outerWallHeight * (singleFocus ? 0.52 : 1) * explodedSecondFloorBoost
        : modelAlignment.wallHeight * (singleFocus ? 0.42 : 1) * explodedSecondFloorBoost;
      for (const segment of splitWallSegments(wall, jingongMapData.doors)) {
        const start = new THREE.Vector3(...mapPointToModel(segment.from, wall.floor, { ...modelOptions, semanticId: wall.id, lift: modelAlignment.slabThickness + height / 2 + raisedLift }));
        const end = new THREE.Vector3(...mapPointToModel(segment.to, wall.floor, { ...modelOptions, semanticId: wall.id, lift: modelAlignment.slabThickness + height / 2 + raisedLift }));
        const length = start.distanceTo(end);
        if (length < 0.001) continue;
        const geometry = new THREE.BoxGeometry(length, height, singleFocus ? (wall.kind === "outer" ? 0.055 : 0.036) : wall.kind === "outer" ? 0.04 : wall.kind === "low" ? 0.024 : 0.02);
        const wallMaterial = wall.kind === "outer" ? outerWallMaterial.clone() : wall.kind === "low" ? lowWallMaterial.clone() : innerWallMaterial.clone();
        const mesh = new THREE.Mesh(geometry, wallMaterial);
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        mesh.position.copy(midpoint);
        mesh.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        building.add(mesh);
      }
    }

    for (const centerline of jingongMapData.centerlines) {
      const fromNode = jingongMapData.nodes.find((candidate) => candidate.id === centerline.from);
      const toNode = jingongMapData.nodes.find((candidate) => candidate.id === centerline.to);
      if (!fromNode || !toNode || !floorVisibility(fromNode.floor, session) || fromNode.floor !== toNode.floor) continue;
      if (
        !semanticVisibleForSession(fromNode.floor, session, { point: fromNode.point, semanticId: centerline.from }) ||
        !semanticVisibleForSession(toNode.floor, session, { point: toNode.point, semanticId: centerline.to })
      ) continue;
      const onRouteCenterline = centerlineIsOnRoute(centerline, route);
      if (route && !onRouteCenterline && session.layerMode !== "section") continue;
      const start = new THREE.Vector3(
        ...mapPointToModel(fromNode.point, fromNode.floor, {
          ...modelOptions,
          semanticId: centerline.from,
          lift: modelAlignment.slabThickness + 0.105 + raised202LiftForPoint(fromNode.point, fromNode.floor),
        }),
      );
      const end = new THREE.Vector3(
        ...mapPointToModel(toNode.point, toNode.floor, {
          ...modelOptions,
          semanticId: centerline.to,
          lift: modelAlignment.slabThickness + 0.105 + raised202LiftForPoint(toNode.point, toNode.floor),
        }),
      );
      const material = withOpacity(centerlineMaterial.clone(), onRouteCenterline ? 0.96 : 0.22);
      const tube = tubeBetween(start, end, onRouteCenterline ? 0.024 : singleFocus ? 0.018 : centerline.kind === "stair-approach" ? 0.016 : 0.012, material);
      tube.name = centerline.id;
      building.add(tube);
      if (singleFocus && !route && centerline.kind === "corridor") {
        const midpoint = start.clone().lerp(end, 0.5);
        labels.push({
          roomId: `centerline-${centerline.id}`,
          text: "通行线",
          compactText: "通行",
          fullText: "通行线",
          minDensity: "near",
          floor: fromNode.floor,
          priority: 28,
          active: false,
          start: false,
          target: false,
          variant: "corridor",
          position: midpoint.add(new THREE.Vector3(0, 0.18, 0)),
        });
      }
    }

    for (const door of jingongMapData.doors) {
      if (!semanticVisibleForSession(door.floor, session, { point: door.point, semanticId: door.connects.join("-") })) continue;
      const from = doorSegmentToVector(door, "from", session, 0.15);
      const to = doorSegmentToVector(door, "to", session, 0.15);
      const material = door.source === "inferred" ? inferredDoorMaterial.clone() : doorMaterial.clone();
      const threshold = tubeBetween(from, to, door.source === "inferred" ? 0.026 : 0.03, material);
      threshold.name = `${door.id}-threshold`;
      building.add(threshold);
      const center = new THREE.Vector3(...mapPointToModel(door.point, door.floor, {
        ...modelOptions,
        semanticId: door.connects[0],
        lift: modelAlignment.slabThickness + 0.17 + raised202LiftForPoint(door.point, door.floor),
      }));
      building.add(pointMarker(center, door.source === "inferred" ? 0.035 : 0.042, material.clone()));
      if (singleFocus) {
        labels.push({
          roomId: `door-${door.id}`,
          text: door.source === "inferred" ? "推断门" : "门",
          compactText: "门",
          fullText: door.source === "inferred" ? "推断门洞" : "门洞",
          minDensity: "near",
          floor: door.floor,
          priority: door.source === "inferred" ? 24 : 30,
          active: false,
          start: false,
          target: false,
          variant: "door",
          position: center.clone().add(new THREE.Vector3(0, 0.12, 0)),
        });
      }
    }

    const stairMaterial = new THREE.MeshStandardMaterial({
      color: 0xd3994e,
      roughness: 0.58,
      metalness: 0.02,
      transparent: true,
      opacity: 0.94,
    });
    const stairActiveMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b6cff,
      emissive: 0x072766,
      roughness: 0.46,
      metalness: 0.02,
    });
    for (const stair of jingongMapData.stairs) {
      const onRoute = stairIsOnRoute(stair, route);
      const lowerVisible = floorVisibility(stair.lowerFloor, session);
      const upperVisible = floorVisibility(stair.upperFloor, session);
      const lowerSemanticVisible = semanticVisibleForSession(stair.lowerFloor, session, { polygon: stair.lowerLanding, semanticId: `${stair.id}-lower` });
      const upperSemanticVisible = semanticVisibleForSession(stair.upperFloor, session, { polygon: stair.upperLanding, semanticId: `${stair.id}-upper` });
      if (lowerVisible && lowerSemanticVisible) {
        const lower = extrudedPolygonMesh(stair.lowerLanding, stair.lowerFloor, session, 0.075, (onRoute ? stairActiveMaterial : stairMaterial).clone(), 0, `${stair.id}-lower`);
        lower.position.y += modelAlignment.slabThickness + 0.08;
        lower.name = `${stair.id}-lower`;
        building.add(lower);
      }
      if (upperVisible && upperSemanticVisible) {
        const upper = extrudedPolygonMesh(stair.upperLanding, stair.upperFloor, session, 0.075, (onRoute ? stairActiveMaterial : stairMaterial).clone(), 0, `${stair.id}-upper`);
        upper.position.y += modelAlignment.slabThickness + 0.08;
        upper.name = `${stair.id}-upper`;
        building.add(upper);
      }
      if (
        lowerVisible &&
        upperVisible &&
        lowerSemanticVisible &&
        upperSemanticVisible &&
        (session.layerMode !== "single" || onRoute || (session.layerMode === "single" && session.activeFloor === "2F"))
      ) {
        const lowerPoint = stairCenter(stair.lowerLanding);
        const upperPoint = stairCenter(stair.upperLanding);
        const lowerVector = new THREE.Vector3(...mapPointToModel(lowerPoint, stair.lowerFloor, { ...modelOptions, semanticId: `${stair.id}-lower`, lift: 0.22 }));
        const upperVector = new THREE.Vector3(...mapPointToModel(upperPoint, stair.upperFloor, { ...modelOptions, semanticId: `${stair.id}-upper`, lift: 0.22 }));
        addStairPairGeometry(building, lowerVector, upperVector, { active: onRoute, publicAccess: stair.access === "public" });
      }
      if (((onRoute && activeLeg?.kind?.includes("stair")) || !route) && (lowerSemanticVisible || upperSemanticVisible)) {
        const labelPoint = upperSemanticVisible ? stairCenter(stair.upperLanding) : stairCenter(stair.lowerLanding);
        labels.push({
          roomId: stair.id,
          text: stair.access === "internal" ? stair.label.replace("内部楼梯", "内梯") : stair.label,
          compactText: stair.access === "internal" ? "内梯" : "楼梯",
          fullText: stair.access === "internal" ? stair.label.replace("内部楼梯", "内梯") : stair.label,
          minDensity: onRoute ? "far" : "mid",
          floor: upperSemanticVisible ? stair.upperFloor : stair.lowerFloor,
          priority: onRoute ? 92 : stair.access === "internal" ? 44 : 40,
          active: onRoute,
          start: false,
          target: false,
          variant: "stair",
          position: new THREE.Vector3(
            ...mapPointToModel(labelPoint, upperSemanticVisible ? stair.upperFloor : stair.lowerFloor, {
              ...modelOptions,
              semanticId: `${stair.id}-${upperSemanticVisible ? "upper" : "lower"}`,
              lift: onRoute ? 0.72 : 0.52,
            }),
          ),
        });
      }
    }

    semanticModelRootRef.current = building;
    semanticRootRef.current = markers;
    interactiveObjectsRef.current = interactive;
    labelAnchorsRef.current = labels;
    scene.add(building);
    scene.add(markers);
    updateLabels();
  }, [route, session.activeFloor, session.layerMode, session.selectedRoomId, session.targetRoomId, startRoomId, updateLabels, visibleRooms]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (routeRootRef.current) {
      scene.remove(routeRootRef.current);
      disposeObject(routeRootRef.current);
    }

    const root = new THREE.Group();
    root.name = "route-overlay";
    if (route && route.points.length > 1) {
      const points = route.points.map((routePoint) => routePointToVector(routePoint, session));
      const currentLeg = activeGuidanceLeg(route, routeProgress);
      const activeFromIndex = currentLeg ? routePointIndex(currentLeg.fromNodeId, route) : 0;
      const activeToIndex = currentLeg ? routePointIndex(currentLeg.toNodeId, route) : Math.min(1, route.points.length - 1);
      const passedNodeCount = Math.max(0, activeFromIndex);
      const isOrthographicMap = cameraMode === "orthographic";
      const routeLabels: LabelAnchor[] = [];
      const routeMaterial = new THREE.MeshStandardMaterial({
        color: 0x0b6cff,
        emissive: 0x063a9f,
        emissiveIntensity: 0.42,
        roughness: 0.35,
        metalness: 0.02,
      });
      const stairRouteMaterial = new THREE.MeshStandardMaterial({
        color: 0xffa100,
        emissive: 0xd96a00,
        emissiveIntensity: 0.6,
        roughness: 0.28,
        metalness: 0.02,
      });
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x9dccff, transparent: true, opacity: 0.36 });
      const stairHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.52 });
      const doorRouteMaterial = new THREE.MeshStandardMaterial({
        color: 0x12b5cb,
        emissive: 0x075f72,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.02,
      });
      const entryRouteMaterial = new THREE.MeshStandardMaterial({
        color: 0x68b5ff,
        emissive: 0x0b4b8f,
        emissiveIntensity: 0.18,
        roughness: 0.35,
        metalness: 0.02,
      });
      const outerHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
      const targetDiscMaterial = new THREE.MeshBasicMaterial({ color: 0xffd5df, transparent: true, opacity: 0.72 });
      const startDiscMaterial = new THREE.MeshBasicMaterial({ color: 0xc8f7df, transparent: true, opacity: 0.74 });
      points.slice(0, -1).forEach((point, index) => {
        const nextPoint = points[index + 1];
        const step = route.steps[index];
        const isActiveSegment = currentLeg ? step?.fromNodeId === currentLeg.fromNodeId && step?.toNodeId === currentLeg.toNodeId : index === 0;
        const isPassedSegment = index < passedNodeCount;
        const isStair = step?.kind === "stair" || step?.kind === "internal-stair";
        const isDoor = step?.kind === "door";
        const isRoomEntry = step?.kind === "room-entry";
        const segmentMaterialBase = isStair ? stairRouteMaterial : isDoor ? doorRouteMaterial : isRoomEntry ? entryRouteMaterial : routeMaterial;
        const segmentHaloBase = isStair ? stairHaloMaterial : haloMaterial;
        const segmentMaterial = withOpacity(segmentMaterialBase.clone(), isActiveSegment ? 1 : isPassedSegment ? 0.36 : isOrthographicMap ? 0.18 : 0.24);
        const segmentHalo = withOpacity(segmentHaloBase.clone(), isActiveSegment ? (isStair ? 0.64 : 0.5) : isPassedSegment ? 0.16 : isOrthographicMap ? 0.06 : 0.1);
        const activeScale = isOrthographicMap ? 0.82 : 1;
        const inactiveRadius = isPassedSegment ? 0.022 : 0.016;
        const outerHalo = tubeBetween(point, nextPoint, isActiveSegment ? (isStair ? 0.22 : isDoor ? 0.16 : isRoomEntry ? 0.11 : 0.14) * activeScale : isPassedSegment ? 0.052 : 0.036, withOpacity(outerHaloMaterial.clone(), isActiveSegment ? 0.82 : isPassedSegment ? 0.18 : 0.1));
        const halo = tubeBetween(point, nextPoint, isActiveSegment ? (isStair ? 0.158 : isDoor ? 0.124 : isRoomEntry ? 0.084 : 0.112) * activeScale : isPassedSegment ? 0.044 : 0.03, segmentHalo);
        const tube = tubeBetween(point, nextPoint, isActiveSegment ? (isStair ? 0.084 : isDoor ? 0.066 : isRoomEntry ? 0.044 : 0.06) * activeScale : inactiveRadius, segmentMaterial);
        outerHalo.name = isStair ? "route-stair-outer-halo" : isDoor ? "route-door-outer-halo" : "route-walk-outer-halo";
        halo.name = isStair ? "route-stair-halo" : isDoor ? "route-door-halo" : "route-walk-halo";
        tube.name = isStair ? "route-stair-tube" : isDoor ? "route-door-tube" : isRoomEntry ? "route-entry-tube" : "route-walk-tube";
        root.add(outerHalo);
        root.add(halo);
        root.add(tube);
        if (isActiveSegment) addDirectionalArrows(root, point, nextPoint, segmentMaterialBase.clone(), isStair ? 1.45 : isDoor ? 1.16 : 1.04);
        if (isStair) {
          if (isActiveSegment) addRouteStairGuide(root, point, nextPoint, stairRouteMaterial);
          routeLabels.push({
            roomId: `route-stair-${index}`,
            text: "走楼梯",
            compactText: "楼梯",
            fullText: step?.note ?? "沿橙色楼梯段上楼",
            minDensity: isActiveSegment ? "far" : "mid",
            floor: route.points[index + 1].floor,
            priority: isActiveSegment ? 104 : 78,
            active: isActiveSegment,
            start: false,
            target: false,
            variant: "route",
            position: point.clone().lerp(nextPoint, 0.5).add(new THREE.Vector3(0, 0.24, 0)),
          });
        } else if (isDoor && index > 0 && isActiveSegment) {
          routeLabels.push({
            roomId: `route-door-${index}`,
            text: "过门",
            compactText: "门",
            fullText: step?.note ?? "经过门洞",
            minDensity: "near",
            floor: route.points[index + 1].floor,
            priority: 72,
            active: false,
            start: false,
            target: false,
            variant: "route",
            position: point.clone().lerp(nextPoint, 0.5).add(new THREE.Vector3(0, 0.18, 0)),
          });
        }
      });
      points.forEach((point, index) => {
        if (index === 0 || index === points.length - 1) return;
        const isActiveNode = index === activeFromIndex || index === activeToIndex;
        const pulse = new THREE.Mesh(
          new THREE.SphereGeometry(isActiveNode ? 0.12 : route.points[index].kind.includes("stair") ? 0.095 : 0.055, 18, 12),
          new THREE.MeshStandardMaterial({
            color: isActiveNode ? 0x0b6cff : route.points[index].kind.includes("stair") ? 0xffa100 : 0xffffff,
            emissive: isActiveNode ? 0x063a9f : route.points[index].kind.includes("stair") ? 0xd96a00 : 0x0b6cff,
            emissiveIntensity: isActiveNode ? 0.48 : 0.18,
            roughness: 0.38,
            transparent: true,
            opacity: isActiveNode ? 1 : 0.46,
          }),
        );
        pulse.position.copy(point);
        root.add(pulse);
      });

        const target = getRoomById(jingongMapData, route.targetRoomId);
        const currentVector = currentLeg ? routeNodeToVector(currentLeg.fromNodeId, route, session) : points[0];
        const nextVector = currentLeg ? routeNodeToVector(currentLeg.toNodeId, route, session) : points[Math.min(1, points.length - 1)];
      if (currentLeg && currentVector && nextVector) {
        const nextColor = currentLeg.checkpointKind === "stair" ? 0xff9f1a : currentLeg.checkpointKind === "door" ? 0x10b7c9 : currentLeg.checkpointKind === "destination" ? 0xff3f6c : 0x0b6cff;
        const nextMarker = new THREE.Mesh(
          isOrthographicMap ? new THREE.CylinderGeometry(0.24, 0.24, 0.18, 34) : new THREE.ConeGeometry(0.25, 0.64, 32),
          new THREE.MeshStandardMaterial({
            color: nextColor,
            emissive: nextColor,
            emissiveIntensity: 0.42,
            roughness: 0.34,
          }),
        );
        nextMarker.position.copy(nextVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.09 : 0.25, 0)));
        root.add(nextMarker);
        root.add(makeDisc(nextVector.clone(), 0.42, new THREE.MeshBasicMaterial({ color: nextColor, transparent: true, opacity: 0.24 })));
        root.add(makeBeaconRing(nextVector.clone(), 0.52, nextColor, 0.8));
        root.add(makeBeaconRing(nextVector.clone().add(new THREE.Vector3(0, 0.03, 0)), 0.72, nextColor, 0.36));
        const nextBeacon = tubeBetween(
          nextVector.clone().add(new THREE.Vector3(0, 0.03, 0)),
          nextVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.56 : 1.16, 0)),
          0.034,
          new THREE.MeshBasicMaterial({
            color: nextColor,
            transparent: true,
            opacity: 0.72,
          }),
        );
        nextBeacon.name = "route-next-checkpoint-beacon";
        root.add(nextBeacon);
        routeLabels.push({
          roomId: "route-next-portal",
          text: currentLeg.checkpointKind === "destination" ? "到达终点" : currentLeg.checkpointKind === "stair" ? "下一处楼梯" : currentLeg.checkpointKind === "door" ? "下一处门" : "下一转折点",
          compactText: currentLeg.checkpointKind === "destination" ? "终点" : currentLeg.checkpointKind === "stair" ? "楼梯" : currentLeg.checkpointKind === "door" ? "门口" : "转折",
          fullText: currentLeg.checkpointLabel,
          minDensity: "far",
          floor: currentLeg.floor,
          priority: 120,
          active: true,
          start: false,
          target: false,
          variant: "route",
          position: nextVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.56 : 1.05, 0)),
        });
      }
      if (currentVector) {
        root.add(makeDisc(currentVector.clone(), 0.28, startDiscMaterial));
        root.add(makeDisc(currentVector.clone().add(new THREE.Vector3(0, 0.012, 0)), 0.42, outerHaloMaterial.clone()));
        const currentPin = new THREE.Mesh(
          isOrthographicMap ? new THREE.CylinderGeometry(0.2, 0.2, 0.13, 34) : new THREE.CylinderGeometry(0.12, 0.12, 0.34, 28),
          new THREE.MeshStandardMaterial({
            color: 0x18a058,
            emissive: 0x063b1f,
            emissiveIntensity: 0.42,
            roughness: 0.4,
          }),
        );
        currentPin.position.copy(currentVector);
        currentPin.position.y += isOrthographicMap ? 0.07 : 0.1;
        root.add(currentPin);
        const pinCap = new THREE.Mesh(
          new THREE.SphereGeometry(isOrthographicMap ? 0.16 : 0.14, 24, 14),
          new THREE.MeshStandardMaterial({
            color: 0x1ac46d,
            emissive: 0x0a7238,
            emissiveIntensity: 0.32,
            roughness: 0.32,
          }),
        );
        pinCap.position.copy(currentVector);
        pinCap.position.y += isOrthographicMap ? 0.16 : 0.31;
        root.add(pinCap);
        const currentBeacon = tubeBetween(
          currentVector.clone().add(new THREE.Vector3(0, 0.03, 0)),
          currentVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.42 : 0.7, 0)),
          0.026,
          new THREE.MeshBasicMaterial({
            color: 0x18a058,
            transparent: true,
            opacity: 0.62,
          }),
        );
        currentBeacon.name = "route-current-location-beacon";
        root.add(currentBeacon);
        routeLabels.push({
          roomId: "route-current-location",
          text: "现在",
          compactText: "现在",
          fullText: currentLeg ? `现在：${currentLeg.fromLabel}` : "当前位置",
          minDensity: "far",
          floor: currentLeg?.floor ?? route.points[0].floor,
          priority: 116,
          active: true,
          start: true,
          target: false,
          variant: "route",
          position: currentVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.46 : 0.92, 0)),
        });
      }

      [target].forEach((room, index) => {
        if (!room) return;
        const [x, y, z] = mapPointToModel(room.center, room.floor, {
          layerMode: session.layerMode,
          activeFloor: session.activeFloor,
          semanticId: room.id,
          lift: 0.68 + raised202LiftForRoom(room.id, room.floor),
        });
        const base = new THREE.Vector3(x, y, z);
        root.add(makeDisc(base.clone(), 0.38, targetDiscMaterial));
        root.add(makeDisc(base.clone().add(new THREE.Vector3(0, 0.012, 0)), 0.56, outerHaloMaterial.clone()));
        const pin = new THREE.Mesh(
          isOrthographicMap
            ? new THREE.CylinderGeometry(0.3, 0.3, 0.16, 34)
            : new THREE.ConeGeometry(0.25, 0.68, 32),
          new THREE.MeshStandardMaterial({
            color: 0xff3f6c,
            emissive: 0x5f0018,
            emissiveIntensity: 0.36,
            roughness: 0.4,
          }),
        );
        pin.position.copy(base);
        pin.position.y += isOrthographicMap ? 0.08 : 0.2;
        root.add(pin);
        const beacon = tubeBetween(
          base.clone().add(new THREE.Vector3(0, 0.03, 0)),
          base.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.56 : 1.05, 0)),
          0.042,
          new THREE.MeshBasicMaterial({
            color: 0xff3f6c,
            transparent: true,
            opacity: 0.72,
          }),
        );
        beacon.name = "route-target-beacon";
        root.add(beacon);
        routeLabels.push({
          roomId: "route-target-location",
          text: "目的地",
          compactText: "终点",
          fullText: "目的地",
          minDensity: "far",
          floor: room.floor,
          priority: 118,
          active: true,
          start: false,
          target: true,
          variant: "route",
          position: base.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.58 : 1.1, 0)),
        });
      });
      labelAnchorsRef.current = [...labelAnchorsRef.current.filter((label) => !label.roomId.startsWith("route-")), ...routeLabels];
      labelSignatureRef.current = "";
      updateLabels();
    } else {
      labelAnchorsRef.current = labelAnchorsRef.current.filter((label) => !label.roomId.startsWith("route-"));
      labelSignatureRef.current = "";
      updateLabels();
    }
    routeRootRef.current = root;
    scene.add(root);
  }, [cameraMode, route, routeProgress, session.activeFloor, session.layerMode, updateLabels]);

  const pickRoom = useCallback((clientX: number, clientY: number) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return undefined;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveObjectsRef.current, true);
    const hit = hits.find((item) => item.object.userData.roomId);
    return hit?.object.userData.roomId as string | undefined;
  }, []);

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && event.isPrimary === false) {
      pointerStartRef.current = null;
      return;
    }
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SELECT_THRESHOLD) return;
    const roomId = pickRoom(event.clientX, event.clientY);
    if (!roomId) return;
    setSession((current) => ({ ...current, selectedRoomId: roomId }));
    setPanel("room");
  };

  const updateRouteEndpoint = (key: "startRoomId" | "targetRoomId", roomId: string) => {
    setSession((current) => ({
      ...current,
      [key]: roomId || undefined,
      selectedRoomId: key === "targetRoomId" ? roomId || current.selectedRoomId : current.selectedRoomId,
      routeId: undefined,
    }));
  };

  const setLayer = (layerMode: MapSessionState["layerMode"], activeFloor?: FloorId) => {
    setSession((current) => ({
      ...current,
      layerMode,
      activeFloor,
    }));
    if (layerMode === "single" && activeFloor) {
      if (cameraMode === "orthographic") {
        setCameraMode("perspective");
        setTimeout(() => focusSingleFloor(activeFloor), 0);
      } else {
        setTimeout(() => focusSingleFloor(activeFloor), 0);
      }
    } else if (layerMode === "raised202") {
      if (cameraMode === "orthographic") {
        setCameraMode("perspective");
      }
      setTimeout(() => focusSingleFloor("2F"), 0);
    } else if (layerMode === "exploded" && cameraMode === "orthographic") {
      switchCameraMode("perspective");
      setTimeout(() => applyCameraPreset("lowIso"), 0);
    } else if (layerMode === "exploded") {
      setTimeout(() => applyCameraPreset("lowIso"), 0);
    }
  };

  const startNavigationToSelected = () => {
    if (!session.selectedRoomId) return;
    setSession((current) => ({
      ...current,
      targetRoomId: current.selectedRoomId,
      startRoomId: current.startRoomId,
      routeId: `${current.startRoomId ?? jingongMapData.defaultStartRoomId}->${current.selectedRoomId}`,
    }));
    setPanel("route");
    setRoutePage("setup");
  };

  const clearRoute = () => {
    setSession((current) => ({
      ...current,
      startRoomId: undefined,
      targetRoomId: undefined,
      routeId: undefined,
      announce: [],
    }));
    setRoutePage("setup");
  };

  const updateRouteProgress = useCallback((update: MapProgressUpdate, source: RouteProgressState["source"] = "manual") => {
    setRouteProgress((current) => {
      if (!route) return undefined;
      const requestedRouteId = update.routeId ?? route.id;
      if (requestedRouteId !== route.id) return current;
      const nodeIndex =
        update.currentNodeId !== undefined
          ? route.guidanceLegs.findIndex((leg) => leg.fromNodeId === update.currentNodeId || leg.toNodeId === update.currentNodeId)
          : -1;
      const nextIndex = update.activeLegIndex ?? (nodeIndex >= 0 ? nodeIndex : current?.activeLegIndex ?? 0);
      return {
        routeId: route.id,
        activeLegIndex: THREE.MathUtils.clamp(nextIndex, 0, Math.max(0, route.guidanceLegs.length - 1)),
        source,
      };
    });
  }, [route]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const host = window as Window & { __jingongMapProgress?: (update: MapProgressUpdate) => void };
    const bridge = (update: MapProgressUpdate) => updateRouteProgress(update, "backend");
    host.__jingongMapProgress = bridge;
    return () => {
      if (host.__jingongMapProgress === bridge) delete host.__jingongMapProgress;
    };
  }, [updateRouteProgress]);

  const stepRouteProgress = (delta: number) => {
    if (!route) return;
    updateRouteProgress({
      activeLegIndex: (routeProgress?.routeId === route.id ? routeProgress.activeLegIndex : 0) + delta,
    });
  };

  const advanceRouteCheckpoint = () => {
    if (!route || !activeLeg) return;
    if (activeLeg.index >= route.guidanceLegs.length - 1) {
      setPanel("none");
      return;
    }
    stepRouteProgress(1);
  };

  const calibrateHeading = () => {
    const currentHeading = headingState.heading;
    if (currentHeading === undefined) return;
    let targetBearing = 0;
    if (route && activeLeg) {
      const from = routeNodeToVector(activeLeg.fromNodeId, route, session);
      const to = routeNodeToVector(activeLeg.toNodeId, route, session);
      if (from && to) targetBearing = bearingBetween(from, to);
    } else {
      const camera = cameraRef.current;
      if (camera) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        targetBearing = normalizeRadians(Math.atan2(forward.x, forward.z));
      }
    }
    headingState.setCalibrationOffset(normalizeRadians(targetBearing - currentHeading));
  };

  const openPanel = (next: PanelId) => {
    setPanel((current) => (current === next ? "none" : next));
  };

  const applyMapDirect = (request: MapDirectRequest) => {
    setSession(defaultSession("backend", request));
    setRouteProgress(undefined);
    setPanel("none");
    setRoutePage("setup");
    setTimeout(() => applyCameraPreset("route"), 0);
  };

  const roomOptions = jingongMapData.rooms;
  const loadLabel =
    loadState === "ready" ? "3D 精确模型" : loadState === "fallback" ? "STL 备用模型" : loadState === "error" ? "语义导航模式" : "模型加载中";
  const advancedLayerActive = session.layerMode === "allFloors" || session.layerMode === "section";
  const debugPhysicalModeLabel =
    session.layerMode === "exploded"
      ? "分层总览"
      : session.layerMode === "allFloors"
        ? "上下对齐"
        : session.layerMode === "single"
          ? "单层查看"
          : session.layerMode === "raised202"
            ? "二层半查看"
            : "剖切查看";
  const debugPhysicalModeHint =
    session.layerMode === "exploded"
      ? "当前把一层、二层和二层半分开，便于看清跨层路线和楼梯对应关系。"
      : session.layerMode === "allFloors"
        ? "当前按真实上下位置对齐楼层，用于核对物理关系。"
        : "当前聚焦局部楼层，便于查看门洞、走廊和房间边界。";
  const debugStats = useMemo(() => {
    const doorSources = jingongMapData.doors.reduce<Record<string, number>>((counts, door) => {
      counts[door.source] = (counts[door.source] ?? 0) + 1;
      return counts;
    }, {});
    const spaceKinds = jingongMapData.spaces.reduce<Record<string, number>>((counts, space) => {
      counts[space.kind] = (counts[space.kind] ?? 0) + 1;
      return counts;
    }, {});
    const floorPointCounts = jingongMapData.calibration.controlPoints.reduce<Record<string, number>>((counts, point) => {
      counts[point.floor] = (counts[point.floor] ?? 0) + 1;
      return counts;
    }, {});
    return {
      doorSources,
      spaceKinds,
      floorPointCounts,
      controlPoints: jingongMapData.calibration.controlPoints.length,
      runtimeScale: jingongMapData.calibration.runtimeFit.centeredScale,
      physicalMode: debugPhysicalModeLabel,
    };
  }, [debugPhysicalModeLabel]);

  const handleLabelClick = (roomId: string) => {
    if (roomId === "route-next-portal") {
      advanceRouteCheckpoint();
      return;
    }
    if (roomId === "route-current-location" || roomId === "route-target-location" || roomId.startsWith("route-stair-") || roomId.startsWith("route-door-")) {
      setPanel("route");
      setRoutePage("setup");
      return;
    }
    const room = getRoomById(jingongMapData, roomId);
    if (!room) return;
    setSession((current) => ({ ...current, selectedRoomId: room.id }));
    setPanel("room");
  };

  return (
    <div className={`map3d-app panel-${panel}`}>
      <section className="map3d-stage" aria-label="3D 精确模型地图">
        <div className="map3d-canvas-host" ref={hostRef} onPointerDown={handleCanvasPointerDown} onPointerUp={handleCanvasPointerUp} />
        <div className="map3d-label-layer" aria-hidden="true">
          {labelLayout
            .filter((label) => label.visible)
            .map((label) => {
              const room = getRoomById(jingongMapData, label.roomId);
              return (
                <button
                  key={`${label.roomId}-${label.x.toFixed(0)}-${label.y.toFixed(0)}`}
                  className={`map3d-label ${label.variant ?? "room"} ${label.active ? "active" : ""} ${label.start ? "start" : ""} ${label.target ? "target" : ""} ${label.roomId === "route-next-portal" ? "next-checkpoint" : ""} ${room ? roomCssClass[room.area] : "utility"}`}
                  style={{ left: label.x, top: label.y }}
                  onClick={() => handleLabelClick(label.roomId)}
                  tabIndex={-1}
                >
                  {label.text}
                </button>
              );
            })}
        </div>
        {headingState.calibrated && headingBearing !== undefined && headingAnchor && headingLayout?.visible && (
          <div
            className={`map3d-heading-indicator ${headingState.calibrated ? "calibrated" : ""}`}
            style={
              {
                "--heading-angle": `${headingBearing}rad`,
                left: `${headingLayout.x}px`,
                top: `${headingLayout.y}px`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            <Navigation2 size={18} />
            <span>{headingState.calibrated ? "朝向" : "未校准"}</span>
          </div>
        )}
        {panel === "none" && (
          <button
            className={`map3d-bottom-chip ${route ? "route-active" : ""}`}
            onClick={() => (route ? openPanel("route") : selectedRoom ? openPanel("room") : openPanel("layers"))}
            title={route ? "打开路线面板" : selectedRoom ? "打开房间信息" : "打开图层面板"}
          >
            {route ? <Route size={18} /> : <Crosshair size={18} />}
            <span>
              {route
                ? activeLeg
                  ? `${activeLegDisplay.progress} · ${activeLegDisplay.checkpoint}`
                  : `${targetRoom ? compactRoomName(targetRoom) : "目的地"}`
                : selectedRoom
                  ? `已选 ${compactRoomName(selectedRoom)}`
                  : layerChipTitle(session)}
            </span>
            {(route || selectedRoom) && (
              <small>{route ? (activeLeg ? activeLegDisplay.title : `${targetRoom ? compactRoomName(targetRoom) : "目的地"}`) : "点击查看房间"}</small>
            )}
          </button>
        )}
      </section>

      <nav className="map3d-rail" aria-label="地图操作栏">
        {onExit && (
          <button onClick={onExit} title="返回待机">
            <ArrowLeft size={22} />
            <span>返回</span>
          </button>
        )}
        <button className={panel === "route" ? "active" : ""} onClick={() => openPanel("route")} title="路线">
          <Route size={22} />
          <span>路线</span>
        </button>
        <button className={panel === "layers" ? "active" : ""} onClick={() => openPanel("layers")} title="图层">
          <Layers size={22} />
          <span>图层</span>
        </button>
        <button className={panel === "view" ? "active" : ""} onClick={() => openPanel("view")} title="视角">
          <Compass size={22} />
          <span>视角</span>
        </button>
        <button onClick={fitCamera} title="总览">
          <Maximize2 size={22} />
          <span>总览</span>
        </button>
        <button className={panel === "debug" ? "active" : ""} onClick={() => openPanel("debug")} title="调试">
          <Bug size={22} />
          <span>调试</span>
        </button>
      </nav>

      {panel !== "none" && <button className="material-scrim" aria-label="关闭地图面板" onClick={() => setPanel("none")} />}

      {panel !== "none" && (
        <aside className="material-panel map3d-panel" aria-label="地图面板">
          <div className="material-panel-title">
            <strong>
              {panel === "route" && "路线导航"}
              {panel === "layers" && "图层显示"}
              {panel === "view" && "视角控制"}
              {panel === "room" && "房间信息"}
              {panel === "debug" && "地图调试"}
            </strong>
            <button className="icon-button material-close" onClick={() => setPanel("none")} title="关闭">
              <X size={19} />
            </button>
          </div>

          {panel === "route" && (
            <div className="map3d-panel-page">
              {routePage === "setup" ? (
                <>
                  {!route && (
                    <div className="route-mode-banner">
                      <Sparkles size={18} />
                      <span>选择终点后，默认从 101 生成路线</span>
                    </div>
                  )}
                  <div className="route-endpoint-grid">
                    <div className="material-field">
                      <span>起点</span>
                      <select value={startRoomId ?? ""} onChange={(event) => updateRouteEndpoint("startRoomId", event.target.value)}>
                        <option value="">需要路线时使用默认 101</option>
                        {roomOptions.map((room) => (
                          <option key={room.id} value={room.id}>
                            {floorDisplayLabel(room)} · {compactRoomName(room)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="material-field">
                      <span>终点</span>
                      <select value={session.targetRoomId ?? ""} onChange={(event) => updateRouteEndpoint("targetRoomId", event.target.value)}>
                        <option value="">选择目的房间</option>
                        {roomOptions.map((room) => (
                          <option key={room.id} value={room.id}>
                            {floorDisplayLabel(room)} · {compactRoomName(room)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {route ? (
                    <div className="route-compact-meta">
                      <span>{startRoom ? compactRoomName(startRoom) : "默认 101"}</span>
                      <strong>→</strong>
                      <span>{targetRoom ? compactRoomName(targetRoom) : "未选择"}</span>
                      <small>{route.totalMeters}m · {formatSeconds(route.estimatedSeconds)}</small>
                    </div>
                  ) : (
                    <div className="route-material-summary">
                      <div>
                        <span>起点</span>
                        <strong>{startRoom ? compactRoomName(startRoom) : "默认 101"}</strong>
                      </div>
                      <div>
                        <span>终点</span>
                        <strong>{targetRoom ? compactRoomName(targetRoom) : "未选择"}</strong>
                      </div>
                      <div>
                        <span>距离</span>
                        <strong>--</strong>
                      </div>
                      <div>
                        <span>预计</span>
                        <strong>--</strong>
                      </div>
                    </div>
                  )}
                  {route && activeLeg && (
                    <div className="route-guidance-card">
                      <span>下一处确认点</span>
                      <strong>{activeLegDisplay.checkpoint}</strong>
                      <small>
                        {activeLegDisplay.title} · {activeLeg.distanceMeters}m
                      </small>
                    </div>
                  )}
                  {route && (
                    <div className="route-step-controls">
                      <button className="material-secondary" disabled={!activeLeg || activeLeg.index <= 0} onClick={() => stepRouteProgress(-1)}>
                        上一步
                      </button>
                      <span>{activeLegDisplay.progress}</span>
                      <button className="material-primary" disabled={!activeLeg} onClick={advanceRouteCheckpoint}>
                        {activeLegDisplay.isLast ? "完成" : "到达"}
                      </button>
                    </div>
                  )}
                  {route && activeLeg && (
                    <button className={`route-arrival-button ${activeLegDisplay.isLast ? "finish" : ""}`} onClick={advanceRouteCheckpoint}>
                      <CheckCircle2 size={20} />
                      <span>{activeLegDisplay.confirmText}</span>
                      <small>{activeLegDisplay.mapHint}</small>
                    </button>
                  )}
                  <div className={`material-action-row ${route ? "route-has-route" : ""}`}>
                    {!route && (
                      <button className="material-primary" disabled={!session.targetRoomId} onClick={() => setRoutePage("details")}>
                        <Navigation size={18} />
                        开始导航
                      </button>
                    )}
                    <button className="material-secondary" onClick={clearRoute}>
                      <Trash2 size={18} />
                      清除路线
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="stepper-card">
                    <span>当前段</span>
                    <strong>{activeLeg ? activeLegDisplay.checkpoint : route?.announceLines[0] ?? "尚未生成路线"}</strong>
                    <p>{activeLeg ? `${activeLegDisplay.title}。到达后点“${activeLegDisplay.confirmText}”。` : route?.announceLines[1] ?? "请选择起点和终点。"}</p>
                  </div>
                  <div className="route-step-window">
                    {(route?.guidanceLegs.slice(Math.max(0, (activeLeg?.index ?? 0) - 1), Math.max(0, (activeLeg?.index ?? 0) - 1) + 3) ?? []).map((leg) => (
                      <div key={leg.id} className={leg.index === activeLeg?.index ? "route-step-card active" : "route-step-card"}>
                        <b>{leg.index + 1}</b>
                        <span>
                          <strong>{leg.checkpointLabel}</strong>
                          {leg.instruction}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="material-action-row">
                    <button className="material-secondary" onClick={() => setRoutePage("setup")}>返回设置</button>
                    <button className="material-secondary" disabled={!activeLeg || activeLeg.index <= 0} onClick={() => stepRouteProgress(-1)}>上一步</button>
                    <button className="material-primary" disabled={!activeLeg || !route} onClick={advanceRouteCheckpoint}>{activeLegDisplay.isLast ? "完成" : "到达下一处"}</button>
                    <button className="material-primary" onClick={() => setPanel("none")}>收起面板</button>
                  </div>
                </>
              )}
            </div>
          )}

          {panel === "layers" && (
            <div className="map3d-panel-page">
              <div className="layer-mode-stack" aria-label="地图图层">
                <button className={session.layerMode === "exploded" ? "material-tile active primary-layer" : "material-tile primary-layer"} onClick={() => setLayer("exploded")}>
                  <Box size={20} />
                  <strong>分层总览</strong>
                  <span>默认打开，各层拉开显示，先看清上下关系</span>
                </button>
                <button className={session.layerMode === "single" && session.activeFloor === "1F" ? "material-tile single-floor active" : "material-tile single-floor"} onClick={() => setLayer("single", "1F")}>
                  <Layers size={20} />
                  <strong>一层</strong>
                  <span>只看一层门洞、走廊和房间边界</span>
                </button>
                <button className={session.layerMode === "single" && session.activeFloor === "2F" ? "material-tile single-floor active" : "material-tile single-floor"} onClick={() => setLayer("single", "2F")}>
                  <Layers size={20} />
                  <strong>二层公共区</strong>
                  <span>不含 202 二层半，避免混层</span>
                </button>
                <button className={session.layerMode === "raised202" ? "material-tile active raised" : "material-tile raised"} onClick={() => setLayer("raised202")}>
                  <Layers size={20} />
                  <strong>202 二层半</strong>
                  <span>单独查看高平台房间和过道</span>
                </button>
              </div>
              <div className="layer-advanced-row" aria-label="高级图层">
                <button className={session.layerMode === "allFloors" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => setLayer("allFloors")}>
                  物理对齐
                </button>
                <button className={session.layerMode === "section" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => setLayer("section")}>
                  剖切
                </button>
                <span>{advancedLayerActive ? "高级视图已开启" : "常用视图优先"}</span>
              </div>
              <div className="layer-mode-note">
                二层公共区和 202 二层半已拆开显示；路线跨到 202 时仍会自动高亮对应平台。
              </div>
            </div>
          )}

          {panel === "view" && (
            <div className="map3d-panel-page">
              <div className="material-grid two">
                <button className={cameraMode === "perspective" ? "material-tile active" : "material-tile"} onClick={() => switchCameraMode("perspective")}>
                  <Compass size={20} />
                  <strong>透视</strong>
                  <span>默认 2.5D 斜视角</span>
                </button>
                <button className={cameraMode === "orthographic" ? "material-tile active" : "material-tile"} onClick={() => switchCameraMode("orthographic")}>
                  <ScanLine size={20} />
                  <strong>2D 正交</strong>
                  <span>平面导览，标签保持正向</span>
                </button>
              </div>
              <div className="material-grid four camera-preset-grid">
                <button className={activeCameraPreset === "overview" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("overview")}>
                  总览
                </button>
                <button className={activeCameraPreset === "lowIso" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("lowIso")}>
                  低角
                </button>
                <button className={activeCameraPreset === "top" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("top")}>
                  2D
                </button>
                <button className={activeCameraPreset === "route" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => applyCameraPreset("route")}>
                  路线
                </button>
              </div>
              <div className="heading-calibration-card">
                <div>
                  <span>朝向校准</span>
                  <strong>{headingState.heading === undefined ? "等待传感器" : headingState.calibrated ? "已校准" : "未校准"}</strong>
                  <small>{headingState.heading === undefined ? "Android WebView 允许方向传感器后可用" : activeLeg ? "按当前导引段方向校准" : "按当前视图方向校准"}</small>
                </div>
                <button className="material-primary" disabled={headingState.heading === undefined} onClick={calibrateHeading}>
                  <Navigation2 size={18} />
                  校准
                </button>
              </div>
              <div className="view-nudge-grid">
                <button className="view-touch-action rotate-left" onClick={() => rotateCamera(Math.PI / 10)}>
                  <RotateCcw size={18} />
                  左转
                </button>
                <button className="view-touch-action rotate-right" onClick={() => rotateCamera(-Math.PI / 10)}>
                  <RotateCw size={18} />
                  右转
                </button>
                <button className="view-touch-action zoom-in" onClick={() => zoomCamera(1.2)}>
                  <ZoomIn size={18} />
                  放大
                </button>
                <button className="view-touch-action zoom-out" onClick={() => zoomCamera(1 / 1.2)}>
                  <ZoomOut size={18} />
                  缩小
                </button>
                <div className="view-pan-pad" aria-label="平移控制">
                  <span />
                  <button onClick={() => panCamera("up")} title="上移">上</button>
                  <span />
                  <button onClick={() => panCamera("left")} title="左移">左</button>
                  <button onClick={focusRoute} title={route ? "居中路线" : "回到总览"}>
                    <LocateFixed size={18} />
                    {route ? "路线" : "居中"}
                  </button>
                  <button onClick={() => panCamera("right")} title="右移">右</button>
                  <span />
                  <button onClick={() => panCamera("down")} title="下移">下</button>
                  <span />
                </div>
                <button className="view-reset-action" onClick={fitCamera}>
                  <Maximize2 size={18} />
                  复位总览
                </button>
              </div>
            </div>
          )}

          {panel === "room" && selectedRoom && (
            <div className="map3d-panel-page">
              <div className="room-material-card">
                <span>{floorDisplayLabel(selectedRoom)} · {areaLabels[selectedRoom.area]}</span>
                <strong>{compactRoomName(selectedRoom)}</strong>
                <p>{selectedRoom.description}</p>
                {isRaised202RoomId(selectedRoom.id) && <p className="room-special-note">{raised202Space.note}</p>}
                <div className="tag-row">
                  {selectedRoom.tags.slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className="material-action-row">
                <button className="material-secondary" onClick={() => setPanel("none")}>关闭</button>
                <button className="material-primary" onClick={startNavigationToSelected}>设为终点</button>
              </div>
            </div>
          )}

          {panel === "debug" && (
            <div className="map3d-panel-page">
              <div className="debug-metric-grid" aria-label="地图校准统计">
                <div>
                  <span>模型</span>
                  <strong>{loadLabel}</strong>
                  <small>{statusText} · scale {debugStats.runtimeScale.toExponential(2)}</small>
                </div>
                <div>
                  <span>校准点</span>
                  <strong>{debugStats.controlPoints} 个</strong>
                  <small>1F {debugStats.floorPointCounts["1F"] ?? 0} · 2F {debugStats.floorPointCounts["2F"] ?? 0}</small>
                </div>
                <div>
                  <span>门洞</span>
                  <strong>{jingongMapData.doors.length} 个</strong>
                  <small>ref {debugStats.doorSources.reference ?? 0} · cad {debugStats.doorSources.cad ?? 0} · inf {debugStats.doorSources.inferred ?? 0}</small>
                </div>
                <div>
                  <span>空间</span>
                  <strong>{jingongMapData.spaces.length} 个</strong>
                  <small>走廊 {debugStats.spaceKinds.corridor ?? 0} · 服务 {((debugStats.spaceKinds.restroom ?? 0) + (debugStats.spaceKinds.service ?? 0) + (debugStats.spaceKinds.storage ?? 0) + (debugStats.spaceKinds.reserved ?? 0))}</small>
                </div>
              </div>
              <div className="stepper-card">
                <span>当前层级模式</span>
                <strong>{debugStats.physicalMode}</strong>
                <p>{debugPhysicalModeHint}</p>
              </div>
              <div className="debug-material-list">
                <button onClick={() => applyMapDirect({ targetRoomId: "104-2F01", announce: ["summary", "distance", "floorChange"] })}>
                  MapDirect: 去 104 二层
                </button>
                <button onClick={() => applyMapDirect({ targetRoomId: "108-2F04", announce: ["summary", "distance", "floorChange"] })}>
                  MapDirect: 去 108 钳工
                </button>
                <button onClick={() => applyMapDirect({ startRoomId: "108-lobby", targetRoomId: "202-5", announce: ["summary", "distance", "direction"] })}>
                  MapDirect: 108 到 202-5
                </button>
                {onOpenLegacy && <button onClick={onOpenLegacy}>打开旧版演示地图</button>}
              </div>
              <p className="debug-panel-note">调试面板只暴露地图启动和校准状态。语音、意图识别和真实后端仍由外部服务接入。</p>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
