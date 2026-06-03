import type {
  FloorId,
  GuidanceLeg,
  MapData,
  MapRoom,
  NavEdge,
  NavNode,
  Point,
  RouteResult,
  RouteStep,
} from "./types";

export type DisplayFloorId = FloorId | "25F";

export const floorOrder: DisplayFloorId[] = ["1F", "2F", "25F"];

export const floorTitles: Record<DisplayFloorId, string> = {
  "1F": "一层",
  "2F": "二层",
  "25F": "202 二层半",
};

export const layerHints: Record<string, string> = {
  allFloors: "整楼导航",
  "1F": "一层 · 房间、门口和走廊",
  "2F": "二层 · 普通二层与 202 下方承托",
  raised202: "202 平台 · 高平台和下方承托",
  exploded: "分层总览 · 上下层拉开",
  section: "剖切路线 · 保留跨层关系",
};

export const quickTargets = [
  { id: "104-2F01", no: "104", label: "104 二层", meta: "内部楼梯" },
  { id: "202-5", no: "202-5", label: "202 平台", meta: "公共楼梯" },
  { id: "108-2F04", no: "108", label: "108 二层", meta: "内部楼梯" },
  { id: "208", no: "208", label: "208", meta: "二层走廊" },
];

export const layerOptions = [
  { id: "allFloors", label: "全楼", desc: "整楼导航" },
  { id: "1F", label: "一层", desc: "门点走廊" },
  { id: "2F", label: "二层", desc: "含下方承托" },
  { id: "raised202", label: "202平台", desc: "平台+承托" },
  { id: "exploded", label: "分层总览", desc: "上下展开" },
  { id: "section", label: "剖切路线", desc: "看跨层" },
];

export const viewOptions = [
  { id: "overview", label: "总览", desc: "整楼视角" },
  { id: "near", label: "近看", desc: "展开标签" },
  { id: "route", label: "路线", desc: "聚焦导引" },
  { id: "rotateLeft", label: "左转", desc: "逆时针视角" },
  { id: "rotateRight", label: "右转", desc: "顺时针视角" },
  { id: "reset", label: "复位", desc: "回到默认" },
];

export const overviewLabelRoomIds = new Set(["101", "104-1F01", "106", "107-core", "108-lobby", "202-5", "208", "210"]);

export const palette = {
  floor: "#f1f8ff",
  floorEdge: "#58708b",
  floorSide: "#a9bfd3",
  corridor: "#c8efff",
  corridorLine: "#308fbd",
  service: "#dff5e8",
  restroom: "#d9f3e9",
  storage: "#e7edf4",
  reserved: "#edf1f6",
  teaching: "#dbeafe",
  processing: "#ffdca8",
  lab: "#fff0bd",
  office: "#d8c4ff",
  other: "#eef2f6",
  wall: "#2f445a",
  door: "#ffffff",
  inferredDoor: "#9aaabc",
  route: "#0b6cff",
  stairRoute: "#ff9700",
  start: "#16a060",
  target: "#ff3f6c",
  stair: "#ffc25b",
  stairEdge: "#b66b00",
  text: "#17253a",
};

export const defaultStartRoomId = "101";

function getRoom(data: MapData, roomId?: string): MapRoom | undefined {
  return data.rooms.find((room) => room.id === roomId);
}

export function getRoomById(data: MapData, roomId?: string): MapRoom | undefined {
  return getRoom(data, roomId);
}

export function displayFloorForRoom(room: MapRoom): "1F" | "2F" | "25F" {
  if (room.id === "202-5") return "25F";
  return room.floor;
}

export function displayFloorForDoor(door: { floor: FloorId; nodeId: string }): "1F" | "2F" | "25F" {
  if (door.nodeId === "door-202-5") return "25F";
  return door.floor;
}

export function displayFloorForRoutePoint(point: { nodeId: string; floor: FloorId }): "1F" | "2F" | "25F" {
  if (point.nodeId === "center-202-5" || point.nodeId === "door-202-5") return "25F";
  return point.floor;
}

export function roomLabel(data: MapData, roomId?: string): string {
  const room = data.rooms.find((candidate) => candidate.id === roomId);
  return room ? room.roomNo : roomId || "--";
}

export function nodeTitle(data: MapData, node: Pick<NavNode, "kind" | "label"> | undefined, nodeId: string): string {
  const room = roomForNode(data, nodeId);
  if (room && node?.kind === "room-center") return `${room.roomNo} 房间内`;
  if (room && node?.kind === "door") return `${room.roomNo} 门口`;
  return node?.label || "走廊节点";
}

export function stepInstruction(edge: Pick<NavEdge, "kind" | "note">, from?: NavNode, to?: NavNode, meters = 1): string {
  if (edge.kind === "room-entry") return "从房间中心走到门口";
  if (edge.kind === "door") return from?.kind === "door" ? "出门进入走廊" : "通过门点进入空间";
  if (edge.kind === "internal-stair") return "经房间内部楼梯上下楼";
  if (edge.kind === "stair") return "经公共楼梯上下楼";
  return `沿走廊前进约 ${Math.max(1, meters)} 米`;
}

function roomForNode(data: MapData, nodeId: string): MapRoom | undefined {
  const center = nodeId.match(/^center-(.+)$/);
  if (center) return data.rooms.find((room) => room.id === center[1]);
  return data.rooms.find((room) => room.doorNodeId === nodeId);
}

function nodeDistance(a: [number, number], b: [number, number], scale: number): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy) * scale;
}

export function buildGraph(data: MapData) {
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Array<{ to: string; edge: NavEdge; weight: number }>>();
  for (const edge of data.edges) {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (!fromNode || !toNode) continue;
    const weight = edge.distance ?? nodeDistance(fromNode.point, toNode.point, data.scaleMetersPerUnit);
    const add = (from: string, to: string) => {
      const next = adjacency.get(from) ?? [];
      next.push({ to, edge, weight });
      adjacency.set(from, next);
    };
    add(edge.from, edge.to);
    add(edge.to, edge.from);
  }
  return { nodes, adjacency };
}

function nodeLabel(node?: NavNode): string {
  if (!node) return "下一节点";
  if (node.kind === "room-center") return node.label ? `${node.label}内` : "房间内";
  if (node.kind === "door") return node.label ? `${node.label}门口` : "门口";
  if (node.kind === "stair") return node.label ? `${node.label}楼梯口` : "楼梯口";
  if (node.kind === "corridor") return node.label ?? "走廊转折点";
  if (node.kind === "space-center") {
    const label = node.label ?? "";
    if (label.includes("走廊") || label.includes("过道") || label.includes("通行")) return label.includes("二层") ? "二层走廊" : "走廊";
    if (label.includes("楼梯")) return "楼梯口";
    return label ? `${label}附近` : "公共空间";
  }
  return node.label ?? "走廊节点";
}

function routeNodeLabel(data: MapData, nodeId: string, node?: NavNode): string {
  const room = roomForNode(data, nodeId);
  if (room && node?.kind === "room-center") return `${room.roomNo} 房间内`;
  if (room && node?.kind === "door") return `${room.roomNo} 门口`;
  if (node?.kind === "corridor") return node.label ?? "走廊转折点";
  return nodeLabel(node);
}

function roomDoorLabel(data: MapData, nodeId: string): string | undefined {
  const room = roomForNode(data, nodeId);
  return room ? `${room.roomNo} 门口` : undefined;
}

function checkpointKind(step: RouteStep, toNode?: NavNode): GuidanceLeg["checkpointKind"] {
  if (step.kind === "stair" || step.kind === "internal-stair" || toNode?.kind === "stair") return "stair";
  if (toNode?.kind === "door" || step.kind === "door") return "door";
  if (toNode?.kind === "room-center") return "destination";
  if (toNode?.kind === "space-center") return "turn";
  if (step.kind === "corridor") return "corridor";
  return "room";
}

function checkpointLabel(data: MapData, step: RouteStep, fromNode?: NavNode, toNode?: NavNode): string {
  if (step.kind === "room-entry" && toNode?.kind === "door") return roomDoorLabel(data, step.toNodeId) ?? nodeLabel(toNode);
  if (step.kind === "door" && fromNode?.kind === "door" && toNode?.kind === "space-center") return `${roomDoorLabel(data, step.fromNodeId) ?? "房间门口"}外走廊`;
  if (step.kind === "door" && toNode?.kind !== "door") return "走廊入口";
  const label = nodeLabel(toNode);
  const kind = checkpointKind(step, toNode);
  if (kind === "stair") return label.includes("楼梯") ? label : `${label}楼梯口`;
  if (kind === "door") return label.includes("门") ? label : `${label}门口`;
  if (kind === "destination") return label.replace(/内$/, "") || "终点";
  if (kind === "turn" || kind === "corridor") return label.includes("走廊") ? "走廊转折点" : label;
  return label;
}

function actionLabel(kind: GuidanceLeg["checkpointKind"]): string {
  if (kind === "stair") return "到达楼梯口";
  if (kind === "door") return "到达门口";
  if (kind === "destination") return "到达终点";
  if (kind === "turn" || kind === "corridor") return "到达转折点";
  return "到达此处";
}

function sanitizeStepNote(note: string): string {
  return note
    .replace(/从\s*([A-Za-z0-9-]+)\s*门进入公共通行线/g, "从 $1 门口进入走廊")
    .replace(/从\s*([A-Za-z0-9-]+)\s*中心移动到门口/g, "从房间内走到 $1 门口")
    .replace(/公共通行线/g, "走廊");
}

function portalNodeIdsForStep(step: RouteStep, fromNode?: NavNode, toNode?: NavNode): string[] {
  const ids: string[] = [];
  if (fromNode?.kind === "door" || fromNode?.kind === "stair" || step.kind === "room-entry") ids.push(step.fromNodeId);
  if (toNode?.kind === "door" || toNode?.kind === "stair" || step.kind === "door" || step.kind.includes("stair")) ids.push(step.toNodeId);
  return [...new Set(ids)];
}

function buildGuidanceLegs(data: MapData, steps: RouteStep[], nodes: Map<string, NavNode>): GuidanceLeg[] {
  return steps.map((step, index) => {
    const fromNode = nodes.get(step.fromNodeId);
    const toNode = nodes.get(step.toNodeId);
    const kind = checkpointKind(step, toNode);
    return {
      ...step,
      id: `${step.fromNodeId}->${step.toNodeId}`,
      index,
      fromLabel: routeNodeLabel(data, step.fromNodeId, fromNode),
      toLabel: routeNodeLabel(data, step.toNodeId, toNode),
      checkpointLabel: checkpointLabel(data, step, fromNode, toNode),
      checkpointKind: kind,
      actionLabel: actionLabel(kind),
      instruction: stepInstruction(step, fromNode, toNode),
      portalNodeIds: portalNodeIdsForStep(step, fromNode, toNode),
    };
  });
}

export function compactRouteSteps(steps: RouteStep[]): string[] {
  const lines: string[] = [];
  let walkMeters = 0;
  for (const step of steps) {
    if (step.kind === "corridor" || step.kind === "door" || step.kind === "room-entry") {
      if (step.note?.includes("二层半")) {
        if (walkMeters > 0) {
          lines.push(`沿走廊前进约 ${walkMeters} 米。`);
          walkMeters = 0;
        }
        lines.push(step.note);
        continue;
      }
      walkMeters += step.distanceMeters;
      continue;
    }
    if (walkMeters > 0) {
      lines.push(`沿走廊前进约 ${walkMeters} 米。`);
      walkMeters = 0;
    }
    lines.push(step.kind === "internal-stair" ? step.note ?? "经房间内部楼梯上下楼。" : step.note ?? "经公共楼梯上下楼。");
  }
  if (walkMeters > 0) lines.push(`继续前进约 ${walkMeters} 米到达目标附近。`);
  return lines;
}

export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes <= 0) return `${remain}秒`;
  if (remain === 0) return `${minutes}分钟`;
  return `${minutes}分${remain}秒`;
}

export function calculateRoute(data: MapData, startRoomId: string, targetRoomId: string): RouteResult | undefined {
  if (startRoomId === targetRoomId) return undefined;
  const startRoom = getRoom(data, startRoomId);
  const targetRoom = getRoom(data, targetRoomId);
  if (!startRoom || !targetRoom) return undefined;

  const { nodes, adjacency } = buildGraph(data);
  const startNodeId = `center-${startRoom.id}`;
  const targetNodeId = `center-${targetRoom.id}`;
  if (!nodes.has(startNodeId) || !nodes.has(targetNodeId)) return undefined;

  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: NavEdge; weight: number }>();
  const unvisited = new Set(nodes.keys());

  for (const nodeId of nodes.keys()) distances.set(nodeId, Number.POSITIVE_INFINITY);
  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let current: string | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < best) {
        best = distance;
        current = nodeId;
      }
    }
    if (!current || current === targetNodeId) break;
    unvisited.delete(current);

    for (const next of adjacency.get(current) ?? []) {
      if (!unvisited.has(next.to)) continue;
      const alt = best + next.weight;
      if (alt < (distances.get(next.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next.to, alt);
        previous.set(next.to, { nodeId: current, edge: next.edge, weight: next.weight });
      }
    }
  }

  if (!previous.has(targetNodeId)) return undefined;

  const pathNodeIds = [targetNodeId];
  let cursor = targetNodeId;
  const pathEdges: Array<{ from: string; to: string; edge: NavEdge; weight: number }> = [];
  while (cursor !== startNodeId) {
    const prior = previous.get(cursor);
    if (!prior) return undefined;
    pathEdges.unshift({ from: prior.nodeId, to: cursor, edge: prior.edge, weight: prior.weight });
    cursor = prior.nodeId;
    pathNodeIds.unshift(cursor);
  }

  const steps: RouteStep[] = pathEdges.map((pathEdge) => {
    const fromNode = nodes.get(pathEdge.from)!;
    const toNode = nodes.get(pathEdge.to)!;
    return {
      fromNodeId: pathEdge.from,
      toNodeId: pathEdge.to,
      floor: fromNode.floor,
      distanceMeters: Math.round(pathEdge.weight),
      kind: pathEdge.edge.kind,
      note: pathEdge.edge.note ?? (fromNode.floor !== toNode.floor ? `${fromNode.floor} 到 ${toNode.floor}` : undefined),
    };
  });

  const totalMeters = Math.round(distances.get(targetNodeId) ?? 0);
  const estimatedSeconds = Math.max(20, Math.round(totalMeters / 0.8 + steps.filter((step) => step.kind.includes("stair")).length * 18));
  const points = pathNodeIds
    .map((nodeId, index) => {
      const navNode = nodes.get(nodeId);
      if (!navNode) return undefined;
      const leadingStep = steps.find((step) => step.toNodeId === nodeId);
      return {
        nodeId,
        floor: navNode.floor,
        point: navNode.point,
        kind: index === 0 ? navNode.kind : leadingStep?.kind ?? navNode.kind,
      };
    })
    .filter(Boolean) as RouteResult["points"];

  const floorChanges = steps.filter((step) => step.kind === "stair" || step.kind === "internal-stair");
  const guidanceLegs = buildGuidanceLegs(data, steps, nodes);
  const notableSteps = compactRouteSteps(steps);

  return {
    id: `${startRoomId}->${targetRoomId}`,
    startRoomId,
    targetRoomId,
    totalMeters,
    estimatedSeconds,
    steps,
    guidanceLegs,
    points,
    nodeIds: pathNodeIds,
    summary: `${startRoom.roomNo} → ${targetRoom.roomNo}`,
    distance: `${totalMeters}m`,
    announceLines: [
      `从 ${startRoom.roomNo} ${startRoom.name} 前往 ${targetRoom.roomNo} ${targetRoom.name}`,
      `全程约 ${totalMeters} 米，预计 ${formatSeconds(estimatedSeconds)}。`,
      ...notableSteps,
      ...floorChanges.filter((step) => step.kind === "internal-stair").map((step) => step.note ?? "需要经过内部楼梯跨楼层。"),
    ],
  } as RouteResult;
}

export function cloneTransform(transform: any) {
  return {
    panX: transform.panX,
    panY: transform.panY,
    zoom: transform.zoom,
    rotation: transform.rotation || 0,
    imagePanX: transform.imagePanX || 0,
    imagePanY: transform.imagePanY || 0,
    imageZoom: transform.imageZoom || 1,
    imageRotation: transform.imageRotation || 0,
  };
}

export function normalizeTransform(transform: any) {
  return {
    panX: Number(transform?.panX || 0),
    panY: Number(transform?.panY || 0),
    zoom: Number(transform?.zoom || 1),
    rotation: Number(transform?.rotation || 0),
    imagePanX: Number(transform?.imagePanX || 0),
    imagePanY: Number(transform?.imagePanY || 0),
    imageZoom: Number(transform?.imageZoom || 1),
    imageRotation: Number(transform?.imageRotation || 0),
  };
}

export function imageTransformStyle(transform: any) {
  const panX = Number(transform?.panX || 0);
  const panY = Number(transform?.panY || 0);
  const zoom = Math.min(2.4, Math.max(0.72, Number(transform?.zoom || 1)));
  const rotation = Math.min(0.26, Math.max(-0.26, Number(transform?.rotation || 0)));
  const deg = (rotation * 180) / Math.PI;
  return `transform: translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(3)}) rotate(${deg.toFixed(2)}deg);`;
}

export function userImageTransformStyle(transform: any) {
  const panX = Number(transform?.imagePanX || 0);
  const panY = Number(transform?.imagePanY || 0);
  const zoom = Math.min(2.4, Math.max(1, Number(transform?.imageZoom || 1)));
  const rotation = Math.min(0.18, Math.max(-0.18, Number(transform?.imageRotation || 0)));
  const deg = (rotation * 180) / Math.PI;
  return `transform: translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(3)}) rotate(${deg.toFixed(2)}deg);`;
}

export function imagePresetTransform(transform: any, viewPreset: string) {
  const next = normalizeTransform(transform);
  if (viewPreset === "near") next.imageZoom = 1.18;
  else if (viewPreset === "route") next.imageZoom = 1.08;
  else {
    next.imagePanX = 0;
    next.imagePanY = 0;
    next.imageZoom = 1;
    next.imageRotation = 0;
  }
  return next;
}

export function layerButtonClass(layerMode: string, value: string) {
  return layerMode === value ? "active" : "";
}

export function panelButtonClass(panel: string, value: string) {
  return panel === value ? "active" : "";
}

export function activeLayerClass(layerMode: string, id: string) {
  return layerMode === id ? "active" : "";
}

export function checkpointVerb(kind?: GuidanceLeg["checkpointKind"]): string {
  if (kind === "stair") return "到楼梯口";
  if (kind === "door") return "到门口";
  if (kind === "destination") return "到终点";
  if (kind === "room") return "进房间";
  return "到转折点";
}

export function railTapAction(tap: { x: number; y: number }, canvasWidth: number, canvasHeight: number) {
  const width = Number(canvasWidth || 390);
  const height = Number(canvasHeight || 180);
  const railLeft = width - 64;
  const railTop = height / 2 - 94;
  const railButtonTops = [4, 40, 76, 112, 148];
  const railTapActions = [
    { action: "back" as const },
    { panel: "route" as const },
    { panel: "layers" as const },
    { panel: "view" as const },
    { view: "reset" as const },
  ];
  if (!width || tap.x < railLeft) return null;
  for (let i = 0; i < railButtonTops.length; i += 1) {
    const top = railTop + railButtonTops[i] - 4;
    const bottom = top + 42;
    if (tap.y >= top && tap.y <= bottom) return railTapActions[i];
  }
  return null;
}
