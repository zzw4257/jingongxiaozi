import {
  ArrowLeft,
  ArrowRight,
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
import type { CSSProperties, PointerEvent } from "react";
import type { MapDirectRequest } from "../../shared/appTypes";
import { postMiniProgramMessage } from "../../shared/miniProgramBridge";
import { areaLabels, jingongMapData } from "../map/data/mapData";
import { calculateRoute, formatSeconds, getRoomById } from "../map/routeService";
import type { AreaType, DoorSegment, FloorGeometry, FloorId, MapProgressUpdate, MapRoom, MapSessionState, Point, RouteProgressState, RouteResult, StairGeometry } from "../map/types";
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
type PanelSize = "compact" | "expanded";
type CameraMode = "perspective" | "orthographic";
type LoadState = "loading" | "ready" | "fallback" | "error";
type CameraPreset = "overview" | "lowIso" | "top" | "route";
type CameraTarget = { position: THREE.Vector3; target: THREE.Vector3; zoom?: number; fov?: number };
type CameraPresetState = CameraPreset | "free";
type LabelDensity = "far" | "mid" | "near";
type RoutePage = "setup" | "details" | "startPicker" | "targetPicker";
type RoomPickerGroup = "common" | "1F" | "2F" | "raised202";
type RuntimeModelRole = "structure" | "detail";
type SupportDeck = {
  id: string;
  floor: FloorId;
  polygon: Point[];
  label: string;
  semanticId: string;
};
type DeviceHeadingState = {
  heading?: number;
  supported: boolean;
  calibrated: boolean;
  calibrationOffset: number;
  permissionState: "idle" | "requesting" | "granted" | "denied";
  statusMessage?: string;
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
type NorthLayout = {
  angle: number;
  label: string;
};

const mapDebugEnabled = import.meta.env.VITE_MAP_DEBUG === "1";
const TRUE_NORTH_VECTOR = new THREE.Vector3(0, 0, -1);

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

function checkpointVerb(kind?: RouteResult["guidanceLegs"][number]["checkpointKind"]): string {
  if (kind === "door") return "到门口";
  if (kind === "stair") return "到楼梯口";
  if (kind === "destination") return "到终点";
  if (kind === "room") return "进房间";
  return "到转折点";
}

const DEFAULT_LAYER: MapSessionState["layerMode"] = "allFloors";
const STRUCTURE_MODEL_CENTERED_SCALE = 8.6 / 30303.743103;
const TAP_SELECT_THRESHOLD = 16;
const runtimeTextureUrlPattern = /\.(?:png|jpe?g|webp)(?:\?.*)?$/i;

function shouldUseMobileRuntimeTextures() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /Android|wv/i.test(navigator.userAgent) ||
    window.matchMedia("(pointer: coarse)").matches ||
    Math.min(window.innerWidth, window.innerHeight) <= 520
  );
}

function mobileRuntimeTextureUrl(url: string) {
  if (!runtimeTextureUrlPattern.test(url)) return url;
  const fileName = url.split("/").pop()?.split("?")[0];
  return fileName ? `/map-models/textures/mobile/${fileName}` : url;
}

const labelDensityRank: Record<LabelDensity, number> = { far: 0, mid: 1, near: 2 };
const singleFloorFocus: Record<FloorId, { position: THREE.Vector3; target: THREE.Vector3; zoom: number }> = {
  "1F": {
    position: new THREE.Vector3(5.4, 7.15, 6.85),
    target: new THREE.Vector3(-0.15, 0.36, 0.46),
    zoom: 0.86,
  },
  "2F": {
    position: new THREE.Vector3(7.1, 7.25, 6.75),
    target: new THREE.Vector3(0.42, 1.16, 0.44),
    zoom: 0.82,
  },
};
const raised202Focus = {
  position: new THREE.Vector3(5.45, 6.8, 5.8),
  target: new THREE.Vector3(2.82, 1.55, 1.1),
  zoom: 1.22,
};
const roomColor: Record<AreaType, number> = {
  teaching: 0x78c96c,
  processing: 0xffa45f,
  lab: 0xb77fea,
  office: 0xffcd56,
  service: 0x67a8ff,
  other: 0xd7dde7,
};
const spaceColor = {
  corridor: 0xaee4ff,
  service: 0xc8ddff,
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
  "1F": 0xf3eadb,
  "2F": 0xeef4fa,
};
const SOLID_LAYER_OPACITY = 0.96;
const PASSIVE_ROOM_OPACITY = 0.94;
const SERVICE_SPACE_OPACITY: Record<keyof typeof spaceColor, number> = {
  corridor: 0.98,
  service: 0.9,
  restroom: 0.94,
  storage: 0.86,
  reserved: 0.82,
  stair: 0.94,
  void: 0.68,
  room: 0.88,
};
const SEMANTIC_RENDER_POLICY = {
  roomSurfaceLift: modelAlignment.slabThickness + 0.025,
  serviceSurfaceLift: modelAlignment.slabThickness + 0.018,
  corridorSurfaceLift: modelAlignment.slabThickness + 0.01,
  wallOverviewScale: {
    outer: 0.24,
    inner: 0.12,
    low: 0.1,
  },
  doorThresholdLift: 0.014,
  doorFrameHeight: {
    passive: 0.1,
    active: 0.16,
  },
  routeKeyPinLift: {
    disc: 0.018,
    ring: 0.045,
    marker: 0.075,
    label: 0.28,
  },
  minimumPassiveRoomOpacity: 0.72,
  minimumServiceOpacity: 0.82,
} as const;
const roomCssClass: Record<AreaType, string> = {
  teaching: "teaching",
  processing: "processing",
  lab: "lab",
  office: "office",
  service: "service",
  other: "other",
};

const secondFloorSupportDecks: SupportDeck[] = [
  {
    id: "2f-west-support",
    floor: "2F",
    label: "108/208 承托区",
    semanticId: "2f-west-support",
    polygon: [
      [90, 70],
      [635, 70],
      [635, 345],
      [90, 345],
    ],
  },
  {
    id: "2f-public-corridor-support",
    floor: "2F",
    label: "公共二层过道承托",
    semanticId: "2f-public-corridor-support",
    polygon: [
      [500, 190],
      [620, 190],
      [620, 272],
      [500, 272],
    ],
  },
  {
    id: "2f-106-support",
    floor: "2F",
    label: "106 二层承托",
    semanticId: "2f-106-support",
    polygon: [
      [760, 15],
      [930, 15],
      [930, 95],
      [760, 95],
    ],
  },
  {
    id: "2f-104-support",
    floor: "2F",
    label: "104 二层承托",
    semanticId: "2f-104-support",
    polygon: [
      [1050, 160],
      [1180, 160],
      [1180, 280],
      [1050, 280],
    ],
  },
  {
    id: "2f-east-service-support",
    floor: "2F",
    label: "东侧服务承托",
    semanticId: "2f-east-service-support",
    polygon: [
      [920, 205],
      [1050, 205],
      [1050, 280],
      [920, 280],
    ],
  },
  {
    id: "2f-east-connector-support",
    floor: "2F",
    label: "东侧过道承托",
    semanticId: "2f-east-connector-support",
    polygon: [
      [920, 160],
      [1050, 160],
      [1050, 245],
      [920, 245],
    ],
  },
  {
    id: "2f-office-support",
    floor: "2F",
    label: "办公区承托",
    semanticId: "2f-office-support",
    polygon: [
      [235, 625],
      [520, 625],
      [520, 705],
      [235, 705],
    ],
  },
];

function isSingleSecondFloor(session: Pick<MapSessionState, "activeFloor" | "layerMode">) {
  return session.layerMode === "single" && session.activeFloor === "2F";
}

function visibleSupportDecksForSession(session: MapSessionState) {
  if (!floorVisibility("2F", session)) return [];
  if (session.layerMode === "allFloors") return [];
  if (session.layerMode === "raised202" || session.layerMode === "section") return [];
  return secondFloorSupportDecks;
}

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
const routeTargetShortcutIds = ["104-2F01", "202-5", "108-2F04", "106-2F", "208", "210", "107-core", "104-1F01"];
const routeStartShortcutIds = ["101", "108-lobby", "104-1F01", "106", "107-core", "208", "202-5", "104-2F01"];
const roomPickerPageSize = 8;

const roomPickerGroups: Array<{ id: RoomPickerGroup; label: string }> = [
  { id: "common", label: "常用" },
  { id: "1F", label: "一层" },
  { id: "2F", label: "二层" },
  { id: "raised202", label: "二层半" },
];

function shouldShowRoomLabel(room: MapRoom, session: MapSessionState, startRoomId?: string) {
  if (room.id === session.selectedRoomId || room.id === session.targetRoomId || room.id === startRoomId) return true;
  if (session.layerMode === "single" || session.layerMode === "section" || session.layerMode === "raised202") return true;
  return true;
}

function roomMinDensity(room: MapRoom, session: MapSessionState, startRoomId?: string, hasRoute = false): LabelDensity {
  if (room.id === session.selectedRoomId || room.id === session.targetRoomId || room.id === startRoomId) return "far";
  if (hasRoute && !overviewLabelRoomIds.has(room.id)) return "mid";
  if (overviewLabelRoomIds.has(room.id)) return "far";
  if (session.layerMode === "raised202") return "mid";
  if (session.layerMode === "single" || session.layerMode === "section") return "mid";
  return "near";
}

function shouldKeepRoomLabelDuringRoute(room: MapRoom, session: MapSessionState, route?: RouteResult, startRoomId?: string): boolean {
  if (!route) return true;
  if (room.id === session.selectedRoomId || room.id === session.targetRoomId || room.id === startRoomId) return true;
  return true;
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

function isModelFirstOverview(session: Pick<MapSessionState, "layerMode">): boolean {
  return false;
}

function isModelAuthorityView(session: Pick<MapSessionState, "activeFloor" | "layerMode">): boolean {
  return session.layerMode === "section";
}

function shouldDrawWholeFloorSlab(floor: FloorGeometry, session: Pick<MapSessionState, "activeFloor" | "layerMode">): boolean {
  if (floor.id === "1F") return true;
  if (session.layerMode === "allFloors") return false;
  if (session.layerMode === "single" && session.activeFloor === "2F") return true;
  return session.layerMode === "raised202" || session.layerMode === "exploded" || session.layerMode === "section";
}

function shouldDrawOuterShellWall(wallId: string, session: Pick<MapSessionState, "activeFloor" | "layerMode">): boolean {
  return true;
}

function shouldDrawWall(
  wall: (typeof jingongMapData.walls)[number],
  wallRoom: MapRoom | undefined,
  session: MapSessionState,
): boolean {
  if (session.layerMode === "allFloors") return false;
  return true;
}

function shouldShowFloorBadge(session: Pick<MapSessionState, "layerMode">): boolean {
  return session.layerMode === "allFloors" || session.layerMode === "single" || session.layerMode === "raised202" || session.layerMode === "exploded" || session.layerMode === "section";
}

function floorBadgeText(floor: FloorGeometry, session: Pick<MapSessionState, "layerMode">) {
  if (session.layerMode === "raised202" && floor.id === "2F") {
    return { text: "2.5F", compactText: "2.5F", fullText: "202 二层半" };
  }
  return { text: floor.label, compactText: floor.id, fullText: floor.label };
}

function shouldDrawSemanticSurfaces(session: MapSessionState): boolean {
  return true;
}

function shouldDrawFocusedFloorSurfaces(session: Pick<MapSessionState, "activeFloor" | "layerMode">): boolean {
  return session.layerMode === "section";
}

function modelOpacityForSession(session: Pick<MapSessionState, "activeFloor" | "layerMode">): number {
  if (session.layerMode === "single") return session.activeFloor === "2F" ? 0.82 : 0.74;
  if (session.layerMode === "raised202") return 0.9;
  if (session.layerMode === "section") return 0.58;
  if (session.layerMode === "exploded") return 0.42;
  return 0.92;
}

function runtimeModelOpacity(role: RuntimeModelRole, session: Pick<MapSessionState, "activeFloor" | "layerMode">): number {
  if (role === "detail") {
    if (session.layerMode === "allFloors") return 0.08;
    if (session.layerMode === "single") return session.activeFloor === "2F" ? 0.66 : 0.72;
    if (session.layerMode === "raised202") return 0.08;
    if (session.layerMode === "section") return 0.62;
    if (session.layerMode === "exploded") return 0.72;
    return modelOpacityForSession(session);
  }
  if (session.layerMode === "single") return session.activeFloor === "2F" ? 0.76 : 0.82;
  if (session.layerMode === "raised202") return 0.1;
  if (session.layerMode === "section") return 0.84;
  if (session.layerMode === "exploded") return 0.8;
  if (session.layerMode === "allFloors") return 0.12;
  return 0.94;
}

function runtimeModelClippingPlanes(session: Pick<MapSessionState, "activeFloor" | "layerMode">): THREE.Plane[] {
  if (session.layerMode === "section") {
    return [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.74)];
  }
  if (session.layerMode === "single" && session.activeFloor === "1F") {
    return [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.56)];
  }
  return [];
}

function isRuntimeReferencePlane(mesh: THREE.Mesh, material?: THREE.Material): boolean {
  const materialName = material?.name ?? "";
  if (["__L1", "____"].includes(materialName)) return true;
  if (mesh.name === "Mesh15" || mesh.name === "Mesh16") return true;
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxHorizontal = Math.max(size.x, size.z);
  const minHorizontal = Math.min(size.x, size.z);
  return size.y < 1e-3 && maxHorizontal > 300000 && minHorizontal > 250000;
}

function runtimeReferencePlaneFloor(mesh: THREE.Mesh, material?: THREE.Material): FloorId | undefined {
  const materialName = material?.name ?? "";
  if (materialName === "__L1" || mesh.name === "Mesh15") return "1F";
  if (materialName === "____" || mesh.name === "Mesh16") return "2F";
  return undefined;
}

function runtimeReferencePlaneOpacity(mesh: THREE.Mesh, material: THREE.Material, session: Pick<MapSessionState, "activeFloor" | "layerMode">): number {
  const floor = runtimeReferencePlaneFloor(mesh, material);
  if (!floor) return 0;
  if (!mapDebugEnabled) return 0;
  if (session.layerMode === "allFloors") return floor === "1F" ? 0.42 : 0.28;
  if (session.layerMode === "exploded") return floor === "1F" ? 0.48 : 0.36;
  if (session.layerMode === "section") return 0.16;
  if (session.layerMode === "single" && session.activeFloor === floor) return floor === "2F" ? 0.14 : 0.18;
  if (session.layerMode === "raised202" && floor === "2F") return 0.16;
  return 0;
}

function layerChipTitle(session: MapSessionState) {
  if (session.layerMode === "single" && session.activeFloor === "1F") return "一层";
  if (session.layerMode === "single" && session.activeFloor === "2F") return "二层";
  if (session.layerMode === "raised202") return "202";
  if (session.layerMode === "exploded") return "分层";
  if (session.layerMode === "section") return "剖切";
  return "全楼";
}

function layerChipHint(session: MapSessionState) {
  if (session.layerMode === "single" && session.activeFloor === "2F") return "二层与 202 可分开查看";
  if (session.layerMode === "single") return "房间、门口和走廊";
  if (session.layerMode === "raised202") return "202 高平台和下方承托";
  if (session.layerMode === "exploded") return "上下层展开查看";
  if (session.layerMode === "section") return "剖开看路线";
  return "整楼导航";
}

function shouldDrawStairBody(session: MapSessionState, onRoute: boolean): boolean {
  if (onRoute) return true;
  return session.layerMode === "allFloors" || session.layerMode === "single" || session.layerMode === "raised202" || session.layerMode === "exploded" || session.layerMode === "section";
}

function routeLabelNudge(roomId: string): { x: number; y: number } {
  if (roomId === "route-current-location") return { x: 48, y: 46 };
  if (roomId === "route-next-portal") return { x: 56, y: -62 };
  if (roomId === "route-target-location") return { x: -92, y: -8 };
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

function cameraViewportProfile(host?: HTMLElement | null): "compactLandscape" | "regular" {
  const width = host?.clientWidth ?? (typeof window !== "undefined" ? window.innerWidth : 0);
  const height = host?.clientHeight ?? (typeof window !== "undefined" ? window.innerHeight : 0);
  return width >= height * 1.55 && height <= 520 ? "compactLandscape" : "regular";
}

function cameraPresetsForViewport(profile: ReturnType<typeof cameraViewportProfile>): Record<CameraPreset, CameraTarget> {
  const compact = profile === "compactLandscape";
  return {
    overview: {
      position: compact ? new THREE.Vector3(6.62, 5.02, 7.35) : new THREE.Vector3(...modelAlignment.defaultCamera.position),
      target: compact ? new THREE.Vector3(0.02, 0.82, 0.1) : new THREE.Vector3(...modelAlignment.defaultCamera.target),
      fov: compact ? 32 : modelAlignment.defaultCamera.fov,
      zoom: compact ? 1.02 : 0.9,
    },
    lowIso: {
      position: compact ? new THREE.Vector3(7.85, 7.35, 8.95) : new THREE.Vector3(7.6, 7.0, 8.4),
      target: compact ? new THREE.Vector3(0.06, 1.28, 0.08) : new THREE.Vector3(0.02, 1.5, 0.12),
      fov: compact ? 37 : 42,
      zoom: compact ? 0.78 : 0.9,
    },
    top: {
      position: new THREE.Vector3(0, 11.4, 0.001),
      target: new THREE.Vector3(0, 0.72, 0),
      fov: compact ? 30 : 32,
      zoom: compact ? 1.02 : 0.88,
    },
    route: {
      position: compact ? new THREE.Vector3(5.05, 6.05, 6.58) : new THREE.Vector3(4.86, 5.62, 6.18),
      target: compact ? new THREE.Vector3(0.02, 1.24, -0.04) : new THREE.Vector3(0.08, 1.28, 0.02),
      fov: compact ? 35 : 32,
      zoom: compact ? 0.88 : 0.94,
    },
  };
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

function pointInsidePolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const last = polygon[previous];
    const crosses =
      current[1] > point[1] !== last[1] > point[1] &&
      point[0] < ((last[0] - current[0]) * (point[1] - current[1])) / (last[1] - current[1]) + current[0];
    if (crosses) inside = !inside;
  }
  return inside;
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

function doorBelongsToRaised202(door: DoorSegment): boolean {
  return door.connects[0]?.startsWith(raised202Space.roomPrefix) ?? false;
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
      semanticId?.includes("stair-108-2f"),
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

function corridorPolygonIsOnRoute(corridor: Point[], floor: FloorId, route?: RouteResult) {
  if (!route) return false;
  return route.points.some((point) => point.floor === floor && pointInsidePolygon(point.point, corridor));
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
  const stepCount = options.publicAccess ? 14 : 10;
  const run = Math.max(0.13, horizontalDistance / stepCount);
  const rise = verticalDistance / stepCount;
  const stairWidth = options.publicAccess ? 0.74 : 0.54;
  const passiveOpacity = options.active ? 1 : 0.74;
  const pairMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xffa000 : options.publicAccess ? 0x8a9bad : 0xb68b57,
    emissive: options.active ? 0xb85d00 : 0x000000,
    emissiveIntensity: options.active ? 0.58 : 0,
    roughness: 0.42,
    metalness: 0.02,
    transparent: !options.active,
    opacity: passiveOpacity,
  });
  const treadMaterial = pairMaterial.clone();
  const riserMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xd77600 : options.publicAccess ? 0x6d7f91 : 0x8e6840,
    emissive: options.active ? 0x8b3d00 : 0x000000,
    emissiveIntensity: options.active ? 0.3 : 0,
    roughness: 0.56,
    metalness: 0.02,
    transparent: !options.active,
    opacity: passiveOpacity,
  });
  const railMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xffc45a : options.publicAccess ? 0x53657a : 0x6d5135,
    emissive: options.active ? 0x9d5300 : 0x000000,
    emissiveIntensity: options.active ? 0.36 : 0,
    roughness: 0.32,
    metalness: 0.08,
    transparent: !options.active,
    opacity: options.active ? 1 : 0.66,
  });
  const nosingMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xfff0bd : options.publicAccess ? 0xf4f7fb : 0xf4dfbf,
    emissive: options.active ? 0xffb340 : 0x000000,
    emissiveIntensity: options.active ? 0.18 : 0,
    roughness: 0.36,
    metalness: 0.02,
    transparent: !options.active,
    opacity: options.active ? 1 : 0.72,
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
    transparent: !options.active,
    opacity: options.active ? 1 : 0.78,
  });
  const undercarriageMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0x9d5200 : options.publicAccess ? 0x748799 : 0x7d5b36,
    roughness: 0.68,
    metalness: 0.02,
    transparent: !options.active,
    opacity: options.active ? 1 : 0.9,
  });

  root.add(makeDisc(a.clone(), stairWidth * 0.66, haloMaterial.clone()));
  root.add(makeDisc(b.clone(), stairWidth * 0.66, haloMaterial.clone()));
  root.add(orientedBox(a.clone().add(new THREE.Vector3(0, 0.03, 0)), stairWidth * 1.18, 0.07, stairWidth * 0.92, angle, landingMaterial.clone(), "stair-lower-platform"));
  root.add(orientedBox(b.clone().add(new THREE.Vector3(0, 0.03, 0)), stairWidth * 1.18, 0.07, stairWidth * 0.92, angle, landingMaterial.clone(), "stair-upper-platform"));
  const stringerMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0xc76a00 : options.publicAccess ? 0x6f8294 : 0x8b653d,
    roughness: 0.62,
    metalness: 0.02,
    transparent: !options.active,
    opacity: options.active ? 1 : 0.82,
  });
  const stringerCenter = a.clone().lerp(b, 0.5);
  const shaftMaterial = new THREE.MeshStandardMaterial({
    color: options.active ? 0x6b3900 : options.publicAccess ? 0x526173 : 0x6f4d2e,
    roughness: 0.74,
    metalness: 0.02,
    transparent: !options.active,
    opacity: options.active ? 0.82 : 0.38,
  });
  const shaftCenter = stringerCenter.clone().add(new THREE.Vector3(0, -verticalDistance * 0.18, 0));
  root.add(orientedBox(shaftCenter, horizontalDistance * 1.02, Math.max(0.18, verticalDistance * 0.52), stairWidth * 1.12, angle, shaftMaterial, "stair-open-shaft"));
  root.add(orientedBox(stringerCenter.clone().add(new THREE.Vector3(0, -0.035, 0)), horizontalDistance * 0.98, 0.075, stairWidth * 0.78, angle, undercarriageMaterial.clone(), "stair-solid-undercarriage"));
  root.add(orientedBox(stringerCenter.clone().add(side.clone().multiplyScalar(stairWidth * 0.48)), horizontalDistance * 0.98, 0.06, 0.07, angle, stringerMaterial.clone(), "stair-left-stringer"));
  root.add(orientedBox(stringerCenter.clone().sub(side.clone().multiplyScalar(stairWidth * 0.48)), horizontalDistance * 0.98, 0.06, 0.07, angle, stringerMaterial.clone(), "stair-right-stringer"));

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

function addStairPortalPairMarker(root: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, options: { active: boolean; publicAccess: boolean }) {
  const color = options.active ? 0x0b6cff : options.publicAccess ? 0x60758a : 0x9a6b3f;
  const postMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.04,
    transparent: true,
    opacity: options.active ? 0.96 : 0.7,
    emissive: options.active ? 0x073c9b : 0x000000,
    emissiveIntensity: options.active ? 0.28 : 0,
  });
  const guideMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: options.active ? 0.5 : 0.22 });
  const radius = options.active ? 0.27 : options.publicAccess ? 0.23 : 0.18;
  root.add(makeBeaconRing(a.clone().add(new THREE.Vector3(0, 0.045, 0)), radius, color, options.active ? 0.62 : 0.38));
  root.add(makeBeaconRing(b.clone().add(new THREE.Vector3(0, 0.045, 0)), radius, color, options.active ? 0.62 : 0.38));
  const lowerPost = new THREE.Mesh(new THREE.CylinderGeometry(options.active ? 0.028 : 0.02, options.active ? 0.034 : 0.026, options.active ? 0.24 : 0.18, 14), postMaterial.clone());
  lowerPost.position.copy(a.clone().add(new THREE.Vector3(0, 0.12, 0)));
  lowerPost.name = "stair-portal-lower-marker";
  root.add(lowerPost);
  const upperPost = new THREE.Mesh(new THREE.CylinderGeometry(options.active ? 0.028 : 0.02, options.active ? 0.034 : 0.026, options.active ? 0.24 : 0.18, 14), postMaterial.clone());
  upperPost.position.copy(b.clone().add(new THREE.Vector3(0, 0.12, 0)));
  upperPost.name = "stair-portal-upper-marker";
  root.add(upperPost);
  if (options.active) {
    const guide = tubeBetween(a.clone().add(new THREE.Vector3(0, 0.2, 0)), b.clone().add(new THREE.Vector3(0, 0.2, 0)), 0.014, guideMaterial);
    guide.name = "stair-portal-pair-guide";
    root.add(guide);
    addDirectionalArrows(root, a.clone().add(new THREE.Vector3(0, 0.28, 0)), b.clone().add(new THREE.Vector3(0, 0.28, 0)), postMaterial.clone(), 0.82);
  }
}

function doorSegmentToVector(door: DoorSegment, endpoint: "from" | "to", session: MapSessionState, lift = SEMANTIC_RENDER_POLICY.doorThresholdLift) {
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
  const isFocus = session.layerMode === "raised202";
  for (let index = 0; index < polygon.length; index++) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    const lower = new THREE.Vector3(
      ...mapPointToModel(from, "2F", {
        ...modelOptions,
        semanticId: "raised-202-rim",
        lift: modelAlignment.slabThickness + 0.04,
      }),
    );
    const upperStart = new THREE.Vector3(
      ...mapPointToModel(from, "2F", {
        ...modelOptions,
        semanticId: "raised-202-rim",
        lift: modelAlignment.slabThickness + raised202Space.height + 0.04,
      }),
    );
    const upperEnd = new THREE.Vector3(
      ...mapPointToModel(to, "2F", {
        ...modelOptions,
        semanticId: "raised-202-rim",
        lift: modelAlignment.slabThickness + raised202Space.height + 0.04,
      }),
    );
    root.add(tubeBetween(upperStart, upperEnd, isFocus ? 0.018 : 0.012, material.clone()));
    if (index % 2 === 0 || isFocus) {
      const post = tubeBetween(lower, upperStart, isFocus ? 0.011 : 0.008, material.clone());
      post.name = `raised-202-support-${index}`;
      root.add(post);
    }
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
    const radius = session.layerMode === "raised202" ? 0.026 : session.layerMode === "exploded" ? 0.018 : 0.012;
    root.add(tubeBetween(point, points[index + 1], radius, material.clone()));
  });
  polygon.forEach((point, index) => {
    const [x, y, z] = mapPointToModel(point, "2F", {
      ...modelOptions,
      semanticId: "raised-202-outline-post",
      lift: modelAlignment.slabThickness + raised202Space.height * 0.56,
    });
    const postRadius = session.layerMode === "raised202" ? 0.024 : 0.014;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, raised202Space.height * 0.76, 12), material.clone());
    post.position.set(x, y, z);
    post.name = `raised-202-corner-post-${index}`;
    root.add(post);
  });
  return root;
}

function raisedPlatformBoundaryWall(session: MapSessionState, material: THREE.Material) {
  const root = new THREE.Group();
  if (session.layerMode === "allFloors") return root;
  const polygon = raised202Space.platformPolygon;
  const modelOptions = { layerMode: session.layerMode, activeFloor: session.activeFloor };
  const focus = session.layerMode === "raised202";
  const height = focus ? 0.18 : 0.13;
  const thickness = focus ? 0.046 : 0.032;
  for (let index = 0; index < polygon.length; index++) {
    const from = new THREE.Vector3(
      ...mapPointToModel(polygon[index], "2F", {
        ...modelOptions,
        semanticId: "raised-202-boundary",
        lift: modelAlignment.slabThickness + raised202Space.height + height / 2,
      }),
    );
    const to = new THREE.Vector3(
      ...mapPointToModel(polygon[(index + 1) % polygon.length], "2F", {
        ...modelOptions,
        semanticId: "raised-202-boundary",
        lift: modelAlignment.slabThickness + raised202Space.height + height / 2,
      }),
    );
    const length = from.distanceTo(to);
    if (length < 0.001) continue;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), material.clone());
    wall.position.copy(from.clone().add(to).multiplyScalar(0.5));
    wall.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);
    wall.name = `raised-202-boundary-wall-${index}`;
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);
  }
  return root;
}

function raisedPlatformLowerContext(session: MapSessionState, material: THREE.Material) {
  const root = new THREE.Group();
  const polygon = raised202Space.platformPolygon;
  const modelOptions = { layerMode: session.layerMode, activeFloor: session.activeFloor };
  const detailedContext = session.layerMode === "raised202" || session.layerMode === "exploded";
  const supportMaterial = new THREE.MeshStandardMaterial({
    color: detailedContext ? 0xd5c6ad : 0x8fa2b1,
    roughness: 0.82,
    metalness: 0.01,
    transparent: !detailedContext,
    opacity: detailedContext ? 1 : 0.2,
  });
  const surface = extrudedPolygonMesh(
    polygon,
    "2F",
    session,
    detailedContext ? 0.052 : 0.042,
    new THREE.MeshStandardMaterial({
      color: detailedContext ? 0xe6dac4 : 0xd9e4ec,
      roughness: 0.82,
      metalness: 0.01,
      transparent: !detailedContext,
      opacity: detailedContext ? 1 : 0.16,
    }),
    modelAlignment.slabThickness + 0.006,
    "202-lower-context",
  );
  surface.name = "raised-202-lower-context-surface";
  surface.receiveShadow = true;
  root.add(surface);

  const lowerPoints = polygon.map((point) => {
    const [x, y, z] = mapPointToModel(point, "2F", {
      ...modelOptions,
      semanticId: "202-lower-context",
      lift: modelAlignment.slabThickness + 0.075,
    });
    return new THREE.Vector3(x, y, z);
  });

  lowerPoints.forEach((point, index) => {
    const next = lowerPoints[(index + 1) % lowerPoints.length];
    const edge = tubeBetween(point, next, detailedContext ? 0.02 : 0.014, supportMaterial.clone());
    edge.name = `raised-202-lower-context-edge-${index}`;
    root.add(edge);
  });

  if (detailedContext) {
    const foundation = extrudedPolygonMesh(
      polygon,
      "2F",
      session,
      0.04,
      new THREE.MeshStandardMaterial({
        color: 0x9b8468,
        roughness: 0.74,
        metalness: 0.01,
        transparent: false,
        opacity: 1,
      }),
      0,
      "raised-202-foundation",
    );
    foundation.position.y += modelAlignment.slabThickness - 0.035;
    foundation.name = "raised-202-lower-foundation";
    root.add(foundation);
  }

  const ribMaterial = withOpacity(supportMaterial.clone(), detailedContext ? 0.92 : 0.42);
  const [minX, minY] = polygon.reduce<Point>((acc, point) => [Math.min(acc[0], point[0]), Math.min(acc[1], point[1])], [Infinity, Infinity]);
  const [maxX, maxY] = polygon.reduce<Point>((acc, point) => [Math.max(acc[0], point[0]), Math.max(acc[1], point[1])], [-Infinity, -Infinity]);
  const ribLift = modelAlignment.slabThickness + 0.095;
  if (!detailedContext) {
    return root;
  }

  for (let y = minY + 44; y < maxY - 18; y += 52) {
    const from = new THREE.Vector3(
      ...mapPointToModel([minX + 18, y], "2F", {
        ...modelOptions,
        semanticId: "202-lower-context",
        lift: ribLift,
      }),
    );
    const to = new THREE.Vector3(
      ...mapPointToModel([maxX - 18, y], "2F", {
        ...modelOptions,
        semanticId: "202-lower-context",
        lift: ribLift,
      }),
    );
    const rib = tubeBetween(from, to, 0.012, ribMaterial.clone());
    rib.name = `raised-202-lower-context-rib-y-${Math.round(y)}`;
    root.add(rib);
  }
  for (let x = minX + 64; x < maxX - 18; x += 78) {
    const from = new THREE.Vector3(
      ...mapPointToModel([x, minY + 18], "2F", {
        ...modelOptions,
        semanticId: "202-lower-context",
        lift: ribLift + 0.002,
      }),
    );
    const to = new THREE.Vector3(
      ...mapPointToModel([x, maxY - 18], "2F", {
        ...modelOptions,
        semanticId: "202-lower-context",
        lift: ribLift + 0.002,
      }),
    );
    const rib = tubeBetween(from, to, 0.009, withOpacity(supportMaterial.clone(), detailedContext ? 0.76 : 0.44));
    rib.name = `raised-202-lower-context-rib-x-${Math.round(x)}`;
    root.add(rib);
  }

  lowerPoints.forEach((point, index) => {
    if (index % 2 !== 0) return;
    const upper = point.clone();
    upper.y += raised202Space.height * 0.72;
    const post = tubeBetween(point, upper, 0.018, supportMaterial.clone());
    post.name = `raised-202-lower-context-post-${index}`;
    root.add(post);
  });

  return root;
}

function supportDeckGeometry(session: MapSessionState, deck: SupportDeck, material: THREE.Material, edgeMaterial: THREE.Material) {
  const root = new THREE.Group();
  const isFocused = session.layerMode === "single" && session.activeFloor === "2F";
  const mesh = extrudedPolygonMesh(deck.polygon, deck.floor, session, isFocused ? 0.045 : 0.028, material, 0, deck.semanticId);
  mesh.position.y += modelAlignment.slabThickness + 0.006;
  mesh.name = deck.id;
  mesh.receiveShadow = true;
  root.add(mesh);

  const outline = [...deck.polygon, deck.polygon[0]].map((point) => {
    const [x, y, z] = mapPointToModel(point, deck.floor, {
      layerMode: session.layerMode,
      activeFloor: session.activeFloor,
      semanticId: deck.semanticId,
      lift: modelAlignment.slabThickness + (isFocused ? 0.075 : 0.052),
    });
    return new THREE.Vector3(x, y, z);
  });
  outline.slice(0, -1).forEach((point, index) => {
    const edge = tubeBetween(point, outline[index + 1], isFocused ? 0.012 : 0.008, edgeMaterial.clone());
    edge.name = `${deck.id}-edge-${index}`;
    root.add(edge);
  });
  return root;
}

function routePointToVector(point: RouteResult["points"][number], session: MapSessionState) {
  const routeLiftBoost = session.layerMode === "allFloors" ? 0.018 : session.layerMode === "raised202" ? 0.035 : 0;
  const [x, y, z] = mapPointToModel(point.point, point.floor, {
    layerMode: session.layerMode,
    activeFloor: session.activeFloor,
    semanticId: point.nodeId,
    lift: modelAlignment.routeLift + routeLiftBoost + raised202LiftForPoint(point.point, point.floor),
  });
  return new THREE.Vector3(x, y, z);
}

function routePointVisibleForSession(point: RouteResult["points"][number], session: MapSessionState): boolean {
  return semanticVisibleForSession(point.floor, session, { point: point.point, semanticId: point.nodeId });
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
  requestPermission: () => Promise<void>;
} {
  const missingSensorTimerRef = useRef<number | undefined>();
  const [state, setState] = useState<DeviceHeadingState>({
    supported: typeof window !== "undefined" && "DeviceOrientationEvent" in window,
    calibrated: false,
    calibrationOffset: 0,
    permissionState: "idle",
    statusMessage: "使用真实南北方向作为地图基准",
  });

  const attachOrientationListener = useCallback(() => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const degrees = typeof webkitHeading === "number" ? webkitHeading : typeof event.alpha === "number" ? 360 - event.alpha : undefined;
      if (degrees === undefined || Number.isNaN(degrees)) return;
      if (missingSensorTimerRef.current !== undefined) {
        window.clearTimeout(missingSensorTimerRef.current);
        missingSensorTimerRef.current = undefined;
      }
      const radians = normalizeRadians(THREE.MathUtils.degToRad(degrees));
      setState((current) => ({
        ...current,
        heading: current.heading === undefined ? radians : normalizeRadians(current.heading * 0.82 + radians * 0.18),
        supported: true,
        permissionState: "granted",
        statusMessage: undefined,
      }));
    };
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  useEffect(() => attachOrientationListener(), [attachOrientationListener]);

  const setCalibrationOffset = useCallback((offset: number) => {
    setState((current) => ({ ...current, calibrated: true, calibrationOffset: offset }));
  }, []);

  const requestPermission = useCallback(async () => {
    const markSensorPending = () => {
      if (typeof window === "undefined") return;
      if (missingSensorTimerRef.current !== undefined) window.clearTimeout(missingSensorTimerRef.current);
      missingSensorTimerRef.current = window.setTimeout(() => {
        setState((current) =>
          current.heading === undefined
            ? {
                ...current,
                supported: false,
                permissionState: "denied",
                statusMessage: "当前环境没有返回方向传感器数据；模拟器可继续使用真北基准。",
              }
            : current,
        );
      }, 1200);
    };
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setState((current) => ({
        ...current,
        supported: false,
        permissionState: "denied",
        statusMessage: "当前环境不支持方向传感器；地图按真实北向显示。",
      }));
      return;
    }
    const eventCtor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof eventCtor.requestPermission !== "function") {
      setState((current) => ({
        ...current,
        supported: true,
        permissionState: "granted",
        statusMessage: "正在等待方向传感器数据。",
      }));
      markSensorPending();
      return;
    }
    setState((current) => ({ ...current, permissionState: "requesting", statusMessage: "正在请求方向传感器权限。" }));
    try {
      const result = await eventCtor.requestPermission();
      setState((current) => ({
        ...current,
        supported: result === "granted",
        permissionState: result === "granted" ? "granted" : "denied",
        statusMessage: result === "granted" ? "正在等待方向传感器数据。" : "方向权限被拒绝；地图按真实北向显示。",
      }));
      if (result === "granted") markSensorPending();
    } catch {
      setState((current) => ({
        ...current,
        supported: false,
        permissionState: "denied",
        statusMessage: "无法读取方向传感器；地图按真实北向显示。",
      }));
    }
  }, []);

  useEffect(
    () => () => {
      if (missingSensorTimerRef.current !== undefined) window.clearTimeout(missingSensorTimerRef.current);
    },
    [],
  );

  return { ...state, setCalibrationOffset, requestPermission };
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
  const [panelSize, setPanelSize] = useState<PanelSize>("expanded");
  const [routePage, setRoutePage] = useState<RoutePage>("setup");
  const [roomPickerGroup, setRoomPickerGroup] = useState<RoomPickerGroup>("common");
  const [roomPickerPage, setRoomPickerPage] = useState(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>("perspective");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [statusText, setStatusText] = useState("正在加载地图");
  const [labelLayout, setLabelLayout] = useState<LabelLayout[]>([]);
  const [headingLayout, setHeadingLayout] = useState<HeadingLayout | undefined>();
  const [northLayout, setNorthLayout] = useState<NorthLayout>({ angle: 0, label: "真北" });
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
  const northLayoutSignatureRef = useRef("");
  const sessionLayerModeRef = useRef<MapSessionState["layerMode"]>(session.layerMode);
  const focusedLegSignatureRef = useRef("");
  const panelDragStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setSession(defaultSession(entrySource, initialRequest));
    setPanel("none");
    setPanelSize("expanded");
    setRoutePage("setup");
    setRoomPickerGroup("common");
    setRoomPickerPage(0);
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
  const activeLegVisibleInLayer = useMemo(() => {
    if (!route || !activeLeg) return true;
    const from = route.points.find((point) => point.nodeId === activeLeg.fromNodeId);
    const to = route.points.find((point) => point.nodeId === activeLeg.toNodeId);
    return Boolean((from && routePointVisibleForSession(from, session)) || (to && routePointVisibleForSession(to, session)));
  }, [activeLeg, route, session.activeFloor, session.layerMode]);
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
        lift: 0.28 + raised202LiftForRoom(startRoom.id, startRoom.floor),
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
    const presets = cameraPresetsForViewport(cameraViewportProfile(hostRef.current));
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

  const focusActiveLeg = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !route || !activeLeg) {
      focusRoute();
      return;
    }
    const from = routeNodeToVector(activeLeg.fromNodeId, route, session);
    const to = routeNodeToVector(activeLeg.toNodeId, route, session);
    if (!from || !to) {
      focusRoute();
      return;
    }
    const midpoint = from.clone().lerp(to, 0.52);
    midpoint.y += activeLeg.checkpointKind === "stair" ? 0.24 : 0.12;
    const compact = cameraViewportProfile(hostRef.current) === "compactLandscape";
    const offset = activeLeg.checkpointKind === "stair"
      ? compact
        ? new THREE.Vector3(3.18, 4.45, 3.55)
        : new THREE.Vector3(3.0, 4.1, 3.38)
      : compact
        ? new THREE.Vector3(2.86, 4.18, 3.18)
        : new THREE.Vector3(2.62, 3.82, 2.95);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.copy(midpoint).add(offset);
      camera.fov = compact ? 34 : 35;
      camera.up.set(0, 1, 0);
      camera.updateProjectionMatrix();
    } else if (camera instanceof THREE.OrthographicCamera) {
      camera.position.copy(midpoint).add(new THREE.Vector3(0, 8.8, 0.001));
      camera.zoom = activeLeg.checkpointKind === "stair" ? 1.24 : 1.38;
      camera.up.set(0, 0, -1);
      camera.updateProjectionMatrix();
    }
    controls.target.copy(midpoint);
    controls.update();
    setActiveCameraPreset("free");
  }, [activeLeg, focusRoute, route, session.activeFloor, session.layerMode]);

  useEffect(() => {
    if (!route || !activeLeg) return;
    if (session.layerMode !== "allFloors") return;
    if (!activeLegVisibleInLayer) return;
    const signature = `${route.id}:${activeLeg.index}`;
    if (signature === focusedLegSignatureRef.current) return;
    focusedLegSignatureRef.current = signature;
    const timer = window.setTimeout(() => focusActiveLeg(), 120);
    return () => window.clearTimeout(timer);
  }, [activeLeg?.index, activeLegVisibleInLayer, focusActiveLeg, route?.id, session.layerMode]);

  const focusSingleFloor = useCallback((floor: FloorId) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const preset = sessionLayerModeRef.current === "raised202" ? raised202Focus : singleFloorFocus[floor];
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.position.copy(preset.position);
      camera.fov = floor === "2F" ? 34 : 34;
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
      const rightGuard = density === "near" && (label.variant === "room" || label.variant === "compact-room") ? 42 : 84;
      const edgeGuard = density === "near" ? 4 : 8;
      const outside = box.x < edgeGuard || box.y < edgeGuard || box.x + box.width > width - rightGuard || box.y + box.height > height - edgeGuard;
      const isCompactRoom = label.variant === "compact-room";
      const relaxedNearRoom = density === "near" && (isCompactRoom || label.variant === "room") && !label.roomId.startsWith("route-");
      const trackCollisions = !relaxedNearRoom;
      const collides = trackCollisions && occupied.some(
        (item) =>
          box.x < item.x + item.width &&
          box.x + box.width > item.x &&
          box.y < item.y + item.height &&
          box.y + box.height > item.y,
      );
      const isRouteLabel = label.roomId.startsWith("route-");
      const allowPriorityOverride = !isRouteLabel && (label.priority >= 108 || label.priority >= 90);
      const visible = label.visible && !outside && (!collides || allowPriorityOverride || relaxedNearRoom);
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

    const northFrom = controlsRef.current?.target.clone() ?? new THREE.Vector3();
    const northTo = northFrom.clone().add(TRUE_NORTH_VECTOR);
    const projectedFrom = northFrom.clone().project(camera);
    const projectedTo = northTo.clone().project(camera);
    const northAngle = Math.atan2(projectedTo.y - projectedFrom.y, projectedTo.x - projectedFrom.x) + Math.PI / 2;
    const northSignature = `${Math.round(northAngle * 1000)}:${density}`;
    if (northSignature !== northLayoutSignatureRef.current) {
      northLayoutSignatureRef.current = northSignature;
      setNorthLayout({ angle: northAngle, label: "真北" });
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

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (error) {
      setLoadState("error");
      setStatusText("当前环境无法创建 WebGL 地图，请在支持 WebGL 的浏览器或设备上打开");
      sceneRef.current = scene;
      return () => {
        disposeObject(scene);
        sceneRef.current = null;
      };
    }
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

    const loader = new GLTFLoader();
    loader.setResourcePath("/map-models/textures/");
    const manager = loader.manager;
    if (shouldUseMobileRuntimeTextures()) {
      manager.setURLModifier(mobileRuntimeTextureUrl);
    }
    let cancelled = false;
    const loadingFallbackTimer = window.setTimeout(() => {
      if (cancelled) return;
      setLoadState((current) => (current === "loading" ? "fallback" : current));
      setStatusText((current) => (current === "正在加载地图" ? "导览图层已就绪" : current));
    }, 4200);
    const modelGroup = new THREE.Group();
    modelGroup.name = "runtime-model-root";
    scene.add(modelGroup);
    modelRootRef.current = modelGroup;

    const prepareRuntimeModel = (model: THREE.Object3D, role: RuntimeModelRole, scale: number) => {
      if (role === "structure") {
        model.rotation.x = -Math.PI / 2;
        model.updateMatrixWorld(true);
      }
      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.scale.setScalar(scale);
      const yOffset = role === "structure" ? 0.02 : -0.015;
      model.position.set(-center.x * scale, -center.y * scale + yOffset, -center.z * scale);
      model.name = role === "structure" ? "precise-structure-model" : "visual-detail-model";
      model.userData.runtimeModelRole = role;
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.userData.runtimeModelRole = role;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!mesh.material) return;
        materialList(mesh.material).forEach((material) => {
          const displayMaterial = material as THREE.MeshStandardMaterial;
          const isReferencePlane = role === "detail" && isRuntimeReferencePlane(mesh, material);
          if ("emissive" in displayMaterial) displayMaterial.emissive.set(0x000000);
          if (role === "structure" && "color" in displayMaterial) {
            displayMaterial.color.set(0xe2e9f0);
            displayMaterial.roughness = 0.7;
            displayMaterial.metalness = 0.01;
          }
          material.side = THREE.DoubleSide;
          const opacity = isReferencePlane ? runtimeReferencePlaneOpacity(mesh, material, { layerMode: sessionLayerModeRef.current, activeFloor: "2F" }) : runtimeModelOpacity(role, { layerMode: sessionLayerModeRef.current, activeFloor: "2F" });
          material.transparent = opacity < 1;
          material.opacity = opacity;
          material.depthWrite = opacity >= 0.78;
          material.needsUpdate = true;
        });
      });
      return model;
    };

    const loadRuntimeModel = (url: string, role: RuntimeModelRole, scale: number) => {
      loader.load(
        url,
        (gltf) => {
          if (cancelled) {
            disposeObject(gltf.scene);
            return;
          }
          const previous = modelGroup.children.filter((child) => child.userData.runtimeModelRole === role);
          previous.forEach((child) => {
            modelGroup.remove(child);
            disposeObject(child);
          });
          const model = prepareRuntimeModel(gltf.scene, role, scale);
          modelGroup.add(model);
          window.clearTimeout(loadingFallbackTimer);
          setLoadState(role === "detail" ? "ready" : (current) => (current === "loading" ? "fallback" : current));
          setStatusText(role === "detail" ? "地图已加载" : "结构底图已加载");
          fitCamera();
        },
        undefined,
        () => {
          if (role === "detail") {
            setStatusText("主地图加载失败，启用备用结构");
            loadRuntimeModel("/map-models/jingong-fallback.glb", "structure", STRUCTURE_MODEL_CENTERED_SCALE);
            return;
          }
          setLoadState("error");
          setStatusText("地图加载失败，保留导航图层");
        },
      );
    };

    loadRuntimeModel("/map-models/jingong.glb", "detail", jingongMapData.calibration.runtimeFit.centeredScale);

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
      window.clearTimeout(loadingFallbackTimer);
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
    model.visible = mapDebugEnabled || session.layerMode === "section";
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const role = (mesh.userData.runtimeModelRole === "structure" ? "structure" : "detail") satisfies RuntimeModelRole;
      materialList(mesh.material).forEach((material) => {
        const displayMaterial = material as THREE.MeshStandardMaterial;
        const isReferencePlane = role === "detail" && isRuntimeReferencePlane(mesh, material);
        const opacity = isReferencePlane ? runtimeReferencePlaneOpacity(mesh, material, session) : runtimeModelOpacity(role, session);
        if ("emissive" in displayMaterial) displayMaterial.emissive.set(0x000000);
        material.transparent = opacity < 1;
        material.opacity = opacity;
        material.depthWrite = opacity >= 0.78;
        material.needsUpdate = true;
      });
    });

    renderer.clippingPlanes = runtimeModelClippingPlanes(session);
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
    const modelFirstOverview = isModelFirstOverview(session);
    const modelAuthorityView = isModelAuthorityView(session);
    const focusedFloorMap = session.layerMode === "single" || session.layerMode === "section";
    const drawSemanticSurfaces = shouldDrawSemanticSurfaces(session);
    const drawFocusedFloorSurfaces = shouldDrawFocusedFloorSurfaces(session);
    const routeActiveRoomIds = new Set([route?.startRoomId, route?.targetRoomId].filter((item): item is string => Boolean(item)));

    const corridorMaterial = new THREE.MeshStandardMaterial({
      color: focusedFloorMap ? 0xb7e8ff : session.layerMode === "exploded" ? 0xc9edf8 : 0xbfe7ff,
      emissive: 0x063b58,
      emissiveIntensity: focusedFloorMap ? 0.03 : 0.05,
      roughness: 0.62,
      metalness: 0.02,
      transparent: true,
      opacity: focusedFloorMap ? 1 : session.layerMode === "exploded" ? 0.92 : 0.98,
    });
    const raisedCorridorMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "raised202" ? 0xaee4ff : session.layerMode === "exploded" ? 0xb8e6f6 : 0xbfeaff,
      emissive: 0x07506b,
      emissiveIntensity: session.layerMode === "raised202" ? 0.07 : 0.05,
      roughness: 0.64,
      metalness: 0.02,
      transparent: true,
      opacity: session.layerMode === "raised202" ? 0.98 : session.layerMode === "exploded" ? 0.92 : 0.96,
    });
    const routeCorridorMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9e8ff,
      emissive: 0x0a7fb8,
      emissiveIntensity: 0.13,
      roughness: 0.58,
      metalness: 0.01,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const corridorEdgeMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "exploded" ? 0x236f95 : 0x0a8dcc,
      emissive: 0x063f6d,
      emissiveIntensity: session.layerMode === "exploded" ? 0.04 : 0.1,
      roughness: 0.45,
      metalness: 0.02,
      transparent: true,
      opacity: focusedFloorMap ? 0.96 : session.layerMode === "exploded" ? 0.7 : modelFirstOverview ? 0.58 : 0.84,
    });
    const raisedPlatformSideMaterial = new THREE.MeshStandardMaterial({
      color:
        session.layerMode === "single" && session.activeFloor === "2F"
          ? 0x53697e
          : session.layerMode === "raised202"
            ? 0x6d879c
            : session.layerMode === "exploded"
              ? 0x6f859a
              : 0x2388a8,
      emissive: 0x06384b,
      emissiveIntensity:
        session.layerMode === "single" && session.activeFloor === "2F" || session.layerMode === "raised202" ? 0 : session.layerMode === "exploded" ? 0 : 0.08,
      roughness: 0.7,
      metalness: 0.04,
      transparent: true,
      opacity: session.layerMode === "single" && session.activeFloor === "2F" ? 0.64 : session.layerMode === "raised202" ? 0.9 : session.layerMode === "exploded" ? 0.72 : 0.82,
    });
    const floorEdgeMaterial = new THREE.LineBasicMaterial({ color: singleFocus ? 0x52677f : 0x5d748b, transparent: true, opacity: singleFocus ? 0.96 : 0.86 });
    const floorShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x9aabbf,
      transparent: true,
      opacity: session.layerMode === "exploded" ? 0.08 : 0.04,
      depthWrite: false,
    });
    const raisedEdgeMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "raised202" ? 0x264e73 : 0x5f7890,
      emissive: session.layerMode === "raised202" ? 0x001e34 : 0x000000,
      emissiveIntensity: session.layerMode === "raised202" ? 0.04 : 0,
      roughness: 0.42,
      metalness: 0.02,
      transparent: true,
      opacity: session.layerMode === "raised202" ? 0.94 : session.layerMode === "exploded" ? 0.78 : 0.82,
    });
    const raisedLowerContextMaterial = new THREE.MeshBasicMaterial({
      color: 0x47687f,
      transparent: true,
      opacity: session.layerMode === "single" && session.activeFloor === "2F" ? 0.82 : session.layerMode === "allFloors" || session.layerMode === "raised202" ? 0.72 : 0.6,
      depthWrite: true,
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
      color: singleFocus ? 0x6d8093 : session.layerMode === "exploded" ? 0x8ea3b5 : 0x6f8294,
      roughness: 0.78,
      metalness: 0.02,
      transparent: true,
      opacity: singleFocus ? 1 : session.layerMode === "allFloors" ? 0.72 : session.layerMode === "exploded" ? 0.58 : 0.92,
    });
    const innerWallMaterial = new THREE.MeshStandardMaterial({
      color: singleFocus ? 0x9fb1c1 : session.layerMode === "exploded" ? 0xb6c6d3 : 0x9dadbd,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      opacity: singleFocus ? 1 : session.layerMode === "allFloors" ? 0.58 : session.layerMode === "exploded" ? 0.46 : 0.84,
    });
    const lowWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fb1c0,
      roughness: 0.8,
      metalness: 0.01,
      transparent: true,
      opacity: session.layerMode === "allFloors" ? 0.48 : session.layerMode === "exploded" ? 0.36 : 0.78,
    });
    const serviceMaterials = Object.fromEntries(
      Object.entries(spaceColor).map(([kind, color]) => [
        kind,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.76,
          metalness: 0.02,
          transparent: true,
          opacity: Math.max(
            modelAuthorityView ? SEMANTIC_RENDER_POLICY.minimumServiceOpacity : SERVICE_SPACE_OPACITY[kind as keyof typeof spaceColor],
            SEMANTIC_RENDER_POLICY.minimumServiceOpacity,
          ),
        }),
      ]),
    ) as Record<keyof typeof spaceColor, THREE.MeshStandardMaterial>;
    const supportDeckMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "single" && session.activeFloor === "2F" ? 0xd0e2ef : 0xd5e4ef,
      roughness: 0.86,
      metalness: 0.01,
      transparent: true,
      opacity: session.layerMode === "allFloors" ? 0.34 : session.layerMode === "exploded" ? 0.5 : 0.9,
    });
    const supportDeckEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x60788d,
      roughness: 0.62,
      metalness: 0.02,
      transparent: true,
      opacity: session.layerMode === "allFloors" ? 0.36 : 0.72,
    });
    const raisedPlatformWallMaterial = new THREE.MeshStandardMaterial({
      color: session.layerMode === "raised202" ? 0x5f768a : 0x7c91a4,
      roughness: 0.74,
      metalness: 0.02,
      transparent: session.layerMode !== "raised202",
      opacity: session.layerMode === "raised202" ? 0.96 : 0.72,
    });

    for (const floor of jingongMapData.floors) {
      if (!floorVisibility(floor.id, session)) continue;
      const shouldDrawWholeFloorShell =
        (drawSemanticSurfaces &&
          shouldDrawWholeFloorSlab(floor, session)) ||
        (drawFocusedFloorSurfaces && floor.id === "2F");
      const shellOutline =
        session.layerMode === "raised202" && floor.id === "2F"
          ? raised202Space.platformPolygon
          : floor.outline;
      if (shouldDrawWholeFloorShell) {
        const floorShellSemanticId = session.layerMode === "raised202" && floor.id === "2F" ? "raised-202-shell" : undefined;
        const floorShellOpacity =
          drawFocusedFloorSurfaces
            ? session.layerMode === "raised202"
              ? 0.78
              : 0.14
          : session.layerMode === "raised202"
            ? 0.72
            : session.layerMode === "exploded"
              ? EXPLODED_FLOOR_OPACITY[floor.id]
              : isSingleSecondFloor(session) && floor.id === "2F"
                ? 0.48
              : session.layerMode === "allFloors"
                ? floor.id === "2F" ? 0.28 : 0.92
                : 1;
        const slab = extrudedPolygonMesh(
          shellOutline.length >= 3 ? shellOutline : floor.outline,
          floor.id,
          session,
          modelAlignment.slabThickness,
          semanticPlaneMaterial({
            color: drawFocusedFloorSurfaces ? 0xf7f9fc : FLOOR_SHELL_COLOR[floor.id],
            opacity: floorShellOpacity,
            roughness: floor.id === "2F" ? 0.9 : 0.84,
          }),
          0,
          floorShellSemanticId,
        );
        slab.name = `${floor.id}-semantic-slab`;
        slab.receiveShadow = true;
        building.add(slab);
        const outlineSource = shellOutline.length >= 3 ? shellOutline : floor.outline;
        if (!drawFocusedFloorSurfaces) {
          const shadow = extrudedPolygonMesh(outlineSource, floor.id, session, 0.004, floorShadowMaterial.clone(), -0.022, floorShellSemanticId ?? `${floor.id}-shadow`);
          shadow.name = `${floor.id}-soft-shadow`;
          building.add(shadow);
        }

        const outlinePoints = [...outlineSource, outlineSource[0]].map((point) => {
          const [x, y, z] = mapPointToModel(point, floor.id, { ...modelOptions, semanticId: floorShellSemanticId, lift: modelAlignment.slabThickness + 0.012 });
          return new THREE.Vector3(x, y, z);
        });
        building.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePoints), drawFocusedFloorSurfaces ? withOpacity(floorEdgeMaterial.clone(), 0.2) : floorEdgeMaterial.clone()));
        if (session.layerMode === "exploded" && floor.id === "2F") {
          outlinePoints.slice(0, -1).forEach((point, pointIndex) => {
            const edge = tubeBetween(point, outlinePoints[pointIndex + 1], 0.011, withOpacity(floorEdgeMaterial.clone(), 0.18));
            edge.name = `2F-floor-strong-edge-${pointIndex}`;
            building.add(edge);
          });
        }
      }

      floor.corridorPolygons.forEach((corridor, index) => {
        const isRaisedCorridor = polygonIsRaised202(corridor, floor.id);
        const routeTouchesRaised202 = routeUsesRaised202(route);
        const corridorCenter = stairCenter(corridor);
        const corridorSemanticId = `${floor.id}-corridor-${index}`;
        const corridorOnRoute = corridorPolygonIsOnRoute(corridor, floor.id, route);
        const showRaisedCorridor =
          semanticVisibleForSession(floor.id, session, { polygon: corridor, semanticId: `${floor.id}-corridor-${index}` }) ||
          (isRaisedCorridor && routeTouchesRaised202 && !(session.layerMode === "single" && session.activeFloor === "2F"));
        if (!showRaisedCorridor) return;
        if (session.layerMode === "single" && session.activeFloor === "2F" && !isRaisedCorridor && corridorSemanticId === "2F-corridor-2") return;
        if (modelFirstOverview && !corridorOnRoute && !isRaisedCorridor) {
          return;
        }
        const raisedCorridorPassive = isRaisedCorridor && session.layerMode === "single" && session.activeFloor === "2F";
        const passiveModelCorridor = modelAuthorityView && !corridorOnRoute && !route;
        const corridorLift = isRaisedCorridor ? raised202Space.height : 0;
        const corridorShouldHaveSurface =
          !raisedCorridorPassive &&
          (drawSemanticSurfaces || drawFocusedFloorSurfaces || corridorOnRoute || (isRaisedCorridor && routeTouchesRaised202 && session.layerMode !== "raised202" && corridorOnRoute));
        if (corridorShouldHaveSurface) {
          const corridorSurfaceMaterial = route && corridorOnRoute ? routeCorridorMaterial.clone() : (isRaisedCorridor ? raisedCorridorMaterial : corridorMaterial).clone();
          if (route && corridorOnRoute && isRaisedCorridor) {
            withOpacity(corridorSurfaceMaterial, session.layerMode === "raised202" ? 0.82 : 0.68);
          }
          const corridorMesh = extrudedPolygonMesh(
            corridor,
            floor.id,
            session,
            singleFocus ? 0.032 : isRaisedCorridor ? 0.02 : 0.014,
            corridorSurfaceMaterial,
            corridorLift,
            corridorSemanticId,
          );
          corridorMesh.name = corridorSemanticId;
          corridorMesh.position.y += modelAlignment.slabThickness + 0.01;
          building.add(corridorMesh);
        }

        const corridorLinePoints = [...corridor, corridor[0]].map((point) => {
          const [x, y, z] = mapPointToModel(point, floor.id, {
            ...modelOptions,
            semanticId: corridorSemanticId,
            lift: modelAlignment.slabThickness + (raisedCorridorPassive ? 0.028 : 0.045) + corridorLift,
          });
          return new THREE.Vector3(x, y, z);
        });
        corridorLinePoints.slice(0, -1).forEach((point, pointIndex) => {
          const next = corridorLinePoints[pointIndex + 1];
          const corridorOutlineMaterial =
            route && corridorOnRoute
              ? withOpacity((isRaisedCorridor ? raisedEdgeMaterial : corridorEdgeMaterial).clone(), isRaisedCorridor ? 0.18 : 0.12)
              : passiveModelCorridor
                ? withOpacity((isRaisedCorridor ? raisedEdgeMaterial : corridorEdgeMaterial).clone(), isRaisedCorridor ? 0.1 : 0.08)
                : (isRaisedCorridor ? raisedEdgeMaterial : corridorEdgeMaterial).clone();
          const outlineTube = tubeBetween(
            point,
            next,
            route && corridorOnRoute
              ? isRaisedCorridor
                ? 0.01
                : 0.007
              : passiveModelCorridor
                ? isRaisedCorridor
                  ? 0.006
                  : 0.005
                : raisedCorridorPassive
                  ? 0.008
                  : isRaisedCorridor
                    ? 0.018
                    : 0.014,
            corridorOutlineMaterial,
          );
          outlineTube.name = `${floor.id}-corridor-${index}-outline-${pointIndex}`;
          building.add(outlineTube);
        });

        if (!raisedCorridorPassive || corridorOnRoute || isRaisedCorridor) {
          const shouldShowCorridorLabel = route ? corridorOnRoute : !(modelAuthorityView && !isRaisedCorridor);
          if (shouldShowCorridorLabel) labels.push({
            roomId: corridorSemanticId,
            text: isRaisedCorridor ? "202 二层半过道" : `${floor.id === "1F" ? "一层" : "二层"}过道`,
            compactText: isRaisedCorridor ? "202 过道" : `${floor.id} 过道`,
            fullText: isRaisedCorridor ? "202 二层半过道" : `${floor.id === "1F" ? "一层" : "二层"}过道`,
            minDensity: isRaisedCorridor || corridorOnRoute ? "far" : "near",
            floor: floor.id,
            priority: isRaisedCorridor ? 78 : corridorOnRoute ? 54 : 24,
            active: false,
            start: false,
            target: false,
            variant: "corridor",
            position: new THREE.Vector3(
              ...mapPointToModel(corridorCenter, floor.id, {
                ...modelOptions,
                semanticId: corridorSemanticId,
                lift: modelAlignment.slabThickness + (singleFocus ? 0.3 : 0.2) + corridorLift,
              }),
            ),
          });
        }
      });

      if (shouldShowFloorBadge(session)) {
        const badge = floorBadgeText(floor, session);
        labels.push({
          roomId: `floor-${floor.id}`,
          text: badge.text,
          compactText: badge.compactText,
          fullText: badge.fullText,
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
    }

    for (const deck of visibleSupportDecksForSession(session)) {
      building.add(supportDeckGeometry(session, deck, supportDeckMaterial.clone(), supportDeckEdgeMaterial.clone()));
      if (session.layerMode === "single" && session.activeFloor === "2F") {
        labels.push({
          roomId: deck.id,
          text: deck.label,
          compactText:
            deck.id === "2f-west-support"
              ? "108承托"
              : deck.id === "2f-public-corridor-support"
                ? "过道承托"
                : deck.id === "2f-106-support"
                  ? "106承托"
                  : deck.id === "2f-104-support"
                    ? "104承托"
                    : deck.id === "2f-east-service-support"
                      ? "服务承托"
                      : deck.id === "2f-east-connector-support"
                        ? "东侧过道"
                        : "办公承托",
          fullText: `${deck.label}，表示二层下方仍有实体空间或楼板承托`,
          minDensity: "far",
          floor: deck.floor,
          priority: 44,
          active: false,
          start: false,
          target: false,
          variant: "note",
          position: new THREE.Vector3(
            ...mapPointToModel(stairCenter(deck.polygon), deck.floor, {
              ...modelOptions,
              semanticId: deck.semanticId,
              lift: modelAlignment.slabThickness + 0.18,
            }),
          ),
        });
      }
    }

    for (const mapSpace of jingongMapData.spaces) {
      if (mapSpace.kind === "room" || mapSpace.kind === "corridor" || mapSpace.kind === "stair") continue;
      if (!semanticVisibleForSession(mapSpace.floor, session, { polygon: mapSpace.polygon, semanticId: mapSpace.id })) continue;
      if (session.layerMode === "raised202" && !mapSpace.id.includes("202")) continue;
      if (modelFirstOverview && mapSpace.id !== session.selectedRoomId) continue;
      const raisedLift = raised202LiftForPoint(mapSpace.center, mapSpace.floor);
      const material = serviceMaterials[mapSpace.kind] ?? serviceMaterials.reserved;
      const mesh = extrudedPolygonMesh(mapSpace.polygon, mapSpace.floor, session, 0.025, material.clone(), raisedLift, mapSpace.id);
      mesh.position.y += SEMANTIC_RENDER_POLICY.serviceSurfaceLift;
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
      const compactSpaceText =
        mapSpace.kind === "restroom"
          ? "卫生间"
          : mapSpace.kind === "storage"
            ? "仓储"
            : mapSpace.kind === "reserved"
              ? "预留"
              : "服务";
      labels.push({
        roomId: mapSpace.id,
        text: mapSpace.label,
        compactText: compactSpaceText,
        fullText: mapSpace.label,
        minDensity: singleFocus && mapSpace.floor === "2F" ? "far" : "near",
        floor: mapSpace.floor,
        priority: singleFocus ? (mapSpace.labelPriority ?? 16) + 34 : mapSpace.labelPriority ?? 16,
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
    const shouldShowRaisedLowerContext =
      floorVisibility("2F", session) &&
      (session.layerMode === "allFloors" ||
        session.layerMode === "raised202" ||
        session.layerMode === "exploded" ||
        routeTouchesRaised202 ||
        (session.layerMode === "single" && session.activeFloor === "2F"));
  if (shouldShowRaisedLowerContext) {
      building.add(raisedPlatformLowerContext(session, raisedLowerContextMaterial));
      labels.push({
        roomId: "202-lower-context",
        text: "202 投影结构",
        compactText: "202 下方",
        fullText: "202 二层半下方承托与投影结构",
        minDensity: session.layerMode === "allFloors" ? "near" : "far",
        floor: "2F",
        priority: session.layerMode === "raised202" || isSingleSecondFloor(session) ? 86 : session.layerMode === "allFloors" ? 22 : 64,
        active: false,
        start: false,
        target: false,
        variant: "note",
        position: new THREE.Vector3(
          ...mapPointToModel(raised202Space.center, "2F", {
            ...modelOptions,
            semanticId: "202-lower-context",
            lift: modelAlignment.slabThickness + 0.38,
          }),
        ),
      });
      if (session.layerMode === "raised202") {
        labels.push({
          roomId: "202-raised-platform-badge",
          text: "202 二层半平台",
          compactText: "2.5F 平台",
          fullText: "202 二层半平台",
          minDensity: "far",
          floor: "2F",
          priority: 96,
          active: false,
          start: false,
          target: false,
          variant: "floor",
          position: new THREE.Vector3(
            ...mapPointToModel([930, 124], "2F", {
              ...modelOptions,
              semanticId: "202-raised-platform-badge",
              lift: modelAlignment.slabThickness + raised202Space.height + 0.36,
            }),
          ),
        });
        labels.push({
          roomId: "202-foundation-badge",
          text: "下方承托结构",
          compactText: "下方承托",
          fullText: "202 二层半下方承托结构",
          minDensity: "far",
          floor: "2F",
          priority: 72,
          active: false,
          start: false,
          target: false,
          variant: "note",
          position: new THREE.Vector3(
            ...mapPointToModel([930, 314], "2F", {
              ...modelOptions,
              semanticId: "202-lower-context",
              lift: modelAlignment.slabThickness + 0.24,
            }),
          ),
        });
      }
    }
    if (floorVisibility("2F", session) && (session.layerMode === "raised202" || session.layerMode === "exploded" || routeTouchesRaised202 || (session.layerMode === "single" && session.activeFloor === "2F"))) {
      const showSeparateRaisedPlatform = session.layerMode === "raised202" || (routeTouchesRaised202 && session.layerMode !== "exploded" && !modelFirstOverview);
      if (showSeparateRaisedPlatform && session.layerMode !== "raised202") {
        const raisedPlatform = extrudedPolygonMesh(
          raised202Space.platformPolygon,
          "2F",
          session,
          0.022,
          semanticPlaneMaterial({
            color: 0xe8f4fb,
            opacity: session.layerMode === "allFloors" ? 0.48 : 0.54,
            roughness: 0.84,
          }),
          raised202Space.height,
          "raised-202",
        );
        raisedPlatform.position.y += modelAlignment.slabThickness + 0.012;
        raisedPlatform.name = "raised-202-platform";
        building.add(raisedPlatform);
      }
      const platformContext =
        session.layerMode === "exploded" && !routeTouchesRaised202
          ? raisedPlatformOutline(session, raisedPlatformSideMaterial.clone(), 0.16)
          : raisedPlatformRim(session, raisedPlatformSideMaterial.clone());
      building.add(platformContext);
      building.add(raisedPlatformBoundaryWall(session, raisedPlatformWallMaterial));
      if (!modelFirstOverview || session.layerMode === "raised202") {
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
              lift: modelAlignment.slabThickness + raised202Space.height + 0.24,
            }),
          ),
        });
      }
    }

    for (const room of visibleRooms) {
      const active = room.id === activeRoomId;
      const target = room.id === session.targetRoomId;
      const start = room.id === startRoomId;
      const raisedLift = raised202LiftForRoom(room.id, room.floor);
      const emphasizedRoom = active || target || start;
      const routeEndpointRoom = Boolean(route && emphasizedRoom);
      const roomIsRouteContext = routeActiveRoomIds.has(room.id);
      const hideRoomLabelForRouteEndpoint = Boolean(route && (room.id === route.startRoomId || room.id === route.targetRoomId));
      const subduedSemanticFill = modelFirstOverview && !emphasizedRoom && !roomIsRouteContext;
      const singleRoomFill = singleFocus && !emphasizedRoom;
      const emphasizedOverviewRoom = modelFirstOverview && emphasizedRoom;
      const isRaised202FocusRoom = session.layerMode === "raised202" && isRaised202Room(room);
      const shouldFillRoomSurface = emphasizedRoom || roomIsRouteContext || isRaised202FocusRoom || drawFocusedFloorSurfaces || !modelAuthorityView;
      const passiveFocusedRoom = (drawFocusedFloorSurfaces || session.layerMode === "exploded") && !emphasizedRoom && !roomIsRouteContext;
      const isModelFocusMode = modelAuthorityView && singleFocus && !emphasizedRoom && !roomIsRouteContext;
      const material = new THREE.MeshStandardMaterial({
        color: active || target ? 0x0b6cff : start ? 0x19a15f : passiveFocusedRoom ? 0xf4f7fb : subduedSemanticFill ? 0xffffff : roomColor[room.area],
        roughness: subduedSemanticFill || singleRoomFill ? 0.76 : 0.62,
        metalness: 0.02,
        transparent: true,
        opacity: !shouldFillRoomSurface
          ? SEMANTIC_RENDER_POLICY.minimumPassiveRoomOpacity
          : routeEndpointRoom
            ? active || target
              ? 0.86
              : 0.82
          : emphasizedOverviewRoom
          ? 0.78
          : active || target || start
            ? 0.9
          : isRaised202FocusRoom
              ? room.area === "other"
                ? 0.78
                : 0.9
          : passiveFocusedRoom
              ? session.layerMode === "raised202"
                ? SEMANTIC_RENDER_POLICY.minimumPassiveRoomOpacity
                : session.layerMode === "exploded"
                  ? 0.22
                  : SEMANTIC_RENDER_POLICY.minimumPassiveRoomOpacity
          : isModelFocusMode
                ? SEMANTIC_RENDER_POLICY.minimumPassiveRoomOpacity
          : singleRoomFill
                ? focusedFloorMap
                  ? room.area === "other"
                    ? 0.72
                    : 0.9
                  : modelAuthorityView
                    ? SEMANTIC_RENDER_POLICY.minimumPassiveRoomOpacity
                    : 0.72
                : subduedSemanticFill
                  ? SEMANTIC_RENDER_POLICY.minimumPassiveRoomOpacity
          : session.layerMode === "exploded" && room.floor === "2F"
                    ? 0.5
                    : modelFirstOverview
                      ? SEMANTIC_RENDER_POLICY.minimumPassiveRoomOpacity
                      : session.layerMode === "allFloors"
                        ? room.area === "other"
                          ? 0.72
                          : PASSIVE_ROOM_OPACITY
                        : 0.86,
        depthWrite: shouldFillRoomSurface && !subduedSemanticFill,
      });
      const roomHeight = emphasizedRoom
        ? routeEndpointRoom
          ? 0.012
          : emphasizedOverviewRoom
          ? 0.024
          : raisedLift > 0
            ? 0.08
            : 0.06
          : singleFocus
          ? isRaised202FocusRoom
            ? 0.034
            : focusedFloorMap
              ? 0.024
              : modelAuthorityView
                ? 0.006
                : 0.03
          : session.layerMode === "exploded" && room.floor === "2F"
          ? 0.026
          : 0.018;
      const roomMesh = extrudedPolygonMesh(room.polygon, room.floor, session, shouldFillRoomSurface ? roomHeight : 0.004, material, raisedLift, room.id);
      roomMesh.position.y += SEMANTIC_RENDER_POLICY.roomSurfaceLift + (session.layerMode === "exploded" && room.floor === "2F" ? 0.001 : 0);
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
          lift: modelAlignment.slabThickness + (session.layerMode === "exploded" && room.floor === "2F" ? 0.092 : 0.088) + raisedLift,
        });
        return new THREE.Vector3(x, y, z);
      });
      const showRoomOutline =
        (!modelFirstOverview && !modelAuthorityView) ||
        emphasizedRoom ||
        roomIsRouteContext ||
        (!route && session.layerMode === "allFloors" && overviewLabelRoomIds.has(room.id));
      if (showRoomOutline) {
        const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), floorEdgeMaterial.clone());
        outline.name = `room-${room.id}-outline`;
        building.add(outline);
      }
      if (active || target || start || roomIsRouteContext || (!modelAuthorityView && raisedLift > 0 && !subduedSemanticFill)) {
        linePoints.slice(0, -1).forEach((point, index) => {
          const edgeTube = tubeBetween(point, linePoints[index + 1], active || target || start ? 0.015 : session.layerMode === "exploded" && room.floor === "2F" ? 0.012 : 0.01, (raisedLift > 0 ? raisedEdgeMaterial : corridorEdgeMaterial).clone());
          edgeTube.name = `room-${room.id}-edge-${index}`;
          building.add(edgeTube);
        });
      }

      const [x, y, z] = mapPointToModel(room.center, room.floor, {
        ...modelOptions,
        semanticId: room.id,
        lift: SEMANTIC_RENDER_POLICY.roomSurfaceLift + 0.018 + raisedLift,
      });
      if (active || target || start) {
        const hotspot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.048, 24),
          new THREE.MeshStandardMaterial({
            color: target ? 0xff3f6c : start ? 0x18a058 : 0x0b6cff,
            emissive: target ? 0x5a0012 : active ? 0x06236b : 0x063b1f,
            roughness: 0.42,
            metalness: 0.02,
          }),
        );
        hotspot.position.set(x, y, z);
        hotspot.userData.roomId = room.id;
        hotspot.castShadow = true;
        markers.add(hotspot);
        interactive.push(hotspot);
      }

      if (!hideRoomLabelForRouteEndpoint && shouldKeepRoomLabelDuringRoute(room, session, route, startRoomId) && shouldShowRoomLabel(room, session, startRoomId)) {
        const forceFullLabel = active || target || start || overviewLabelRoomIds.has(room.id);
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
      if (modelAuthorityView && session.layerMode !== "section" && session.layerMode !== "exploded") continue;
      const roomWallMatch = wall.id.match(/^wall-(.+)-\d+$/);
      const wallRoom = roomWallMatch ? getRoomById(jingongMapData, roomWallMatch[1]) : undefined;
      if (!shouldDrawWall(wall, wallRoom, session)) continue;
      if (!shouldDrawOuterShellWall(wall.id, session)) continue;
      if (session.layerMode === "raised202" && !wallRoom) continue;
      if (session.layerMode === "raised202" && wallRoom && !isRaised202Room(wallRoom)) continue;
      if (!semanticVisibleForSession(wall.floor, session, { point: stairCenter([wall.from, wall.to]), semanticId: wall.id })) continue;
      const raisedLift = raised202LiftForPoint(wall.from, wall.floor) || raised202LiftForPoint(wall.to, wall.floor);
      const explodedSecondFloorBoost = session.layerMode === "exploded" && wall.floor === "2F" ? 1.08 : 1;
        const overviewWallScale =
          session.layerMode === "allFloors"
            ? wall.kind === "outer"
              ? SEMANTIC_RENDER_POLICY.wallOverviewScale.outer
              : wall.kind === "low"
                ? SEMANTIC_RENDER_POLICY.wallOverviewScale.low
                : SEMANTIC_RENDER_POLICY.wallOverviewScale.inner
            : session.layerMode === "exploded"
              ? wall.kind === "outer"
                ? 0.7
                : wall.kind === "low"
                  ? 0.28
                  : 0.46
              : 1;
      const height = wall.kind === "outer"
        ? modelAlignment.outerWallHeight * (singleFocus ? 0.72 : overviewWallScale) * explodedSecondFloorBoost
        : modelAlignment.wallHeight * (singleFocus ? 0.56 : overviewWallScale) * explodedSecondFloorBoost;
      for (const segment of splitWallSegments(wall, jingongMapData.doors)) {
        const start = new THREE.Vector3(...mapPointToModel(segment.from, wall.floor, { ...modelOptions, semanticId: wall.id, lift: modelAlignment.slabThickness + height / 2 + raisedLift }));
        const end = new THREE.Vector3(...mapPointToModel(segment.to, wall.floor, { ...modelOptions, semanticId: wall.id, lift: modelAlignment.slabThickness + height / 2 + raisedLift }));
        const length = start.distanceTo(end);
        if (length < 0.001) continue;
        const geometry = new THREE.BoxGeometry(
          length,
          height,
          singleFocus
            ? wall.kind === "outer"
              ? 0.055
              : 0.036
            : session.layerMode === "allFloors"
              ? wall.kind === "outer"
                ? 0.045
                : wall.kind === "low"
                  ? 0.024
                  : 0.019
              : wall.kind === "outer"
                ? 0.04
                : wall.kind === "low"
                  ? 0.024
                  : 0.02,
        );
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
      if (!route && modelFirstOverview) continue;
      const start = new THREE.Vector3(
        ...mapPointToModel(fromNode.point, fromNode.floor, {
          ...modelOptions,
          semanticId: centerline.from,
          lift: modelAlignment.slabThickness + 0.062 + raised202LiftForPoint(fromNode.point, fromNode.floor),
        }),
      );
      const end = new THREE.Vector3(
        ...mapPointToModel(toNode.point, toNode.floor, {
          ...modelOptions,
          semanticId: centerline.to,
          lift: modelAlignment.slabThickness + 0.062 + raised202LiftForPoint(toNode.point, toNode.floor),
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
      const doorIsOnRoute = route?.steps.some((step) => step.fromNodeId === door.nodeId || step.toNodeId === door.nodeId) ?? false;
      const doorIsActiveCheckpoint = Boolean(activeLeg && (activeLeg.fromNodeId === door.nodeId || activeLeg.toNodeId === door.nodeId));
      if (session.layerMode === "raised202" && !doorBelongsToRaised202(door) && !doorIsOnRoute && !doorIsActiveCheckpoint) continue;
      if (modelFirstOverview && !doorIsOnRoute && !routeActiveRoomIds.has(door.connects[0]) && door.connects[0] !== activeRoomId) continue;
      const from = doorSegmentToVector(door, "from", session);
      const to = doorSegmentToVector(door, "to", session);
      const material = door.source === "inferred" ? inferredDoorMaterial.clone() : doorMaterial.clone();
      const threshold = tubeBetween(from, to, doorIsOnRoute ? 0.04 : door.source === "inferred" ? 0.018 : 0.022, material);
      threshold.name = `${door.id}-threshold`;
      building.add(threshold);
      const doorAxis = to.clone().sub(from);
      const showDoorFrame = doorIsActiveCheckpoint || (singleFocus && !route);
      const frameHeight = doorIsOnRoute || doorIsActiveCheckpoint ? SEMANTIC_RENDER_POLICY.doorFrameHeight.active : SEMANTIC_RENDER_POLICY.doorFrameHeight.passive;
      if (showDoorFrame && doorAxis.lengthSq() > 0.00001) {
        const frameMaterial = material.clone();
        const frameRadius = doorIsOnRoute ? 0.018 : 0.011;
        const leftPost = tubeBetween(from.clone(), from.clone().add(new THREE.Vector3(0, frameHeight, 0)), frameRadius, frameMaterial.clone());
        const rightPost = tubeBetween(to.clone(), to.clone().add(new THREE.Vector3(0, frameHeight, 0)), frameRadius, frameMaterial.clone());
        const lintel = tubeBetween(
          from.clone().add(new THREE.Vector3(0, frameHeight, 0)),
          to.clone().add(new THREE.Vector3(0, frameHeight, 0)),
          frameRadius,
          frameMaterial.clone(),
        );
        leftPost.name = `${door.id}-frame-left`;
        rightPost.name = `${door.id}-frame-right`;
        lintel.name = `${door.id}-frame-top`;
        building.add(leftPost);
        building.add(rightPost);
        building.add(lintel);
      }
      const center = new THREE.Vector3(...mapPointToModel(door.point, door.floor, {
        ...modelOptions,
        semanticId: door.connects[0],
        lift: modelAlignment.slabThickness + SEMANTIC_RENDER_POLICY.doorThresholdLift + raised202LiftForPoint(door.point, door.floor),
      }));
      if (doorIsActiveCheckpoint) {
        const checkpointMarker = pointMarker(center, 0.052, material.clone());
        checkpointMarker.name = `${door.id}-active-checkpoint-marker`;
        building.add(checkpointMarker);
      }
      if (doorIsActiveCheckpoint || (singleFocus && !route)) {
        labels.push({
          roomId: `door-${door.id}`,
          text: doorIsActiveCheckpoint ? "门口" : door.source === "inferred" ? "推断门" : "门",
          compactText: "门",
          fullText: door.source === "inferred" ? "推断门洞" : "门洞",
          minDensity: doorIsActiveCheckpoint ? "far" : "near",
          floor: door.floor,
          priority: doorIsActiveCheckpoint ? 82 : door.source === "inferred" ? 24 : 30,
          active: false,
          start: false,
          target: false,
          variant: "door",
          position: center.clone().add(new THREE.Vector3(0, doorIsActiveCheckpoint ? 0.16 : 0.1, 0)),
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
      const singleSecondFloorStairContext = isSingleSecondFloor(session) && stair.upperFloor === "2F";
      const lowerVisible = floorVisibility(stair.lowerFloor, session) || singleSecondFloorStairContext;
      const upperVisible = floorVisibility(stair.upperFloor, session);
      const lowerSemanticVisible =
        singleSecondFloorStairContext
          ? true
          : session.layerMode === "raised202"
          ? false
          : semanticVisibleForSession(stair.lowerFloor, session, { polygon: stair.lowerLanding, semanticId: `${stair.id}-lower` });
      const upperSemanticVisible =
        session.layerMode === "raised202" && stair.id === "stair-public"
          ? false
          : semanticVisibleForSession(stair.upperFloor, session, { polygon: stair.upperLanding, semanticId: `${stair.id}-upper` });
      if (lowerVisible && lowerSemanticVisible) {
        const lower = extrudedPolygonMesh(stair.lowerLanding, stair.lowerFloor, session, 0.075, (onRoute ? stairActiveMaterial : stairMaterial).clone(), 0, `${stair.id}-lower`);
        lower.position.y += modelAlignment.slabThickness + 0.08;
        lower.name = `${stair.id}-lower`;
        if (!modelFirstOverview || onRoute) building.add(lower);
      }
      if (upperVisible && upperSemanticVisible) {
        const upper = extrudedPolygonMesh(stair.upperLanding, stair.upperFloor, session, 0.075, (onRoute ? stairActiveMaterial : stairMaterial).clone(), 0, `${stair.id}-upper`);
        upper.position.y += modelAlignment.slabThickness + 0.08;
        upper.name = `${stair.id}-upper`;
        if (!modelFirstOverview || onRoute) building.add(upper);
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
      const stairLift = session.layerMode === "exploded" ? 0.16 : 0.1;
      const lowerVector = new THREE.Vector3(...mapPointToModel(lowerPoint, stair.lowerFloor, { ...modelOptions, semanticId: `${stair.id}-lower`, lift: stairLift }));
      const upperVector = new THREE.Vector3(...mapPointToModel(upperPoint, stair.upperFloor, { ...modelOptions, semanticId: `${stair.id}-upper`, lift: stairLift }));
        if (!shouldDrawStairBody(session, onRoute)) {
          addStairPortalPairMarker(building, lowerVector, upperVector, { active: onRoute, publicAccess: stair.access === "public" });
        } else {
          addStairPairGeometry(building, lowerVector, upperVector, { active: onRoute, publicAccess: stair.access === "public" });
        }
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
              lift: onRoute ? 0.32 : 0.24,
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
      const visibleRoutePoints = route.points.map((routePoint) => routePointVisibleForSession(routePoint, session));
      const currentLeg = activeGuidanceLeg(route, routeProgress);
      const activeFromIndex = currentLeg ? routePointIndex(currentLeg.fromNodeId, route) : 0;
      const activeToIndex = currentLeg ? routePointIndex(currentLeg.toNodeId, route) : Math.min(1, route.points.length - 1);
      const passedNodeCount = Math.max(0, activeFromIndex);
      const isOrthographicMap = cameraMode === "orthographic";
      const routeLabels: LabelAnchor[] = [];
      const routeMaterial = new THREE.MeshStandardMaterial({
        color: 0x0b6cff,
        emissive: 0x063a9f,
        emissiveIntensity: 0.34,
        roughness: 0.35,
        metalness: 0.02,
      });
      const stairRouteMaterial = new THREE.MeshStandardMaterial({
        color: 0xffa100,
        emissive: 0xd96a00,
        emissiveIntensity: 0.52,
        roughness: 0.28,
        metalness: 0.02,
      });
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x9dccff, transparent: true, opacity: 0.24 });
      const stairHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.32 });
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
      const outerHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.46 });
      const targetDiscMaterial = new THREE.MeshBasicMaterial({ color: 0xffd5df, transparent: true, opacity: 0.72 });
      const startDiscMaterial = new THREE.MeshBasicMaterial({ color: 0xc8f7df, transparent: true, opacity: 0.74 });
      points.slice(0, -1).forEach((point, index) => {
        if (!visibleRoutePoints[index] || !visibleRoutePoints[index + 1]) return;
        const nextPoint = points[index + 1];
        const step = route.steps[index];
        const isActiveSegment = currentLeg ? step?.fromNodeId === currentLeg.fromNodeId && step?.toNodeId === currentLeg.toNodeId : index === 0;
        const isPassedSegment = index < passedNodeCount;
        const isStair = step?.kind === "stair" || step?.kind === "internal-stair";
        const isDoor = step?.kind === "door";
        const isRoomEntry = step?.kind === "room-entry";
        const segmentMaterialBase = isStair ? stairRouteMaterial : isDoor ? doorRouteMaterial : isRoomEntry ? entryRouteMaterial : routeMaterial;
        const segmentHaloBase = isStair ? stairHaloMaterial : haloMaterial;
        const segmentMaterial = withOpacity(segmentMaterialBase.clone(), isActiveSegment ? 1 : isPassedSegment ? 0.34 : isOrthographicMap ? 0.54 : 0.76);
        const segmentHalo = withOpacity(segmentHaloBase.clone(), isActiveSegment ? (isStair ? 0.4 : 0.34) : isPassedSegment ? 0.08 : isOrthographicMap ? 0.16 : 0.2);
        const activeScale = isOrthographicMap ? 0.86 : session.layerMode === "allFloors" ? 1.02 : 0.94;
        const inactiveRadius = isPassedSegment ? 0.018 : 0.03;
        const outerHalo = tubeBetween(point, nextPoint, isActiveSegment ? (isStair ? 0.14 : isDoor ? 0.11 : isRoomEntry ? 0.084 : 0.1) * activeScale : isPassedSegment ? 0.028 : 0.044, withOpacity(outerHaloMaterial.clone(), isActiveSegment ? 0.5 : isPassedSegment ? 0.08 : 0.16));
        const halo = tubeBetween(point, nextPoint, isActiveSegment ? (isStair ? 0.096 : isDoor ? 0.078 : isRoomEntry ? 0.058 : 0.068) * activeScale : isPassedSegment ? 0.024 : 0.038, segmentHalo);
        const tube = tubeBetween(point, nextPoint, isActiveSegment ? (isStair ? 0.066 : isDoor ? 0.052 : isRoomEntry ? 0.04 : 0.048) * activeScale : inactiveRadius, segmentMaterial);
        outerHalo.name = isStair ? "route-stair-outer-halo" : isDoor ? "route-door-outer-halo" : "route-walk-outer-halo";
        halo.name = isStair ? "route-stair-halo" : isDoor ? "route-door-halo" : "route-walk-halo";
        tube.name = isStair ? "route-stair-tube" : isDoor ? "route-door-tube" : isRoomEntry ? "route-entry-tube" : "route-walk-tube";
        root.add(outerHalo);
        root.add(halo);
        root.add(tube);
        if (isActiveSegment) addDirectionalArrows(root, point, nextPoint, segmentMaterialBase.clone(), isStair ? 1.7 : isDoor ? 1.34 : 1.22);
        if (isStair) {
          if (isActiveSegment) addRouteStairGuide(root, point, nextPoint, stairRouteMaterial);
        }
      });
        const target = getRoomById(jingongMapData, route.targetRoomId);
        const visibleRouteNodeToVector = (nodeId: string) => {
          const index = routePointIndex(nodeId, route);
          return index >= 0 && visibleRoutePoints[index] ? points[index] : undefined;
        };
        const currentVector = currentLeg ? visibleRouteNodeToVector(currentLeg.fromNodeId) : visibleRoutePoints[0] ? points[0] : undefined;
        const nextVector = currentLeg
          ? visibleRouteNodeToVector(currentLeg.toNodeId)
          : visibleRoutePoints[Math.min(1, points.length - 1)]
            ? points[Math.min(1, points.length - 1)]
            : undefined;
      if (currentLeg && currentVector && nextVector) {
        const nextColor = currentLeg.checkpointKind === "stair" ? 0xff9f1a : currentLeg.checkpointKind === "door" ? 0x10b7c9 : currentLeg.checkpointKind === "destination" ? 0xff3f6c : 0x0b6cff;
        const nextMarker = new THREE.Mesh(
          isOrthographicMap ? new THREE.CylinderGeometry(0.21, 0.21, 0.12, 34) : new THREE.ConeGeometry(0.18, 0.46, 32),
          new THREE.MeshStandardMaterial({
            color: nextColor,
            emissive: nextColor,
            emissiveIntensity: 0.42,
            roughness: 0.34,
          }),
        );
        nextMarker.position.copy(nextVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.06 : SEMANTIC_RENDER_POLICY.routeKeyPinLift.marker, 0)));
        root.add(nextMarker);
        root.add(makeDisc(nextVector.clone(), 0.34, new THREE.MeshBasicMaterial({ color: nextColor, transparent: true, opacity: 0.28 })));
        root.add(makeBeaconRing(nextVector.clone(), 0.37, nextColor, 0.76));
        root.add(makeBeaconRing(nextVector.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.ring, 0)), 0.52, nextColor, 0.28));
        const nextBeacon = tubeBetween(
          nextVector.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.disc, 0)),
          nextVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.22 : 0.26, 0)),
          0.016,
          new THREE.MeshBasicMaterial({
            color: nextColor,
            transparent: true,
            opacity: 0.68,
          }),
        );
        nextBeacon.name = "route-next-checkpoint-beacon";
        root.add(nextBeacon);
        const checkpointBase = new THREE.Mesh(
          new THREE.TorusGeometry(0.27, 0.024, 12, 58),
          new THREE.MeshBasicMaterial({ color: nextColor, transparent: true, opacity: 0.78 }),
        );
        checkpointBase.position.copy(nextVector.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.ring, 0)));
        checkpointBase.rotation.x = Math.PI / 2;
        checkpointBase.name = "route-next-checkpoint-ground-ring";
        root.add(checkpointBase);
        routeLabels.push({
          roomId: "route-next-portal",
          text: currentLeg.checkpointKind === "destination" ? "到达终点" : currentLeg.checkpointKind === "stair" ? "下一处楼梯" : currentLeg.checkpointKind === "door" ? "下一处门" : "下一转折点",
          compactText: currentLeg.checkpointKind === "destination" ? "终点" : currentLeg.checkpointKind === "stair" ? "楼梯" : currentLeg.checkpointKind === "door" ? "门口" : "转折",
          fullText: currentLeg.checkpointKind === "destination" ? `终点 ${currentLeg.checkpointLabel}` : `下一处 ${currentLeg.checkpointLabel}`,
          minDensity: "far",
          floor: currentLeg.floor,
          priority: 120,
          active: true,
          start: false,
          target: false,
          variant: "route",
          position: nextVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.24 : SEMANTIC_RENDER_POLICY.routeKeyPinLift.label, 0)),
        });
      }
      if (currentVector) {
        root.add(makeDisc(currentVector.clone(), 0.3, startDiscMaterial));
        root.add(makeDisc(currentVector.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.disc, 0)), 0.38, outerHaloMaterial.clone()));
        root.add(makeBeaconRing(currentVector.clone(), 0.36, 0x18a058, 0.74));
        root.add(makeBeaconRing(currentVector.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.ring, 0)), 0.5, 0x18a058, 0.28));
        const currentPin = new THREE.Mesh(
          isOrthographicMap ? new THREE.CylinderGeometry(0.18, 0.18, 0.1, 34) : new THREE.CylinderGeometry(0.095, 0.095, 0.28, 28),
          new THREE.MeshStandardMaterial({
            color: 0x18a058,
            emissive: 0x063b1f,
            emissiveIntensity: 0.42,
            roughness: 0.4,
          }),
        );
        currentPin.position.copy(currentVector);
        currentPin.position.y += isOrthographicMap ? 0.055 : 0.075;
        root.add(currentPin);
        const pinCap = new THREE.Mesh(
          new THREE.SphereGeometry(isOrthographicMap ? 0.14 : 0.12, 24, 14),
          new THREE.MeshStandardMaterial({
            color: 0x1ac46d,
            emissive: 0x0a7238,
            emissiveIntensity: 0.32,
            roughness: 0.32,
          }),
        );
        pinCap.position.copy(currentVector);
        pinCap.position.y += isOrthographicMap ? 0.12 : 0.17;
        root.add(pinCap);
        const currentGround = new THREE.Mesh(
          new THREE.TorusGeometry(0.31, 0.028, 12, 58),
          new THREE.MeshBasicMaterial({ color: 0x18a058, transparent: true, opacity: 0.78 }),
        );
        currentGround.position.copy(currentVector.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.ring, 0)));
        currentGround.rotation.x = Math.PI / 2;
        currentGround.name = "route-current-ground-ring";
        root.add(currentGround);
        const currentBeacon = tubeBetween(
          currentVector.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.disc, 0)),
          currentVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.27 : 0.32, 0)),
          0.016,
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
          fullText: currentLeg ? `现在 ${currentLeg.fromLabel}` : "当前位置",
          minDensity: "far",
          floor: currentLeg?.floor ?? route.points[0].floor,
          priority: 116,
          active: true,
          start: true,
          target: false,
          variant: "route",
          position: currentVector.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.23 : SEMANTIC_RENDER_POLICY.routeKeyPinLift.label, 0)),
        });
      }

      [target].forEach((room, index) => {
        if (!room) return;
        if (!semanticVisibleForSession(room.floor, session, { point: room.center, polygon: room.polygon, roomId: room.id, semanticId: room.id })) return;
        const [x, y, z] = mapPointToModel(room.center, room.floor, {
          layerMode: session.layerMode,
          activeFloor: session.activeFloor,
          semanticId: room.id,
          lift: modelAlignment.slabThickness + 0.11 + raised202LiftForRoom(room.id, room.floor),
        });
        const base = new THREE.Vector3(x, y, z);
        root.add(makeDisc(base.clone(), 0.32, targetDiscMaterial));
        root.add(makeDisc(base.clone().add(new THREE.Vector3(0, 0.012, 0)), 0.42, outerHaloMaterial.clone()));
        root.add(makeBeaconRing(base.clone(), 0.42, 0xff3f6c, 0.74));
        root.add(makeBeaconRing(base.clone().add(new THREE.Vector3(0, 0.04, 0)), 0.56, 0xff3f6c, 0.28));
        const pin = new THREE.Mesh(
          isOrthographicMap
            ? new THREE.CylinderGeometry(0.2, 0.2, 0.11, 34)
            : new THREE.ConeGeometry(0.18, 0.46, 32),
          new THREE.MeshStandardMaterial({
            color: 0xff3f6c,
            emissive: 0x5f0018,
            emissiveIntensity: 0.36,
            roughness: 0.4,
          }),
        );
        pin.position.copy(base);
        pin.position.y += isOrthographicMap ? 0.055 : 0.09;
        root.add(pin);
        const targetBeaconHeight = isOrthographicMap ? 0.3 : 0.34;
        const beacon = tubeBetween(
          base.clone().add(new THREE.Vector3(0, SEMANTIC_RENDER_POLICY.routeKeyPinLift.disc, 0)),
          base.clone().add(new THREE.Vector3(0, targetBeaconHeight, 0)),
          0.017,
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
          text: `终点 · ${room.roomNo}`,
          compactText: "终点",
          fullText: `终点 ${compactRoomName(room)}`,
          minDensity: "far",
          floor: room.floor,
          priority: 118,
          active: true,
          start: false,
          target: true,
          variant: "route",
          position: base.clone().add(new THREE.Vector3(0, isOrthographicMap ? 0.26 : SEMANTIC_RENDER_POLICY.routeKeyPinLift.label, 0)),
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
      layerMode: key === "targetRoomId" && roomId ? "allFloors" : current.layerMode,
      activeFloor: key === "targetRoomId" && roomId ? undefined : current.activeFloor,
      routeId: undefined,
    }));
    if (key === "targetRoomId" && roomId) {
      setTimeout(() => applyCameraPreset("route"), 0);
    }
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

  const selectLayerAndClose = (layerMode: MapSessionState["layerMode"], activeFloor?: FloorId) => {
    setLayer(layerMode, activeFloor);
    setPanel("none");
  };

  const startNavigationToSelected = () => {
    if (!session.selectedRoomId) return;
    setSession((current) => ({
      ...current,
      targetRoomId: current.selectedRoomId,
      startRoomId: current.startRoomId,
      layerMode: "allFloors",
      activeFloor: undefined,
      routeId: `${current.startRoomId ?? jingongMapData.defaultStartRoomId}->${current.selectedRoomId}`,
    }));
    setPanel("route");
    setRoutePage("setup");
    setTimeout(() => applyCameraPreset("route"), 0);
  };

  const clearRoute = () => {
    setSession((current) => ({
      ...current,
      selectedRoomId: current.selectedRoomId === current.targetRoomId ? undefined : current.selectedRoomId,
      startRoomId: undefined,
      targetRoomId: undefined,
      routeId: undefined,
      announce: [],
    }));
    setRoutePage("setup");
  };

  const openRoomPicker = (nextPage: Extract<RoutePage, "startPicker" | "targetPicker">) => {
    setRoutePage(nextPage);
    setRoomPickerGroup("common");
    setRoomPickerPage(0);
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
    window.setTimeout(() => focusActiveLeg(), 80);
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
    if (panel === next) {
      setPanel("none");
      return;
    }
    setPanelSize(route && (next === "layers" || next === "view") ? "compact" : "expanded");
    setPanel(next);
  };

  const handlePanelPointerDown = (event: PointerEvent) => {
    panelDragStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePanelPointerUp = (event: PointerEvent) => {
    const start = panelDragStartRef.current;
    panelDragStartRef.current = null;
    if (!start || !(route && (panel === "layers" || panel === "view"))) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    setPanelSize(dx < 0 ? "expanded" : "compact");
  };

  const applyMapDirect = (request: MapDirectRequest) => {
    setSession({
      ...defaultSession("backend", request),
      layerMode: request.targetRoomId ? "allFloors" : DEFAULT_LAYER,
      activeFloor: undefined,
    });
    setRouteProgress(undefined);
    setPanel("none");
    setPanelSize("expanded");
    setRoutePage("setup");
    setTimeout(() => applyCameraPreset("route"), 0);
  };

  const roomOptions = jingongMapData.rooms;
  const routeTargetShortcuts = routeTargetShortcutIds.map((roomId) => getRoomById(jingongMapData, roomId)).filter((room): room is MapRoom => Boolean(room));
  const routeStartShortcuts = routeStartShortcutIds.map((roomId) => getRoomById(jingongMapData, roomId)).filter((room): room is MapRoom => Boolean(room));
  const pickerShortcutRooms = routePage === "startPicker" ? routeStartShortcuts : routeTargetShortcuts;
  const pickerRooms = useMemo(() => {
    if (roomPickerGroup === "common") return pickerShortcutRooms;
    if (roomPickerGroup === "raised202") return roomOptions.filter((room) => isRaised202Room(room));
    if (roomPickerGroup === "2F") return roomOptions.filter((room) => room.floor === "2F" && !isRaised202Room(room));
    return roomOptions.filter((room) => room.floor === "1F");
  }, [pickerShortcutRooms, roomOptions, roomPickerGroup]);
  const pickerPageCount = Math.max(1, Math.ceil(pickerRooms.length / roomPickerPageSize));
  const normalizedPickerPage = Math.min(roomPickerPage, pickerPageCount - 1);
  const pickerVisibleRooms = pickerRooms.slice(normalizedPickerPage * roomPickerPageSize, normalizedPickerPage * roomPickerPageSize + roomPickerPageSize);
  const pickerSelectedRoomId = routePage === "startPicker" ? startRoomId : session.targetRoomId;
  const loadLabel =
    loadState === "ready" ? "主地图" : loadState === "fallback" ? "备用地图" : loadState === "error" ? "导览图层" : "地图加载中";
  const advancedLayerActive = session.layerMode === "section";
  const headingActionLabel =
    headingState.heading === undefined
      ? headingState.permissionState === "requesting"
        ? "启用中"
        : headingState.permissionState === "denied"
          ? "朝向不可用"
        : "启用朝向"
      : headingState.calibrated
        ? "重校朝向"
        : "校准朝向";
  const headingStatusTitle =
    headingState.heading === undefined
      ? headingState.permissionState === "denied"
        ? "当前环境不可用"
        : headingState.permissionState === "requesting"
          ? "正在读取"
          : "未启用"
      : headingState.calibrated
        ? "已校准"
        : "待校准";
  const headingStatusHint =
    headingState.statusMessage ??
    (headingState.heading === undefined ? "点按钮读取手机朝向" : activeLeg ? "按当前导引段校准" : "按当前视图校准");
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
        ? "当前按楼体上下位置叠合，便于查看楼梯和门洞。"
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
    if (roomId === "route-current-location" || roomId === "route-target-location") {
      setPanel("route");
      setRoutePage("setup");
      return;
    }
    const room = getRoomById(jingongMapData, roomId);
    if (!room) return;
    setSession((current) => ({ ...current, selectedRoomId: room.id }));
    setPanel("room");
  };

  const renderRouteRoomPicker = (kind: "start" | "target") => (
    <>
      <div className="route-picker-header">
        <button className="material-secondary" onClick={() => setRoutePage("setup")}>
          <ArrowLeft size={17} />
          返回路线
        </button>
        <strong>{kind === "start" ? "选择起点" : "选择终点"}</strong>
      </div>
      <div className="route-picker-tabs" aria-label={kind === "start" ? "起点分组" : "终点分组"}>
        {roomPickerGroups.map((group) => (
          <button
            key={group.id}
            className={roomPickerGroup === group.id ? "active" : ""}
            onClick={() => {
              setRoomPickerGroup(group.id);
              setRoomPickerPage(0);
            }}
            type="button"
          >
            {group.label}
          </button>
        ))}
      </div>
      <div className="route-picker-grid" aria-label={kind === "start" ? "起点房间" : "终点房间"}>
        {pickerVisibleRooms.map((room) => (
          <button
            key={room.id}
            className={pickerSelectedRoomId === room.id ? "active" : ""}
            onClick={() => {
              updateRouteEndpoint(kind === "start" ? "startRoomId" : "targetRoomId", room.id);
              setRoutePage("setup");
            }}
            type="button"
          >
            <span>{floorDisplayLabel(room)}</span>
            <strong>{room.roomNo}</strong>
            <small>{room.name}</small>
          </button>
        ))}
      </div>
      <div className="route-picker-pager">
        <button className="material-secondary" disabled={normalizedPickerPage <= 0} onClick={() => setRoomPickerPage((page) => Math.max(0, page - 1))}>
          上一页
        </button>
        <span>
          {normalizedPickerPage + 1}/{pickerPageCount}
        </span>
        <button className="material-secondary" disabled={normalizedPickerPage >= pickerPageCount - 1} onClick={() => setRoomPickerPage((page) => Math.min(pickerPageCount - 1, page + 1))}>
          下一页
        </button>
      </div>
    </>
  );

  const dockablePanel = route && (panel === "layers" || panel === "view");
  const effectivePanelSize: PanelSize = dockablePanel ? panelSize : "expanded";

  return (
    <div className={`map3d-app panel-${panel} panel-size-${effectivePanelSize}`}>
      <section className="map3d-stage" aria-label="金工中心地图">
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
        {loadState === "loading" && (
          <div className="map3d-loading-card" aria-live="polite">
            <span>准备地图</span>
            <strong>导览图层加载中</strong>
          </div>
        )}
        {loadState === "error" && (
          <div className="map3d-loading-card error" aria-live="polite">
            <span>地图渲染不可用</span>
            <strong>{statusText}</strong>
          </div>
        )}
        {headingBearing !== undefined && headingAnchor && headingLayout?.visible && (
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
        <div
          className="map3d-north-indicator"
          style={{ "--north-angle": `${northLayout.angle}rad` } as CSSProperties}
          aria-label={`地图${northLayout.label}方向`}
        >
          <Navigation2 size={17} />
          <span>{northLayout.label}</span>
        </div>
        {panel === "none" && !route && selectedRoom && (
          <button
            className="map3d-bottom-chip"
            onClick={() => openPanel("room")}
            title="打开房间信息"
          >
            <Crosshair size={18} />
            <span>已选 {compactRoomName(selectedRoom)}</span>
            <small>点击查看房间</small>
          </button>
        )}
        {panel === "none" && route && activeLeg && activeLegVisibleInLayer && (
          <div className="map3d-guidance-strip" aria-label="当前导航引导">
            <span className="guidance-strip-step">{activeLegDisplay.progress}</span>
            <div className="guidance-strip-node">
              <span>当前</span>
              <strong>{activeLeg.fromLabel}</strong>
            </div>
            <ArrowRight size={18} />
            <div className="guidance-strip-node next">
              <span>{checkpointVerb(activeLeg.checkpointKind)}</span>
              <strong>{activeLegDisplay.checkpoint}</strong>
            </div>
            <small className="guidance-strip-distance">{activeLeg.distanceMeters}m</small>
            <div className="guidance-strip-actions">
              <button type="button" onClick={() => openPanel("layers")}>
                图层
              </button>
              <button type="button" onClick={() => openPanel("view")}>
                视角
              </button>
              <button type="button" onClick={focusActiveLeg}>
                聚焦
              </button>
              <button type="button" onClick={advanceRouteCheckpoint}>
                {activeLegDisplay.isLast ? "完成" : "到达"}
              </button>
            </div>
          </div>
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
        {mapDebugEnabled && (
          <button className={panel === "debug" ? "active" : ""} onClick={() => openPanel("debug")} title="调试">
            <Bug size={22} />
            <span>调试</span>
          </button>
        )}
      </nav>

      {panel !== "none" && effectivePanelSize === "expanded" && <button className="material-scrim" aria-label="关闭地图面板" onClick={() => setPanel("none")} />}

      {panel !== "none" && (
        <aside
          className={dockablePanel ? `material-panel map3d-panel dockable-panel ${effectivePanelSize}` : "material-panel map3d-panel"}
          aria-label="地图面板"
          onPointerDown={handlePanelPointerDown}
          onPointerUp={handlePanelPointerUp}
        >
          {dockablePanel && <span className="panel-magnet-handle" aria-hidden="true" />}
          <div className="material-panel-title">
            <strong>
              {panel === "route" && "路线导航"}
              {panel === "layers" && "图层显示"}
              {panel === "view" && "视角控制"}
              {panel === "room" && "房间信息"}
              {panel === "debug" && "地图调试"}
            </strong>
          {dockablePanel && (
              <button
                className="material-panel-size-toggle"
                onClick={() => setPanelSize((current) => (current === "compact" ? "expanded" : "compact"))}
                title={effectivePanelSize === "compact" ? "展开完整面板" : "收起为简洁面板"}
                type="button"
              >
                {effectivePanelSize === "compact" ? "展开" : "简洁"}
              </button>
            )}
            <button className="icon-button material-close" onClick={() => setPanel("none")} title="关闭">
              <X size={19} />
            </button>
          </div>

          {panel === "route" && (
            <div className="map3d-panel-page">
              {routePage === "startPicker" ? (
                renderRouteRoomPicker("start")
              ) : routePage === "targetPicker" ? (
                renderRouteRoomPicker("target")
              ) : routePage === "setup" ? (
                <>
                  {!route && (
                    <div className="route-mode-banner">
                      <Sparkles size={18} />
                      <span>选择终点后，默认从 101 出发</span>
                    </div>
                  )}
                  <div className={route ? "route-nav-sheet active" : "route-nav-sheet"}>
                    <button className="route-nav-endpoint" onClick={() => openRoomPicker("startPicker")} type="button">
                      <span>起</span>
                      <strong>{startRoom ? compactRoomName(startRoom) : "默认 101"}</strong>
                    </button>
                    <ArrowRight size={17} />
                    <button className="route-nav-endpoint target" onClick={() => openRoomPicker("targetPicker")} type="button">
                      <span>终</span>
                      <strong>{targetRoom ? compactRoomName(targetRoom) : "选择目的房间"}</strong>
                    </button>
                    <small>{route ? `${route.totalMeters}m · ${formatSeconds(route.estimatedSeconds)}` : "点起点或终点可修改"}</small>
                  </div>
                  {!route && (
                    <div className="route-target-shortcuts" aria-label="常用终点">
                      {routeTargetShortcuts.map((room) => (
                        <button
                          key={room.id}
                          className={session.targetRoomId === room.id ? "active" : ""}
                          onClick={() => updateRouteEndpoint("targetRoomId", room.id)}
                          type="button"
                        >
                          <span>{floorDisplayLabel(room)}</span>
                          <strong>{room.roomNo}</strong>
                          <small>{room.name}</small>
                        </button>
                      ))}
                    </div>
                  )}
                  {!route && (
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
                    <div className="route-guidance-card route-guidance-card-primary" aria-label="当前路线段">
                      <span className="route-guidance-progress">{activeLegDisplay.progress}</span>
                      <div className="guidance-node current">
                        <span>你现在在</span>
                        <strong>{activeLeg.fromLabel}</strong>
                      </div>
                      <ArrowRight size={18} />
                      <div className="guidance-node next">
                        <span>{checkpointVerb(activeLeg.checkpointKind)}</span>
                        <strong>{activeLegDisplay.checkpoint}</strong>
                        <small>{activeLeg.distanceMeters}m · {activeLeg.instruction}</small>
                      </div>
                    </div>
                  )}
                  {route && (
                    <div className="route-step-controls route-action-controls">
                      <button className="material-secondary" disabled={!activeLeg || activeLeg.index <= 0} onClick={() => stepRouteProgress(-1)}>
                        上一步
                      </button>
                      <button className="material-secondary" disabled={!activeLeg} onClick={focusActiveLeg}>
                        <LocateFixed size={17} />
                        聚焦
                      </button>
                      <button className="material-primary" disabled={!activeLeg} onClick={advanceRouteCheckpoint}>
                        {activeLegDisplay.isLast ? "完成" : "到达"}
                      </button>
                    </div>
                  )}
                  {route && (
                    <div className="route-secondary-row">
                      <button className="material-secondary" onClick={() => setRoutePage("details")}>步骤</button>
                      <button className="material-secondary" disabled={headingState.permissionState === "requesting"} onClick={headingState.heading === undefined ? headingState.requestPermission : calibrateHeading}>
                        <Navigation2 size={17} />
                        {headingActionLabel}
                      </button>
                      <button className="material-secondary" onClick={clearRoute}>
                        <Trash2 size={17} />
                        清除
                      </button>
                    </div>
                  )}
                  {!route && (
                    <div className="material-action-row">
                      <button className="material-primary" disabled={!session.targetRoomId} onClick={() => setRoutePage("details")}>
                        <Navigation size={18} />
                        开始导航
                      </button>
                      <button className="material-secondary" onClick={clearRoute}>
                        <Trash2 size={18} />
                        清除路线
                      </button>
                    </div>
                  )}
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
                <button className={session.layerMode === "allFloors" ? "material-tile active primary-layer" : "material-tile primary-layer"} onClick={() => selectLayerAndClose("allFloors")}>
                  <Box size={20} />
                  <strong>全楼总览</strong>
                  <span>默认打开，保留上下对应</span>
                </button>
                <button className={session.layerMode === "exploded" ? "material-tile active" : "material-tile"} onClick={() => selectLayerAndClose("exploded")}>
                  <Box size={20} />
                  <strong>分层总览</strong>
                  <span>上下层拉开，辨认楼梯连接</span>
                </button>
                <button className={session.layerMode === "single" && session.activeFloor === "1F" ? "material-tile single-floor active" : "material-tile single-floor"} onClick={() => selectLayerAndClose("single", "1F")}>
                  <Layers size={20} />
                  <strong>一层</strong>
                  <span>只看一层门、走廊和房间边界</span>
                </button>
                <button className={session.layerMode === "single" && session.activeFloor === "2F" ? "material-tile single-floor active" : "material-tile single-floor"} onClick={() => selectLayerAndClose("single", "2F")}>
                  <Layers size={20} />
                  <strong>二层</strong>
                  <span>普通二层，包含 202 下方承托</span>
                </button>
                <button className={session.layerMode === "raised202" ? "material-tile active raised" : "material-tile raised"} onClick={() => selectLayerAndClose("raised202")}>
                  <Layers size={20} />
                  <strong>202 平台</strong>
                  <span>高平台、下方空间一起看</span>
                </button>
              </div>
              <div className="layer-advanced-row" aria-label="高级图层">
                <button className={session.layerMode === "section" ? "material-mini-chip active" : "material-mini-chip"} onClick={() => selectLayerAndClose("section")}>
                  剖切
                </button>
                <span>{advancedLayerActive ? "辅助查看" : "默认总览"}</span>
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
                  <strong>{headingStatusTitle}</strong>
                  <small>{headingStatusHint}</small>
                </div>
                <button className="material-primary" disabled={headingState.permissionState === "requesting"} onClick={headingState.heading === undefined ? headingState.requestPermission : calibrateHeading}>
                  <Navigation2 size={18} />
                  {headingState.heading === undefined ? "启用" : "校准"}
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
                  模拟导航到 104 二层
                </button>
                <button onClick={() => applyMapDirect({ targetRoomId: "108-2F04", announce: ["summary", "distance", "floorChange"] })}>
                  模拟导航到 108 钳工
                </button>
                <button onClick={() => applyMapDirect({ startRoomId: "108-lobby", targetRoomId: "202-5", announce: ["summary", "distance", "direction"] })}>
                  模拟从 108 到 202-5
                </button>
                {onOpenLegacy && <button onClick={onOpenLegacy}>打开旧版演示地图</button>}
              </div>
              <p className="debug-panel-note">调试面板只暴露地图启动和内部检查状态。语音、意图识别和真实后端仍由外部服务接入。</p>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
