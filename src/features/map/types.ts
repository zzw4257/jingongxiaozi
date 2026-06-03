import type { MapDirectRequest } from "../../shared/appTypes";

export type FloorId = "1F" | "2F";

export type AreaType = "teaching" | "processing" | "lab" | "office" | "service" | "other";
export type SpaceKind = "room" | "corridor" | "service" | "restroom" | "storage" | "reserved" | "stair" | "void";
export type GeometrySource = "model" | "cad" | "reference" | "inferred";

export type Point = [number, number];

export type RoomRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WallSegment = {
  id: string;
  floor: FloorId;
  from: Point;
  to: Point;
  thickness: number;
  kind: "outer" | "inner" | "low" | "virtual";
};

export type DoorSegment = {
  id: string;
  floor: FloorId;
  point: Point;
  from: Point;
  to: Point;
  width: number;
  normal: Point;
  connects: [string, string];
  source: GeometrySource;
  wallId?: string;
  nodeId: string;
  label?: string;
};

export type MapSpace = {
  id: string;
  label: string;
  floor: FloorId;
  kind: SpaceKind;
  polygon: Point[];
  center: Point;
  source: GeometrySource;
  navigable: boolean;
  description: string;
  labelPriority?: number;
};

export type StairGeometry = {
  id: string;
  label: string;
  access: "public" | "internal";
  ownerRoomId?: string;
  lowerFloor: FloorId;
  upperFloor: FloorId;
  lowerLanding: Point[];
  upperLanding: Point[];
  lowerNodeId: string;
  upperNodeId: string;
};

export type FloorGeometry = {
  id: FloorId;
  label: string;
  elevation: number;
  height: number;
  outline: Point[];
  corridorPolygons: Point[][];
};

export type MapRoom = {
  id: string;
  roomNo: string;
  name: string;
  floor: FloorId;
  area: AreaType;
  rect: RoomRect;
  polygon: Point[];
  center: Point;
  labelPoint: Point;
  doorNodeId: string;
  description: string;
  tags: string[];
  parentRoomId?: string;
  imagePlaceholder?: string;
};

export type NavNode = {
  id: string;
  floor: FloorId;
  point: Point;
  kind: "corridor" | "door" | "stair" | "room-center" | "space-center";
  label?: string;
};

export type NavEdge = {
  from: string;
  to: string;
  distance?: number;
  kind: "corridor" | "door" | "stair" | "internal-stair" | "room-entry";
  note?: string;
};

export type CenterlineSegment = {
  id: string;
  floor: FloorId;
  from: string;
  to: string;
  kind: "corridor" | "stair-approach" | "service";
  source: GeometrySource;
};

export type CalibrationPoint = {
  id: string;
  label: string;
  floor: FloorId;
  mapPoint: Point;
  modelPoint: [number, number, number];
  role: "outline" | "stair" | "door" | "corridor" | "platform";
  source: GeometrySource;
  tolerance: number;
};

export type ModelCalibration = {
  sourcePriority: GeometrySource[];
  controlPoints: CalibrationPoint[];
  maxError: number;
  averageError: number;
  modelScale: number;
  mapCenter: Point;
  rotationRadians: number;
  floorHeight: number;
  runtimeFit: {
    rawBBoxMin: [number, number, number];
    rawBBoxMax: [number, number, number];
    rawBBoxCenter: [number, number, number];
    rawBBoxSize: [number, number, number];
    centeredScale: number;
  };
  note: string;
};

export type MapData = {
  scaleMetersPerUnit: number;
  defaultStartRoomId: string;
  floors: FloorGeometry[];
  rooms: MapRoom[];
  spaces: MapSpace[];
  walls: WallSegment[];
  doors: DoorSegment[];
  stairs: StairGeometry[];
  centerlines: CenterlineSegment[];
  calibration: ModelCalibration;
  nodes: NavNode[];
  edges: NavEdge[];
};

export type RouteStep = {
  fromNodeId: string;
  toNodeId: string;
  floor: FloorId;
  distanceMeters: number;
  kind: NavEdge["kind"];
  note?: string;
};

export type GuidanceLeg = RouteStep & {
  id: string;
  index: number;
  fromLabel: string;
  toLabel: string;
  checkpointLabel: string;
  actionLabel: string;
  checkpointKind: "door" | "corridor" | "turn" | "stair" | "room" | "destination";
  instruction: string;
  portalNodeIds: string[];
};

export type RouteProgressState = {
  routeId: string;
  activeLegIndex: number;
  source: "manual" | "backend";
};

export type MapProgressUpdate = {
  routeId?: string;
  activeLegIndex?: number;
  currentNodeId?: string;
};

export type RouteResult = {
  id: string;
  startRoomId: string;
  targetRoomId: string;
  nodeIds: string[];
  summary: string;
  distance: string;
  totalMeters: number;
  estimatedSeconds: number;
  steps: RouteStep[];
  guidanceLegs: GuidanceLeg[];
  points: Array<{ nodeId: string; floor: FloorId; point: Point; kind: NavEdge["kind"] | NavNode["kind"] }>;
  announceLines: string[];
};

export type MapSessionState = {
  entrySource: "manual" | "backend";
  selectedRoomId?: string;
  startRoomId?: string;
  targetRoomId?: string;
  routeId?: string;
  viewMode: "2d" | "2_5d";
  layerMode: "single" | "twoFloor" | "allFloors" | "exploded" | "section" | "raised202";
  activeFloor?: FloorId;
  announce: string[];
};

export type MapDirect = (request: MapDirectRequest) => void;
