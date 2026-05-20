import type { MapDirectRequest } from "../../shared/appTypes";

export type FloorId = "1F" | "2F";

export type AreaType = "teaching" | "processing" | "lab" | "office" | "service" | "other";

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
  width: number;
  connects: [string, string];
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
  kind: "corridor" | "door" | "stair" | "room-center";
  label?: string;
};

export type NavEdge = {
  from: string;
  to: string;
  distance?: number;
  kind: "corridor" | "door" | "stair" | "internal-stair";
  note?: string;
};

export type MapData = {
  scaleMetersPerUnit: number;
  defaultStartRoomId: string;
  floors: FloorGeometry[];
  rooms: MapRoom[];
  walls: WallSegment[];
  doors: DoorSegment[];
  stairs: StairGeometry[];
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

export type RouteResult = {
  id: string;
  startRoomId: string;
  targetRoomId: string;
  totalMeters: number;
  estimatedSeconds: number;
  steps: RouteStep[];
  points: Array<{ floor: FloorId; point: Point; kind: NavEdge["kind"] }>;
  announceLines: string[];
};

export type MapSessionState = {
  entrySource: "manual" | "backend";
  selectedRoomId?: string;
  startRoomId?: string;
  targetRoomId?: string;
  routeId?: string;
  viewMode: "2d" | "2_5d";
  layerMode: "single" | "twoFloor" | "allFloors" | "exploded";
  activeFloor?: FloorId;
  announce: string[];
};

export type MapDirect = (request: MapDirectRequest) => void;
