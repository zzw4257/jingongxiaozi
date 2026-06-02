const mapDataModule = require("../../data/map-data");
const mapData = mapDataModule.default || mapDataModule;

const defaultStartRoomId = mapData.defaultStartRoomId || "101";
const floorOrder = ["1F", "2F", "25F"];
const floorTitles = {
  "1F": "一层",
  "2F": "二层",
  "25F": "202 二层半"
};
const layerHints = {
  allFloors: "整楼导航",
  "1F": "一层 · 房间、门口和走廊",
  "2F": "二层 · 普通二层与 202 下方承托",
  raised202: "202 平台 · 高平台和下方承托",
  exploded: "分层总览 · 上下层拉开",
  section: "剖切路线 · 保留跨层关系"
};
const quickTargets = [
  { id: "104-2F01", no: "104", label: "104 二层", meta: "内部楼梯" },
  { id: "202-5", no: "202-5", label: "202 平台", meta: "公共楼梯" },
  { id: "108-2F04", no: "108", label: "108 二层", meta: "内部楼梯" },
  { id: "208", no: "208", label: "208", meta: "二层走廊" }
];
const layerOptions = [
  { id: "allFloors", label: "全楼", desc: "整楼导航" },
  { id: "1F", label: "一层", desc: "门点走廊" },
  { id: "2F", label: "二层", desc: "含下方承托" },
  { id: "raised202", label: "202平台", desc: "平台+承托" },
  { id: "exploded", label: "分层总览", desc: "上下展开" },
  { id: "section", label: "剖切路线", desc: "看跨层" }
];
const viewOptions = [
  { id: "overview", label: "总览", desc: "整楼视角" },
  { id: "near", label: "近看", desc: "展开标签" },
  { id: "route", label: "路线", desc: "聚焦导引" },
  { id: "rotateLeft", label: "左转", desc: "逆时针视角" },
  { id: "rotateRight", label: "右转", desc: "顺时针视角" },
  { id: "reset", label: "复位", desc: "回到默认" }
];
const railButtonTops = [4, 40, 76, 112, 148];
const railTapActions = [
  { action: "back" },
  { panel: "route" },
  { panel: "layers" },
  { panel: "view" },
  { view: "reset" }
];
const overviewLabelRoomIds = new Set(["101", "104-1F01", "106", "107-core", "108-lobby", "202-5", "208", "210"]);
const mapImageByLayer = {
  allFloors: "../../assets/ui/miniprogram-map-main-mobile-0603.png",
  "1F": "../../assets/ui/miniprogram-map-main-mobile-0603.png",
  "2F": "../../assets/ui/miniprogram-map-layer-2f-mobile-0603.png",
  raised202: "../../assets/ui/miniprogram-map-layer-202-mobile-0603.png",
  exploded: "../../assets/ui/miniprogram-map-layer-exploded-mobile-0603.png",
  section: "../../assets/ui/miniprogram-map-layer-exploded-mobile-0603.png"
};
const mapImageByTarget = {
  "104-2F01": "../../assets/ui/miniprogram-map-route-104-mobile-0603.png",
  "202-5": "../../assets/ui/miniprogram-map-route-202-mobile-0603.png",
  "108-2F04": "../../assets/ui/miniprogram-map-route-108-mobile-0603.png",
  "208": "../../assets/ui/miniprogram-map-route-208-mobile-0603.png"
};

const palette = {
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
  text: "#17253a"
};

let canvasRef = null;
let ctxRef = null;
let dprRef = 1;
let canvasBox = { width: 0, height: 0 };
let legacyCanvas = false;
let lastTapTargets = [];

function fallbackCanvasSize() {
  const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
  const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
  const width = Number(windowInfo.windowWidth || deviceInfo.windowWidth || 390);
  const height = Number(windowInfo.windowHeight || deviceInfo.windowHeight || 180);
  const landscape = width > height;
  return {
    width: Math.max(240, width - (landscape ? 66 : 0)),
    height: Math.max(132, height)
  };
}

function boundsForPolygon(polygon) {
  const xs = polygon.map((point) => point[0]);
  const ys = polygon.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function expandBounds(box, padRatio = 0.06) {
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const padX = Math.max(26, width * padRatio);
  const padY = Math.max(26, height * padRatio);
  return {
    minX: box.minX - padX,
    maxX: box.maxX + padX,
    minY: box.minY - padY,
    maxY: box.maxY + padY,
    width: width + padX * 2,
    height: height + padY * 2
  };
}

function raised202ContextBounds() {
  const room = mapData.rooms.find((candidate) => candidate.id === "202-5");
  const space = mapData.spaces.find((candidate) => candidate.id === "space-202-5");
  const stair = mapData.stairs.find((candidate) => candidate.id === "stair-public");
  const points = [
    ...(room ? room.polygon : []),
    ...(space ? space.polygon : []),
    ...(stair ? stair.upperLanding : []),
    ...(stair ? stair.lowerLanding : []),
    ...mapData.doors.filter((door) => door.nodeId === "door-202-5").flatMap((door) => [door.from, door.to, door.point]),
    ...mapData.nodes.filter((node) => node.id.includes("202") || node.id.includes("public")).map((node) => node.point)
  ];
  return expandBounds(boundsForPolygon(points), 0.42);
}

function pointInBounds(point, box, pad = 0) {
  return point[0] >= box.minX - pad && point[0] <= box.maxX + pad && point[1] >= box.minY - pad && point[1] <= box.maxY + pad;
}

function floorViewport(floorId, layerMode = "allFloors") {
  if (layerMode === "raised202" && floorId === "2F") return raised202ContextBounds();
  if (floorId === "25F") {
    const room = mapData.rooms.find((candidate) => candidate.id === "202-5");
    const space = mapData.spaces.find((candidate) => candidate.id === "space-202-5");
    const stair = mapData.stairs.find((candidate) => candidate.id === "stair-public");
    const points = [
      ...(room ? room.polygon : []),
      ...(space ? space.polygon : []),
      ...(stair ? stair.upperLanding : []),
      ...mapData.doors.filter((door) => door.nodeId === "door-202-5").flatMap((door) => [door.from, door.to, door.point])
    ];
    return layerMode === "raised202" ? raised202ContextBounds() : expandBounds(boundsForPolygon(points), 0.18);
  }
  const floor = mapData.floors.find((candidate) => candidate.id === floorId);
  const points = [
    ...(floor ? floor.outline : []),
    ...mapData.rooms.filter((room) => room.floor === floorId && room.id !== "202-5").flatMap((room) => room.polygon),
    ...mapData.spaces.filter((space) => space.floor === floorId && space.id !== "space-202-5").flatMap((space) => space.polygon),
    ...mapData.doors.filter((door) => door.floor === floorId && door.nodeId !== "door-202-5").flatMap((door) => [door.from, door.to]),
    ...mapData.nodes.filter((node) => node.floor === floorId).map((node) => node.point)
  ];
  return expandBounds(boundsForPolygon(points));
}

function displayFloorForRoom(room) {
  if (room.id === "202-5") return "25F";
  return room.floor;
}

function displayFloorForDoor(door) {
  if (door.nodeId === "door-202-5") return "25F";
  return door.floor;
}

function displayFloorForRoutePoint(point) {
  if (point.nodeId === "center-202-5" || point.nodeId === "door-202-5") return "25F";
  return point.floor;
}

function roomColor(room) {
  const colors = {
    teaching: palette.teaching,
    processing: palette.processing,
    lab: palette.lab,
    office: palette.office,
    service: palette.service,
    other: palette.other
  };
  return colors[room.area] || palette.other;
}

function spaceColor(space) {
  if (space.kind === "corridor") return palette.corridor;
  if (space.kind === "restroom") return palette.restroom;
  if (space.kind === "service") return palette.service;
  if (space.kind === "storage") return palette.storage;
  if (space.kind === "reserved") return palette.reserved;
  if (space.kind === "stair") return "#ffe7b7";
  return palette.other;
}

function labelForRoom(room, density, onRoute) {
  const keyRoom = overviewLabelRoomIds.has(room.id);
  if (density === "sparse") return onRoute || keyRoom ? room.roomNo : "";
  if (density === "medium") return onRoute || keyRoom ? room.roomNo : "";
  const name = room.name.length > 5 ? `${room.name.slice(0, 5)}…` : room.name;
  return `${room.roomNo}\n${name}`;
}

function nodeTitle(node, nodeId) {
  const room = roomForNode(nodeId);
  if (room && node.kind === "room-center") return `${room.roomNo} 房间内`;
  if (room && node.kind === "door") return `${room.roomNo} 门口`;
  return node.label || "走廊节点";
}

function roomForNode(nodeId) {
  const center = nodeId.match(/^center-(.+)$/);
  if (center) return mapData.rooms.find((room) => room.id === center[1]);
  return mapData.rooms.find((room) => room.doorNodeId === nodeId);
}

function stepInstruction(edge, from, to, meters) {
  if (edge.kind === "room-entry") return "从房间中心走到门口";
  if (edge.kind === "door") return from.kind === "door" ? "出门进入走廊" : "通过门点进入空间";
  if (edge.kind === "internal-stair") return "经房间内部楼梯上下楼";
  if (edge.kind === "stair") return "经公共楼梯上下楼";
  return `沿走廊前进约 ${Math.max(1, meters)} 米`;
}

function metersFromWeight(weight) {
  return Math.max(1, Math.round(Number(weight) || 0));
}

function checkpointVerb(kind) {
  if (kind === "stair") return "到达楼梯";
  if (kind === "door") return "到达门口";
  if (kind === "destination") return "到达终点";
  return "到达节点";
}

function buildGraph() {
  const nodeMap = new Map(mapData.nodes.map((node) => [node.id, node]));
  const adjacency = new Map();
  const distance = (from, to) => {
    const dx = from.point[0] - to.point[0];
    const dy = from.point[1] - to.point[1];
    return Math.hypot(dx, dy) * mapData.scaleMetersPerUnit;
  };
  for (const edge of mapData.edges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) continue;
    const weight = edge.distance || distance(from, to);
    const add = (a, b) => {
      const list = adjacency.get(a) || [];
      list.push({ to: b, edge, weight });
      adjacency.set(a, list);
    };
    add(edge.from, edge.to);
    add(edge.to, edge.from);
  }
  return { nodeMap, adjacency };
}

function calculateRoute(startRoomId, targetRoomId) {
  if (!targetRoomId || startRoomId === targetRoomId) return null;
  const startRoom = mapData.rooms.find((room) => room.id === startRoomId) || mapData.rooms.find((room) => room.id === defaultStartRoomId);
  const targetRoom = mapData.rooms.find((room) => room.id === targetRoomId);
  if (!startRoom || !targetRoom) return null;
  const { nodeMap, adjacency } = buildGraph();
  const startNodeId = `center-${startRoom.id}`;
  const targetNodeId = `center-${targetRoom.id}`;
  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set(nodeMap.keys());
  for (const nodeId of nodeMap.keys()) distances.set(nodeId, Number.POSITIVE_INFINITY);
  distances.set(startNodeId, 0);
  while (unvisited.size) {
    let current;
    let best = Number.POSITIVE_INFINITY;
    for (const nodeId of unvisited) {
      const score = distances.get(nodeId);
      if (score < best) {
        best = score;
        current = nodeId;
      }
    }
    if (!current || current === targetNodeId) break;
    unvisited.delete(current);
    for (const next of adjacency.get(current) || []) {
      if (!unvisited.has(next.to)) continue;
      const alt = best + next.weight;
      if (alt < distances.get(next.to)) {
        distances.set(next.to, alt);
        previous.set(next.to, { nodeId: current, edge: next.edge, weight: next.weight });
      }
    }
  }
  if (!previous.has(targetNodeId)) return null;
  const nodeIds = [targetNodeId];
  const edgePath = [];
  let cursor = targetNodeId;
  while (cursor !== startNodeId) {
    const prior = previous.get(cursor);
    if (!prior) return null;
    edgePath.unshift({ from: prior.nodeId, to: cursor, edge: prior.edge, weight: prior.weight });
    cursor = prior.nodeId;
    nodeIds.unshift(cursor);
  }
  const points = nodeIds.map((nodeId, index) => {
    const node = nodeMap.get(nodeId);
    const incoming = edgePath[index - 1]?.edge;
    return {
      nodeId,
      floor: node.floor,
      point: node.point,
      kind: incoming?.kind || node.kind,
      label: node.label || nodeId
    };
  });
  const totalMeters = Math.round(distances.get(targetNodeId) || 0);
  const steps = edgePath.map((edgeItem, index) => {
    const from = nodeMap.get(edgeItem.from);
    const to = nodeMap.get(edgeItem.to);
    const checkpointKind = edgeItem.edge.kind.includes("stair") || to.kind === "stair" ? "stair" : to.kind === "door" ? "door" : to.kind === "room-center" ? "destination" : "corridor";
    return {
      id: `${edgeItem.from}-${edgeItem.to}-${index}`,
      no: index + 1,
      fromTitle: nodeTitle(from, edgeItem.from),
      title: nodeTitle(to, edgeItem.to),
      desc: stepInstruction(edgeItem.edge, from, to, Math.round(edgeItem.weight)),
      kind: edgeItem.edge.kind,
      weight: metersFromWeight(edgeItem.weight),
      checkpointKind,
      className: ["step-card", checkpointKind === "stair" ? "stair" : "", edgeItem.to === targetNodeId ? "target" : ""].filter(Boolean).join(" ")
    };
  });
  return {
    id: `${startRoom.id}->${targetRoom.id}`,
    startRoomId: startRoom.id,
    targetRoomId: targetRoom.id,
    nodeIds,
    points,
    steps,
    summary: `${startRoom.roomNo} → ${targetRoom.roomNo}`,
    distance: `${totalMeters}m`,
    totalMeters
  };
}

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function layerButtonClass(layerMode, value) {
  return layerMode === value ? "active" : "";
}

function panelButtonClass(panel, value) {
  return panel === value ? "active" : "";
}

function cloneTransform(transform) {
  return {
    panX: transform.panX,
    panY: transform.panY,
    zoom: transform.zoom,
    rotation: transform.rotation || 0,
    imagePanX: transform.imagePanX || 0,
    imagePanY: transform.imagePanY || 0,
    imageZoom: transform.imageZoom || 1,
    imageRotation: transform.imageRotation || 0
  };
}

function normalizeTransform(transform) {
  const panX = Number(transform?.panX || 0);
  const panY = Number(transform?.panY || 0);
  const zoom = Number(transform?.zoom || 1);
  const rotation = Number(transform?.rotation || 0);
  return {
    panX,
    panY,
    zoom,
    rotation,
    imagePanX: Number(transform?.imagePanX || 0),
    imagePanY: Number(transform?.imagePanY || 0),
    imageZoom: Number(transform?.imageZoom || 1),
    imageRotation: Number(transform?.imageRotation || 0)
  };
}

function activeLayerClass(layerMode, id) {
  return layerMode === id ? "active" : "";
}

function roomLabel(roomId) {
  const room = mapData.rooms.find((candidate) => candidate.id === roomId);
  return room ? room.roomNo : roomId || "--";
}

function mapImageSrc(layerMode, route) {
  if (route && mapImageByTarget[route.targetRoomId]) return mapImageByTarget[route.targetRoomId];
  return mapImageByLayer[layerMode] || mapImageByLayer.allFloors;
}

function imageTransformStyle(transform) {
  const panX = Number(transform?.panX || 0);
  const panY = Number(transform?.panY || 0);
  const zoom = Math.min(2.4, Math.max(0.72, Number(transform?.zoom || 1)));
  const rotation = Math.min(0.26, Math.max(-0.26, Number(transform?.rotation || 0)));
  const deg = rotation * 180 / Math.PI;
  return `transform: translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(3)}) rotate(${deg.toFixed(2)}deg);`;
}

function userImageTransformStyle(transform) {
  const panX = Number(transform?.imagePanX || 0);
  const panY = Number(transform?.imagePanY || 0);
  const zoom = Math.min(2.4, Math.max(1, Number(transform?.imageZoom || 1)));
  const rotation = Math.min(0.18, Math.max(-0.18, Number(transform?.imageRotation || 0)));
  const deg = rotation * 180 / Math.PI;
  return `transform: translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoom.toFixed(3)}) rotate(${deg.toFixed(2)}deg);`;
}

function railTapAction(tap) {
  const width = Number(canvasBox.width || 390);
  const height = Number(canvasBox.height || 180);
  const railLeft = width - 64;
  const railTop = height / 2 - 94;
  if (!width || tap.x < railLeft) return null;
  for (let i = 0; i < railButtonTops.length; i += 1) {
    const top = railTop + railButtonTops[i] - 4;
    const bottom = top + 42;
    if (tap.y >= top && tap.y <= bottom) return railTapActions[i];
  }
  return null;
}

function imagePresetTransform(transform, viewPreset) {
  const next = normalizeTransform(transform);
  if (viewPreset === "near") {
    next.imageZoom = 1.18;
  } else if (viewPreset === "route") {
    next.imageZoom = 1.08;
  } else {
    next.imagePanX = 0;
    next.imagePanY = 0;
    next.imageZoom = 1;
    next.imageRotation = 0;
  }
  return next;
}

function shouldKeepRouteOverviewAsset(route) {
  return Boolean(route && mapImageByTarget[route.targetRoomId]);
}

function setFillStyle(ctx, value) {
  if (legacyCanvas && ctx.setFillStyle) ctx.setFillStyle(value);
  else ctx.fillStyle = value;
}

function setStrokeStyle(ctx, value) {
  if (legacyCanvas && ctx.setStrokeStyle) ctx.setStrokeStyle(value);
  else ctx.strokeStyle = value;
}

function setLineWidth(ctx, value) {
  if (legacyCanvas && ctx.setLineWidth) ctx.setLineWidth(value);
  else ctx.lineWidth = value;
}

function setLineCap(ctx, value) {
  if (legacyCanvas && ctx.setLineCap) ctx.setLineCap(value);
  else ctx.lineCap = value;
}

function setLineJoin(ctx, value) {
  if (legacyCanvas && ctx.setLineJoin) ctx.setLineJoin(value);
  else ctx.lineJoin = value;
}

function setFont(ctx, size, weight = "700") {
  if (legacyCanvas && ctx.setFontSize) {
    ctx.setFontSize(size);
  } else {
    ctx.font = `${weight} ${size}px sans-serif`;
  }
}

function setTextAlign(ctx, value) {
  if (legacyCanvas && ctx.setTextAlign) ctx.setTextAlign(value);
  else ctx.textAlign = value;
}

function setTextBaseline(ctx, value) {
  if (legacyCanvas && ctx.setTextBaseline) ctx.setTextBaseline(value);
  else ctx.textBaseline = value;
}

function setShadow(ctx, color, blur = 0, offsetX = 0, offsetY = 0) {
  if (legacyCanvas && ctx.setShadow) {
    ctx.setShadow(offsetX, offsetY, blur, color);
  } else {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = offsetX;
    ctx.shadowOffsetY = offsetY;
  }
}

function setGlobalAlpha(ctx, value) {
  if (legacyCanvas && ctx.setGlobalAlpha) ctx.setGlobalAlpha(value);
  else ctx.globalAlpha = value;
}

function setLineDashCompat(ctx, segments) {
  if (ctx.setLineDash) ctx.setLineDash(segments);
}

function measureTextWidth(ctx, text, fontSize) {
  if (ctx.measureText) {
    const metrics = ctx.measureText(text);
    if (metrics && Number.isFinite(metrics.width)) return metrics.width;
  }
  return String(text).length * fontSize * 0.62;
}

const nativeVisual = {
  stageWidth: 330,
  stageHeight: 176,
  minX: mapData.viewport?.minX ?? 70,
  minY: mapData.viewport?.minY ?? 15,
  width: mapData.viewport?.width ?? 1110,
  height: mapData.viewport?.height ?? 690,
  layerMode: "allFloors"
};

function updateNativeVisualMetrics(layerMode = "allFloors", hasRoute = false) {
  const fallback = fallbackCanvasSize();
  nativeVisual.stageWidth = Math.max(320, fallback.width - 12);
  nativeVisual.stageHeight = Math.max(176, fallback.height - 12);
  nativeVisual.layerMode = layerMode;
}

function nativeVisibleFloorIds(layerMode = "allFloors") {
  if (layerMode === "allFloors" || layerMode === "exploded" || layerMode === "section") return floorOrder;
  if (layerMode === "raised202") return ["2F", "25F"];
  return [layerMode];
}

function nativeFloorLayout(floorId, layerMode = nativeVisual.layerMode) {
  const sw = nativeVisual.stageWidth;
  const sh = nativeVisual.stageHeight;
  const compact = sh < 260 || sw < 560;
  const single = layerMode === "1F" || layerMode === "2F";
  if (single) {
    return {
      x: Math.round(sw * (compact ? 0.015 : 0.035)),
      y: Math.round(sh * (compact ? 0.025 : 0.055)),
      w: Math.round(sw * (compact ? 0.965 : 0.92)),
      h: Math.round(sh * (compact ? 0.9 : 0.82)),
      viewport: floorViewport(floorId, layerMode)
    };
  }
  if (layerMode === "raised202") {
    if (floorId === "25F") {
      return {
        x: Math.round(sw * (compact ? 0.52 : 0.45)),
        y: Math.round(sh * (compact ? 0.025 : 0.04)),
        w: Math.round(sw * (compact ? 0.42 : 0.38)),
        h: Math.round(sh * (compact ? 0.4 : 0.34)),
        viewport: floorViewport("25F", "raised202")
      };
    }
    return {
      x: Math.round(sw * (compact ? 0.035 : 0.08)),
      y: Math.round(sh * (compact ? 0.30 : 0.24)),
      w: Math.round(sw * (compact ? 0.9 : 0.78)),
      h: Math.round(sh * (compact ? 0.64 : 0.62)),
      viewport: floorViewport("2F", "raised202")
    };
  }
  if (layerMode === "exploded") {
    const layouts = compact
      ? {
          "1F": { x: 0.02, y: 0.61, w: 0.88, h: 0.34 },
          "2F": { x: 0.08, y: 0.30, w: 0.88, h: 0.34 },
          "25F": { x: 0.54, y: 0.04, w: 0.38, h: 0.28 }
        }
      : {
          "1F": { x: 0.04, y: 0.62, w: 0.84, h: 0.31 },
          "2F": { x: 0.10, y: 0.30, w: 0.84, h: 0.31 },
          "25F": { x: 0.50, y: 0.05, w: 0.38, h: 0.24 }
        };
    const cfg = layouts[floorId] || layouts["1F"];
    return {
      x: Math.round(sw * cfg.x),
      y: Math.round(sh * cfg.y),
      w: Math.round(sw * cfg.w),
      h: Math.round(sh * cfg.h),
      viewport: floorViewport(floorId, "exploded")
    };
  }
  if (layerMode === "section") {
    const layouts = compact
      ? {
          "1F": { x: 0.02, y: 0.58, w: 0.88, h: 0.36 },
          "2F": { x: 0.07, y: 0.28, w: 0.88, h: 0.36 },
          "25F": { x: 0.53, y: 0.045, w: 0.38, h: 0.28 }
        }
      : {
          "1F": { x: 0.04, y: 0.57, w: 0.84, h: 0.33 },
          "2F": { x: 0.09, y: 0.27, w: 0.84, h: 0.33 },
          "25F": { x: 0.49, y: 0.06, w: 0.38, h: 0.24 }
        };
    const cfg = layouts[floorId] || layouts["1F"];
    return {
      x: Math.round(sw * cfg.x),
      y: Math.round(sh * cfg.y),
      w: Math.round(sw * cfg.w),
      h: Math.round(sh * cfg.h),
      viewport: floorViewport(floorId, "section")
    };
  }
  const layouts = compact
    ? {
        "1F": { x: 0.02, y: 0.53, w: 0.88, h: 0.43 },
        "2F": { x: 0.08, y: 0.21, w: 0.88, h: 0.43 },
        "25F": { x: 0.54, y: 0.035, w: 0.39, h: 0.3 }
      }
    : {
        "1F": { x: 0.03, y: 0.54, w: 0.86, h: 0.36 },
        "2F": { x: 0.09, y: 0.23, w: 0.86, h: 0.36 },
        "25F": { x: 0.49, y: 0.05, w: 0.40, h: 0.26 }
      };
  const cfg = layouts[floorId] || layouts["1F"];
  return {
    x: Math.round(sw * cfg.x),
    y: Math.round(sh * cfg.y),
    w: Math.round(sw * cfg.w),
    h: Math.round(sh * cfg.h),
    viewport: floorViewport(floorId, layerMode)
  };
}

function nativeRectForPolygon(polygon, floorId, inflate = 0, layerMode = nativeVisual.layerMode) {
  const box = boundsForPolygon(polygon);
  const layout = nativeFloorLayout(floorId, layerMode);
  const viewport = layout.viewport;
  const scale = Math.min(layout.w / viewport.width, layout.h / viewport.height);
  const offsetX = (layout.w - viewport.width * scale) / 2;
  const offsetY = (layout.h - viewport.height * scale) / 2;
  const x = layout.x + offsetX + (box.minX - viewport.minX) * scale - inflate;
  const y = layout.y + offsetY + (box.minY - viewport.minY) * scale - inflate;
  const boxWidth = Math.max(1, box.maxX - box.minX);
  const boxHeight = Math.max(1, box.maxY - box.minY);
  const w = Math.max(5, boxWidth * scale + inflate * 2);
  const h = Math.max(5, boxHeight * scale + inflate * 2);
  return { x, y, w, h };
}

function nativePoint(point, floorId, layerMode = nativeVisual.layerMode) {
  const rect = nativeRectForPolygon([point, point], floorId, 0, layerMode);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function styleRect(rect) {
  return `left:${Math.round(rect.x)}px;top:${Math.round(rect.y)}px;width:${Math.round(rect.w)}px;height:${Math.round(rect.h)}px;`;
}

function styleLine(from, to, width = 5) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return `left:${Math.round(from.x)}px;top:${Math.round(from.y - width / 2)}px;width:${Math.round(length)}px;height:${Math.round(width)}px;transform:rotate(${angle.toFixed(1)}deg);`;
}

function displayFloorForSpace(space) {
  return space.id === "space-202-5" ? "25F" : space.floor;
}

function buildNativeMapVisual(route, activeStepIndex = 0, layerMode = "allFloors") {
  const visibleFloors = new Set(nativeVisibleFloorIds(layerMode));
  const routeNodeIds = new Set(route?.nodeIds || []);
  const nativeFloors = nativeVisibleFloorIds(layerMode).map((floorId) => {
    const layout = nativeFloorLayout(floorId, layerMode);
    return {
      id: `floor-${floorId}`,
      floorId,
      title: floorTitles[floorId],
      style: styleRect({ x: layout.x, y: layout.y, w: layout.w, h: layout.h })
    };
  });
  const nativeSpaces = mapData.spaces
    .filter((space) => space.kind !== "room")
    .filter((space) => visibleFloors.has(displayFloorForSpace(space)))
    .map((space) => {
      const floorId = displayFloorForSpace(space);
      return {
        id: space.id,
        kind: space.kind || "corridor",
        label: space.kind === "corridor" ? "走廊" : space.label,
        style: styleRect(nativeRectForPolygon(space.polygon, floorId, space.kind === "corridor" ? 1 : 0, layerMode))
      };
    });
  const denseLabels = layerMode === "1F" || layerMode === "2F" || layerMode === "raised202";
  const nativeRooms = mapData.rooms.filter((room) => visibleFloors.has(displayFloorForRoom(room))).map((room) => {
    const floorId = displayFloorForRoom(room);
    const onRoute = route && (route.targetRoomId === room.id || routeNodeIds.has(`center-${room.id}`) || routeNodeIds.has(room.doorNodeId));
    const keyRoom = overviewLabelRoomIds.has(room.id);
    return {
      id: room.id,
      area: room.area || "other",
      label: denseLabels || onRoute || keyRoom ? room.roomNo : "",
      activeClass: onRoute ? "native-room-on-route" : "",
      style: styleRect(nativeRectForPolygon(room.polygon, floorId, 0, layerMode))
    };
  });
  const nativeDoors = mapData.doors.filter((door) => visibleFloors.has(displayFloorForDoor(door))).map((door) => {
    const floorId = displayFloorForDoor(door);
    const active = routeNodeIds.has(door.nodeId);
    const rect = nativeRectForPolygon([door.from, door.to, door.point], floorId, 2, layerMode);
    return {
      id: door.id || door.nodeId,
      activeClass: active ? "native-door-on-route" : "",
      style: styleRect({ ...rect, w: Math.max(rect.w, 7), h: Math.max(rect.h, 5) })
    };
  });
  const nativeStairs = [];
  mapData.stairs.forEach((stair) => {
    const entries = [
      { id: `${stair.id}-lower`, floorId: stair.lowerFloor, polygon: stair.lowerLanding, nodeId: stair.lowerNodeId },
      { id: `${stair.id}-upper`, floorId: stair.upperFloor === "2F" && stair.id === "stair-public" ? "25F" : stair.upperFloor, polygon: stair.upperLanding, nodeId: stair.upperNodeId }
    ];
    entries.forEach((entry) => {
      if (!entry.polygon || entry.nodeId === "stair-202-virtual") return;
      if (!visibleFloors.has(entry.floorId)) return;
      nativeStairs.push({
        id: entry.id,
        activeClass: routeNodeIds.has(entry.nodeId) ? "native-stair-on-route" : "",
        style: styleRect(nativeRectForPolygon(entry.polygon, entry.floorId, 2, layerMode))
      });
    });
  });
  const nativeRouteSegments = [];
  const nativeRoutePins = [];
  if (route) {
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1];
      const to = route.points[index];
      const fromFloor = displayFloorForRoutePoint(from);
      const toFloor = displayFloorForRoutePoint(to);
      if (fromFloor !== toFloor) continue;
      if (!visibleFloors.has(fromFloor) || !visibleFloors.has(toFloor)) continue;
      const a = nativePoint(from.point, fromFloor, layerMode);
      const b = nativePoint(to.point, toFloor, layerMode);
      const stair = to.kind.includes("stair") || to.kind === "stair";
      const active = index - 1 === activeStepIndex;
      nativeRouteSegments.push({
        id: `route-${index}`,
        kindClass: stair ? "native-route-segment-stair" : "",
        activeClass: active ? "native-route-segment-active" : "",
        style: styleLine(a, b, active ? 7 : 5)
      });
    }
    route.points.forEach((point, index) => {
      const floorId = displayFloorForRoutePoint(point);
      if (!visibleFloors.has(floorId)) return;
      const p = nativePoint(point.point, floorId, layerMode);
      const kind = index === 0 ? "start" : index === route.points.length - 1 ? "target" : index === activeStepIndex + 1 ? "next" : "mid";
      if (kind === "mid") return;
      nativeRoutePins.push({
        id: `pin-${index}`,
        kind,
        label: kind === "start" ? "起" : kind === "target" ? "终" : "下",
        style: `left:${Math.round(p.x)}px;top:${Math.round(p.y)}px;`
      });
    });
  }
  return { nativeFloors, nativeSpaces, nativeRooms, nativeDoors, nativeStairs, nativeRouteSegments, nativeRoutePins };
}

Page({
  data: {
    layerMode: "allFloors",
    viewPreset: "overview",
    targetRoomId: "",
    startRoomId: defaultStartRoomId,
    route: null,
    hasRoute: false,
    routeSteps: [],
    visibleRouteSteps: [],
    routeStartLabel: "101",
    routeTargetLabel: "未选择",
    routeDistanceLabel: "未选择终点",
    activeStepIndex: 0,
    activeStepLabel: "1/1",
    currentStepTitle: "当前位置",
    nextStepTitle: "选择终点",
    nextStepVerb: "下一处",
    activeStepDistanceLabel: "--",
    stepActionLabel: "到达",
    canPrevStep: false,
    canNextStep: false,
    prevStepDisabledClass: "disabled",
    selectedRoom: null,
    selectedFloorLabel: "点击地图房间",
    layerHint: layerHints.allFloors,
    panel: "none",
    routeButtonClass: "",
    layersButtonClass: "",
    viewButtonClass: "",
    roomButtonClass: "",
    allLayerClass: "active",
    layer1FClass: "",
    layer2FClass: "",
    layer25FClass: "",
    raised202LayerClass: "",
    explodedLayerClass: "",
    sectionLayerClass: "",
    sensorHint: "模拟器无传感器",
    quickTargets,
    primaryQuickTargets: quickTargets.slice(0, 3),
    layerOptions,
    viewOptions,
    mapImageSrc: mapImageByLayer.allFloors,
    mapImageTransformStyle: userImageTransformStyle({ imagePanX: 0, imagePanY: 0, imageZoom: 1, imageRotation: 0 }),
    rendererReadyClass: "",
    nativeFloors: [],
    nativeSpaces: [],
    nativeRooms: [],
    nativeDoors: [],
    nativeStairs: [],
    nativeRouteSegments: [],
    nativeRoutePins: []
  },

  onLoad(options) {
    this.transform = normalizeTransform({ panX: 0, panY: 0, zoom: 1, rotation: 0 });
    this.touchState = null;
    const targetRoomId = options.targetRoomId || "";
    const startRoomId = options.startRoomId || defaultStartRoomId;
    const route = targetRoomId ? calculateRoute(startRoomId, targetRoomId) : null;
    if (route) this.transform = normalizeTransform(this.defaultTransform("allFloors", "route"));
    this.initCanvas();
    this.setRouteState({
      layerMode: "allFloors",
      layerHint: layerHints.allFloors,
      targetRoomId,
      startRoomId,
      route,
      viewPreset: route ? "route" : "overview",
      panel: "none",
      routeButtonClass: route ? "active" : "",
      allLayerClass: "active",
      layer1FClass: "",
      layer2FClass: "",
      layer25FClass: "",
      raised202LayerClass: "",
      explodedLayerClass: "",
      sectionLayerClass: "",
      layersButtonClass: "",
      roomButtonClass: ""
    });
  },

  onReady() {
    this.initCanvas();
    setTimeout(() => this.initCanvas(), 180);
  },

  onResize() {
    this.initCanvas();
  },

  initCanvas() {
    const fallback = fallbackCanvasSize();
    canvasBox = {
      width: Math.max(1, fallback.width),
      height: Math.max(1, fallback.height)
    };
    dprRef = 1;
    canvasRef = null;
    ctxRef = null;
    legacyCanvas = false;
    if (this.data.viewPreset === "overview" && this.transform.zoom === 1) {
      this.transform = normalizeTransform(this.defaultTransform(this.data.layerMode, this.data.viewPreset));
    }
    updateNativeVisualMetrics(this.data.layerMode, this.data.hasRoute);
    this.setData({
      ...buildNativeMapVisual(this.data.route, this.data.activeStepIndex || 0, this.data.layerMode),
      mapImageSrc: mapImageSrc(this.data.layerMode, this.data.route),
      mapImageTransformStyle: userImageTransformStyle(this.transform),
      rendererReadyClass: "renderer-canvas-ready"
    }, () => this.drawMap());
  },

  setRouteState(next) {
    const route = next.route || null;
    const layerMode = next.layerMode || this.data.layerMode || "allFloors";
    const steps = route ? route.steps : [];
    const requestedIndex = Number.isFinite(next.activeStepIndex) ? next.activeStepIndex : this.data.activeStepIndex || 0;
    const activeStepIndex = route ? Math.min(Math.max(0, requestedIndex), Math.max(0, steps.length - 1)) : 0;
    const currentStep = steps[activeStepIndex];
    const visibleRouteSteps = route ? steps.slice(Math.max(0, activeStepIndex - 1), Math.max(0, activeStepIndex - 1) + 3) : [];
    updateNativeVisualMetrics(layerMode, Boolean(route));
    this.setData({
      ...next,
      ...buildNativeMapVisual(route, activeStepIndex, layerMode),
      route,
      mapImageSrc: mapImageSrc(layerMode, route),
      mapImageTransformStyle: userImageTransformStyle(this.transform),
      hasRoute: Boolean(route),
      routeSteps: steps,
      visibleRouteSteps,
      activeStepIndex,
      routeDistanceLabel: route ? route.distance : "未选择终点",
      routeStartLabel: route ? roomLabel(route.startRoomId) : roomLabel(this.data.startRoomId || defaultStartRoomId),
      routeTargetLabel: route ? roomLabel(route.targetRoomId) : "未选择",
      activeStepLabel: route ? `${activeStepIndex + 1}/${Math.max(1, steps.length)}` : "1/1",
      currentStepTitle: currentStep ? currentStep.fromTitle : "当前位置",
      nextStepTitle: currentStep ? currentStep.title : "选择终点",
      nextStepVerb: currentStep ? checkpointVerb(currentStep.checkpointKind) : "下一处",
      activeStepDistanceLabel: currentStep ? `${Math.max(1, Math.round(currentStep.weight || 0))}m` : "--",
      stepActionLabel: route && activeStepIndex < steps.length - 1 ? "到达" : "完成",
      canPrevStep: Boolean(route && activeStepIndex > 0),
      canNextStep: Boolean(route && activeStepIndex < steps.length - 1),
      prevStepDisabledClass: route && activeStepIndex > 0 ? "" : "disabled",
      routeButtonClass: route ? "active" : this.data.routeButtonClass
    }, () => this.drawMap());
  },

  visibleFloorIds(layerMode = this.data.layerMode) {
    if (layerMode === "allFloors" || layerMode === "exploded" || layerMode === "section") return floorOrder;
    if (layerMode === "raised202") return ["2F", "25F"];
    return [layerMode];
  },

  drawMap() {
    this.setData({ mapImageTransformStyle: userImageTransformStyle(this.transform) });
    if (!ctxRef || !canvasBox.width || !canvasBox.height) return;
    const ctx = ctxRef;
    if (ctx.setTransform) ctx.setTransform(dprRef, 0, 0, dprRef, 0, 0);
    else if (legacyCanvas && ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasBox.width, canvasBox.height);
    lastTapTargets = [];
    const ids = this.visibleFloorIds();
    ids.forEach((floorId, index) => {
      const state = this.floorDrawState(floorId, index, ids.length);
      this.drawFloor(ctx, floorId, state);
    });
    if (legacyCanvas && ctx.draw) ctx.draw();
  },

  floorDrawState(floorId, index, count, overrideLayerMode) {
    const layerMode = overrideLayerMode || this.data.layerMode;
    const viewport = floorViewport(floorId, layerMode);
    const all = layerMode === "allFloors" || layerMode === "exploded" || layerMode === "section" || layerMode === "raised202";
    const raisedFocus = layerMode === "raised202";
    const exploded = layerMode === "exploded";
    const section = layerMode === "section";
    const stageW = canvasBox.width;
    const stageH = canvasBox.height;
    const compactLandscape = stageH < 280 || stageW < 520;
    const routeActive = Boolean(this.data.route && this.data.viewPreset === "route");
    const usableW = stageW * (compactLandscape ? 0.9 : all ? (routeActive ? 0.92 : 0.96) : 0.9);
    const usableH = stageH * (compactLandscape ? (all ? 0.58 : 0.7) : all ? (routeActive ? 0.78 : 0.84) : 0.82);
    const scale = Math.min(usableW / viewport.width, usableH / viewport.height) * this.transform.zoom;
    const visualOrder = { "1F": 0, "2F": 1, "25F": 2 };
    const ordinal = visualOrder[floorId] || index;
    const floorGap = all
      ? compactLandscape
        ? Math.max(exploded ? 72 : section ? 54 : raisedFocus ? 46 : 48, stageH * (exploded ? 0.34 : 0.25))
        : Math.max(exploded ? 142 : section ? 92 : raisedFocus ? 76 : 86, stageH * (exploded ? 0.42 : section ? 0.28 : raisedFocus ? 0.23 : 0.27))
      : 0;
    const spreadX = compactLandscape ? (exploded ? 56 : raisedFocus ? 16 : section ? 28 : 34) : exploded ? 96 : raisedFocus ? 28 : section ? 58 : 74;
    const routeShift = routeActive ? { x: compactLandscape ? 10 : 28, y: 0 } : { x: compactLandscape ? 0 : 12, y: compactLandscape ? 0 : 6 };
    const baseX = stageW * (all ? (compactLandscape ? 0.42 : 0.43) : 0.5) + this.transform.panX + routeShift.x + (all ? ordinal * spreadX : 0);
    const baseY = stageH * (all ? (compactLandscape ? (section ? 0.66 : raisedFocus ? 0.64 : 0.62) : section ? 0.8 : raisedFocus ? 0.78 : 0.82) : compactLandscape ? 0.5 : 0.58) + this.transform.panY + routeShift.y - (all ? ordinal * floorGap : 0);
    const tiltY = all ? (compactLandscape ? (section ? 0.78 : raisedFocus ? 0.72 : 0.68) : section ? 0.68 : raisedFocus ? 0.62 : 0.56) : compactLandscape ? 0.88 : 0.78;
    const skewX = all ? (compactLandscape ? (section ? -0.025 : raisedFocus ? -0.035 : -0.052) : section ? -0.04 : raisedFocus ? -0.05 : -0.088) : -0.018;
    return { floorId, index, count, viewport, scale, baseX, baseY, tiltY, skewX, all, exploded, section, layerMode };
  },

  project(point, state) {
    const x = (point[0] - state.viewport.minX - state.viewport.width / 2) * state.scale;
    const y = (point[1] - state.viewport.minY - state.viewport.height / 2) * state.scale;
    const rotation = this.transform.rotation || 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const px = x + y * state.skewX;
    const py = y * state.tiltY;
    return {
      x: state.baseX + px * cos - py * sin,
      y: state.baseY + px * sin + py * cos
    };
  },

  drawProjectedPolygon(ctx, points, fill, stroke, lineWidth = 1) {
    if (!points.length) return;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    setFillStyle(ctx, fill);
    ctx.fill();
    if (stroke) {
      setStrokeStyle(ctx, stroke);
      setLineWidth(ctx, lineWidth);
      setLineJoin(ctx, "round");
      ctx.stroke();
    }
  },

  drawExtrudedPolygon(ctx, polygon, state, options = {}) {
    if (!polygon.length) return;
    const depthPx = options.depthPx || (state.all ? 28 : 22);
    const offset = [options.offsetX || 12 / state.scale, depthPx / state.scale];
    const top = polygon.map((point) => this.project(point, state));
    const bottom = polygon.map((point) => this.project([point[0] + offset[0], point[1] + offset[1]], state));
    ctx.save();
    if (options.groundShadow !== false) {
      const shadow = top.map((point) => ({ x: point.x + 12, y: point.y + depthPx + 10 }));
      this.drawProjectedPolygon(ctx, shadow, options.shadowFill || "rgba(18, 45, 78, 0.12)", null, 0);
    }
    for (let i = 0; i < top.length; i += 1) {
      const j = (i + 1) % top.length;
      const face = [top[i], top[j], bottom[j], bottom[i]];
      const avgY = (top[i].y + top[j].y) / 2;
      const visibleFace = avgY >= state.baseY - canvasBox.height * 0.42 || i % 2 === 0;
      if (!visibleFace) continue;
      this.drawProjectedPolygon(ctx, face, options.sideFill || palette.floorSide, options.sideStroke || "rgba(88,110,132,0.58)", 1);
    }
    setShadow(ctx, "rgba(20, 53, 94, 0.18)", 16, 0, 9);
    this.drawProjectedPolygon(ctx, top, options.topFill || palette.floor, options.topStroke || palette.floorEdge, options.lineWidth || 3.4);
    ctx.restore();
  },

  drawPolygon(ctx, polygon, state, fill, stroke, lineWidth = 1.5, shadow = false) {
    if (!polygon.length) return;
    ctx.save();
    if (shadow) {
      setShadow(ctx, "rgba(20, 53, 94, 0.16)", 14, 0, 10);
    }
    ctx.beginPath();
    polygon.forEach((point, index) => {
      const p = this.project(point, state);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    setFillStyle(ctx, fill);
    ctx.fill();
    if (stroke) {
      setStrokeStyle(ctx, stroke);
      setLineWidth(ctx, lineWidth);
      setLineJoin(ctx, "round");
      ctx.stroke();
    }
    ctx.restore();
  },

  drawLine(ctx, from, to, state, color, width, dashed = false) {
    const a = this.project(from, state);
    const b = this.project(to, state);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    setStrokeStyle(ctx, color);
    setLineWidth(ctx, width);
    setLineCap(ctx, "round");
    if (dashed) setLineDashCompat(ctx, [8, 7]);
    ctx.stroke();
    if (dashed) setLineDashCompat(ctx, []);
    ctx.restore();
  },

  drawWallPrism(ctx, from, to, state, options = {}) {
    const a = this.project(from, state);
    const b = this.project(to, state);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = (-dy / len) * (options.width || 2.5);
    const ny = (dx / len) * (options.width || 2.5);
    const lift = options.lift || (state.all ? 7 : 5);
    const top = [
      { x: a.x + nx, y: a.y + ny - lift },
      { x: b.x + nx, y: b.y + ny - lift },
      { x: b.x - nx, y: b.y - ny - lift },
      { x: a.x - nx, y: a.y - ny - lift }
    ];
    const side = [
      { x: a.x - nx, y: a.y - ny - lift },
      { x: b.x - nx, y: b.y - ny - lift },
      { x: b.x - nx, y: b.y - ny + lift * 0.55 },
      { x: a.x - nx, y: a.y - ny + lift * 0.55 }
    ];
    ctx.save();
    this.drawProjectedPolygon(ctx, side, options.sideFill || "rgba(98, 119, 140, 0.45)", null, 0);
    this.drawProjectedPolygon(ctx, top, options.topFill || "rgba(50, 70, 92, 0.78)", options.stroke || "rgba(36, 53, 72, 0.68)", 0.8);
    ctx.restore();
  },

  drawPointPin(ctx, point, state, label, fill, radius = 11) {
    const p = this.project(point, state);
    ctx.save();
    setShadow(ctx, "rgba(20, 53, 94, 0.24)", 18, 0, 0);
    setFillStyle(ctx, fill);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    setShadow(ctx, "rgba(0,0,0,0)", 0, 0, 0);
    setFillStyle(ctx, "#fff");
    setFont(ctx, 11, "900");
    setTextAlign(ctx, "center");
    setTextBaseline(ctx, "middle");
    ctx.fillText(label, p.x, p.y);
    ctx.restore();
  },

  drawMapPill(ctx, text, point, state, options = {}) {
    if (!text) return;
    const p = this.project(point, state);
    const fontSize = options.fontSize || 12;
    ctx.save();
    setFont(ctx, fontSize, "900");
    setTextAlign(ctx, "center");
    setTextBaseline(ctx, "middle");
    const width = Math.min(options.maxWidth || 112, measureTextWidth(ctx, text, fontSize) + 22);
    const height = options.height || 30;
    setShadow(ctx, "rgba(20, 53, 94, 0.22)", 14, 0, 4);
    setFillStyle(ctx, options.fill || "#ffffff");
    this.roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, height / 2);
    ctx.fill();
    if (options.stroke) {
      setStrokeStyle(ctx, options.stroke);
      setLineWidth(ctx, 1.5);
      ctx.stroke();
    }
    setShadow(ctx, "rgba(0,0,0,0)", 0, 0, 0);
    setFillStyle(ctx, options.color || palette.text);
    ctx.fillText(text, p.x, p.y + 0.5);
    ctx.restore();
  },

  drawCallout(ctx, text, point, state, options = {}) {
    if (!text) return;
    const p = this.project(point, state);
    const fontSize = options.fontSize || 12;
    const anchorOffset = options.anchorOffset || { x: 0, y: -36 };
    const x = p.x + anchorOffset.x;
    const y = p.y + anchorOffset.y;
    ctx.save();
    setFont(ctx, fontSize, "950");
    setTextAlign(ctx, "center");
    setTextBaseline(ctx, "middle");
    const width = Math.min(options.maxWidth || 160, measureTextWidth(ctx, text, fontSize) + 24);
    const height = options.height || 34;
    setStrokeStyle(ctx, options.stroke || options.fill || "#0b6cff");
    setLineWidth(ctx, 2);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 4);
    ctx.lineTo(x, y + height / 2 - 2);
    ctx.stroke();
    setShadow(ctx, "rgba(20, 53, 94, 0.25)", 16, 0, 5);
    setFillStyle(ctx, options.fill || "#0b6cff");
    this.roundRect(ctx, x - width / 2, y - height / 2, width, height, height / 2);
    ctx.fill();
    setShadow(ctx, "rgba(0,0,0,0)", 0, 0, 0);
    setFillStyle(ctx, options.color || "#ffffff");
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  },

  drawLabel(ctx, text, point, state, options = {}) {
    if (!text) return;
    const density = state.all && this.transform.zoom < 1.15 ? "sparse" : state.all ? "medium" : "dense";
    if (options.priority === "low" && density === "sparse") return;
    const p = this.project(point, state);
    const lines = String(text).split("\n");
    const fontSize = options.small ? 11 : density === "sparse" ? 12 : 13;
    ctx.save();
    setFont(ctx, fontSize, "700");
    setTextAlign(ctx, "center");
    setTextBaseline(ctx, "middle");
    const width = Math.min(96, Math.max(...lines.map((line) => measureTextWidth(ctx, line, fontSize))) + 12);
    const height = lines.length * (fontSize + 2) + 7;
    setFillStyle(ctx, options.badge === false ? "transparent" : "rgba(255,255,255,0.9)");
    if (options.badge !== false) {
      this.roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, 9);
      ctx.fill();
    }
    setFillStyle(ctx, options.color || palette.text);
    lines.forEach((line, index) => {
      ctx.fillText(line, p.x, p.y + (index - (lines.length - 1) / 2) * (fontSize + 3));
    });
    ctx.restore();
  },

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  },

  drawFloor(ctx, floorId, state) {
    const sourceFloorId = floorId === "25F" ? "2F" : floorId;
    const floor = mapData.floors.find((candidate) => candidate.id === sourceFloorId);
    if (floor && floorId !== "25F") {
      this.drawExtrudedPolygon(ctx, floor.outline, state, {
        depthPx: state.exploded ? 64 : state.section ? 42 : 52,
        offsetX: state.exploded ? 20 / state.scale : 14 / state.scale,
        topFill: floorId === "2F" ? "#eef7ff" : palette.floor,
        sideFill: floorId === "2F" ? "#a9bfd4" : "#9fb6cc",
        topStroke: palette.floorEdge,
        lineWidth: 4.2
      });
    } else {
      const space = mapData.spaces.find((candidate) => candidate.id === "space-202-5");
      const room = mapData.rooms.find((candidate) => candidate.id === "202-5");
      const outline = space ? space.polygon : room.polygon;
      this.drawExtrudedPolygon(ctx, outline, state, {
        depthPx: 34,
        offsetX: 9 / state.scale,
        topFill: "#ffe7b8",
        sideFill: "#d89b43",
        topStroke: "#ce8721",
        lineWidth: 4
      });
    }

    this.drawSpaces(ctx, floorId, state);
    this.drawRooms(ctx, floorId, state);
    this.drawWalls(ctx, floorId, state);
    this.drawDoors(ctx, floorId, state);
    this.drawStairs(ctx, floorId, state);
    this.drawCenterlines(ctx, floorId, state);
    this.drawRoute(ctx, floorId, state);
    this.drawRouteNodes(ctx, floorId, state);

    const titlePoint = floorId === "25F" ? state.viewport.minX + 35 : state.viewport.minX + 70;
    this.drawMapPill(ctx, floorTitles[floorId], [titlePoint, state.viewport.minY + 35], state, {
      fill: floorId === "25F" ? "#fff2d7" : "#ffffff",
      color: floorId === "25F" ? "#9a5a00" : "#31516f",
      stroke: floorId === "25F" ? "#efb45a" : "#c7d9ee",
      fontSize: 11,
      height: 28
    });
  },

  drawSpaces(ctx, floorId, state) {
    const raisedBounds = this.data.layerMode === "raised202" ? raised202ContextBounds() : null;
    const spaces = mapData.spaces.filter((space) => {
      if (floorId === "25F") return space.id === "space-202-5";
      if (space.id === "space-202-5" || space.kind === "room") return false;
      if (raisedBounds && floorId === "2F") return pointInBounds(space.center, raisedBounds, 24);
      return space.floor === floorId;
    });
    spaces.forEach((space) => {
      const fill = spaceColor(space);
      const stroke = space.kind === "corridor" ? palette.corridorLine : "#8da1b5";
      this.drawPolygon(ctx, space.polygon, state, fill, stroke, space.kind === "corridor" ? 3.2 : 1.8);
      if (space.kind === "corridor") {
        const box = boundsForPolygon(space.polygon);
        this.drawLine(ctx, [(box.minX + box.maxX) / 2, box.minY + 8], [(box.minX + box.maxX) / 2, box.maxY - 8], state, "rgba(31, 118, 174, 0.32)", 2.8, true);
      }
      const priority = space.kind === "corridor" ? "normal" : "low";
      this.drawLabel(ctx, space.kind === "corridor" ? "走廊" : space.label, space.center, state, { small: true, color: "#245672", priority, badge: space.kind === "corridor" });
    });
  },

  drawRooms(ctx, floorId, state) {
    const route = this.data.route;
    const selectedRoom = this.data.selectedRoom;
    const raisedBounds = this.data.layerMode === "raised202" ? raised202ContextBounds() : null;
    const rooms = mapData.rooms.filter((room) => {
      if (displayFloorForRoom(room) !== floorId) return false;
      if (raisedBounds && floorId === "2F") return pointInBounds(room.center, raisedBounds, 18) || room.id === "202-5";
      return true;
    });
    rooms.forEach((room) => {
      const onRoute = Boolean(route && (route.targetRoomId === room.id || route.nodeIds.includes(`center-${room.id}`) || route.nodeIds.includes(room.doorNodeId)));
      this.drawPolygon(ctx, room.polygon, state, onRoute ? "#dbeafe" : roomColor(room), selectedRoom && selectedRoom.id === room.id ? "#17253a" : palette.wall, onRoute ? 4.2 : 2.6);
      const labelPoint = room.labelPoint || room.center;
      const density = state.all && this.transform.zoom < 1.15 ? "sparse" : state.all ? "medium" : "dense";
      this.drawLabel(ctx, labelForRoom(room, density, onRoute), labelPoint, state, { color: onRoute ? "#0b4fb3" : palette.text, priority: onRoute ? "normal" : density === "sparse" ? "low" : "normal" });
      lastTapTargets.push({ id: room.id, floorId, polygon: room.polygon, state });
    });
  },

  drawWalls(ctx, floorId, state) {
    const raisedBounds = this.data.layerMode === "raised202" ? raised202ContextBounds() : null;
    const sourceFloor = floorId === "25F" ? "2F" : floorId;
    const walls = (mapData.walls || []).filter((wall) => {
      if (wall.floor !== sourceFloor) return false;
      if (floorId === "25F") return wall.roomId === "202-5" || wall.id.includes("202-5");
      if (raisedBounds && floorId === "2F") return pointInBounds(wall.from, raisedBounds, 18) || pointInBounds(wall.to, raisedBounds, 18);
      return true;
    });
    walls.forEach((wall) => {
      const low = wall.kind === "low";
      const outer = wall.kind === "outer";
      if (state.all || outer) {
        this.drawWallPrism(ctx, wall.from, wall.to, state, {
          width: outer ? 2.7 : low ? 1.3 : 1.8,
          lift: outer ? 8 : low ? 4 : 6,
          topFill: low ? "rgba(84, 106, 128, 0.44)" : outer ? "rgba(47, 68, 90, 0.88)" : "rgba(47, 68, 90, 0.68)",
          sideFill: low ? "rgba(126, 145, 164, 0.22)" : outer ? "rgba(76, 97, 118, 0.44)" : "rgba(98, 119, 140, 0.28)"
        });
      } else {
        this.drawLine(ctx, wall.from, wall.to, state, low ? "rgba(73, 92, 112, 0.58)" : outer ? "#48617b" : "rgba(47, 68, 90, 0.88)", outer ? 3.8 : low ? 1.7 : 2.3);
      }
    });
  },

  drawCenterlines(ctx, floorId, state) {
    const route = this.data.route;
    const routeNodePairSet = new Set();
    if (route) {
      for (let i = 1; i < route.nodeIds.length; i += 1) {
        routeNodePairSet.add(`${route.nodeIds[i - 1]}->${route.nodeIds[i]}`);
        routeNodePairSet.add(`${route.nodeIds[i]}->${route.nodeIds[i - 1]}`);
      }
    }
    (mapData.centerlines || []).forEach((line) => {
      if (line.floor !== (floorId === "25F" ? "2F" : floorId)) return;
      const onRoute = routeNodePairSet.has(`${line.from}->${line.to}`);
      if (!onRoute && this.data.layerMode === "allFloors" && this.transform.zoom < 1.2) return;
      const from = mapData.nodes.find((node) => node.id === line.from);
      const to = mapData.nodes.find((node) => node.id === line.to);
      if (!from || !to) return;
      if (floorId === "25F" && !line.id.includes("202")) return;
      this.drawLine(ctx, from.point, to.point, state, onRoute ? "rgba(11, 108, 255, 0.36)" : "rgba(42, 116, 160, 0.16)", onRoute ? 3.8 : 1.8, !onRoute);
    });
  },

  drawDoors(ctx, floorId, state) {
    const route = this.data.route;
    const raisedBounds = this.data.layerMode === "raised202" ? raised202ContextBounds() : null;
    const doors = mapData.doors.filter((door) => {
      if (displayFloorForDoor(door) !== floorId) return false;
      if (raisedBounds && floorId === "2F") return pointInBounds(door.point, raisedBounds, 24);
      return true;
    });
    doors.forEach((door) => {
      const active = Boolean(route && route.nodeIds.includes(door.nodeId));
      this.drawLine(ctx, door.from, door.to, state, active ? palette.route : door.source === "inferred" ? palette.inferredDoor : palette.door, active ? 6 : 4.2, door.source === "inferred");
      if (active) {
        const p = this.project(door.point, state);
        ctx.save();
        setFillStyle(ctx, palette.route);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  },

  drawStairs(ctx, floorId, state) {
    mapData.stairs.forEach((stair) => {
      const entries = [];
      if (floorId === stair.lowerFloor) entries.push({ polygon: stair.lowerLanding, nodeId: stair.lowerNodeId, label: `${stair.label}下口` });
      if (floorId === stair.upperFloor && stair.upperNodeId !== "stair-202-virtual") entries.push({ polygon: stair.upperLanding, nodeId: stair.upperNodeId, label: `${stair.label}上口` });
      if (floorId === "25F" && stair.id === "stair-public") entries.push({ polygon: [[780, 255], [820, 255], [820, 315], [780, 315]], nodeId: "door-202-5", label: "202 平台梯" });
      entries.forEach((entry) => {
        const active = Boolean(this.data.route && this.data.route.nodeIds.includes(entry.nodeId));
        this.drawExtrudedPolygon(ctx, entry.polygon, state, {
        depthPx: active ? 30 : 24,
        offsetX: 7 / state.scale,
          topFill: active ? "#ffb12b" : palette.stair,
          sideFill: active ? "#d77900" : "#d49639",
          topStroke: palette.stairEdge,
          lineWidth: active ? 3.4 : 2.4
        });
        this.drawStairTreads(ctx, entry.polygon, state, active);
        if (active) {
          const box = boundsForPolygon(entry.polygon);
          this.drawLine(ctx, [box.minX + 4, box.minY + 4], [box.maxX - 4, box.maxY - 4], state, "rgba(255,255,255,0.9)", 3);
        }
        this.drawLabel(ctx, entry.label, this.centroid(entry.polygon), state, { small: true, color: "#704100" });
      });
    });
  },

  drawStairTreads(ctx, polygon, state, active = false) {
    const box = boundsForPolygon(polygon);
    const steps = 7;
    for (let i = 1; i < steps; i += 1) {
      const y = box.minY + ((box.maxY - box.minY) * i) / steps;
      const inset = 5 + (i % 2) * 3;
      this.drawLine(ctx, [box.minX + inset, y], [box.maxX - inset, y], state, active ? "rgba(255,255,255,0.86)" : "rgba(111, 62, 0, 0.82)", active ? 2 : 1.3);
    }
  },

  drawRoute(ctx, floorId, state) {
    const route = this.data.route;
    if (!route) return;
    ctx.save();
    setGlobalAlpha(ctx, 0.28);
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1];
      const to = route.points[index];
      const fromFloor = displayFloorForRoutePoint(from);
      const toFloor = displayFloorForRoutePoint(to);
      if (fromFloor !== floorId || toFloor !== floorId) continue;
      this.drawLine(ctx, from.point, to.point, state, "#ffffff", 15, false);
    }
    setGlobalAlpha(ctx, 1);
    ctx.restore();
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1];
      const to = route.points[index];
      const fromFloor = displayFloorForRoutePoint(from);
      const toFloor = displayFloorForRoutePoint(to);
      if (fromFloor !== floorId || toFloor !== floorId) continue;
      const active = index - 1 === this.data.activeStepIndex;
      const stair = to.kind.includes("stair") || to.kind === "stair";
      this.drawLine(ctx, from.point, to.point, state, stair ? palette.stairRoute : palette.route, active ? 9 : stair ? 7 : 5.8);
      if (active) this.drawActiveRouteChevron(ctx, from.point, to.point, state, stair);
    }
  },

  drawActiveRouteChevron(ctx, from, to, state, stair) {
    const a = this.project(from, state);
    const b = this.project(to, state);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    setFillStyle(ctx, stair ? palette.stairRoute : palette.route);
    setShadow(ctx, "rgba(6, 24, 56, 0.22)", 12, 0, 2);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-5, -7);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawRouteNodes(ctx, floorId, state) {
    const route = this.data.route;
    if (!route) return;
    route.points.forEach((point, index) => {
      if (displayFloorForRoutePoint(point) !== floorId) return;
      const p = this.project(point.point, state);
      const first = index === 0;
      const last = index === route.points.length - 1;
      const active = index === this.data.activeStepIndex + 1;
      this.drawPointPin(ctx, point.point, state, first ? "起" : last ? "终" : String(index + 1), first ? palette.start : last ? palette.target : point.kind.includes("stair") ? palette.stairRoute : palette.route, first || last ? 14 : active ? 11 : 8);
      if (first || last || active) {
        this.drawMapPill(ctx, first ? "现在" : last ? "目标" : "下一处", [point.point[0], point.point[1] - 22 / state.scale], state, {
          fill: first ? "#16a060" : last ? "#ff3f6c" : "#0b6cff",
          color: "#ffffff",
          fontSize: 11,
          height: 26
        });
      }
    });
    this.drawRouteCallouts(ctx, floorId, state);
  },

  drawRouteCallouts(ctx, floorId, state) {
    const route = this.data.route;
    if (!route) return;
    const activeIndex = this.data.activeStepIndex || 0;
    const start = route.points[0];
    const next = route.points[Math.min(route.points.length - 1, activeIndex + 1)];
    const target = route.points[route.points.length - 1];
    const callouts = [
      {
        point: start,
        text: `现在 ${roomLabel(route.startRoomId)} 房间内`,
        fill: palette.start,
        anchorOffset: { x: -18, y: 34 }
      },
      {
        point: next,
        text: `下一处 ${next ? nodeTitle({ kind: next.kind, label: next.label }, next.nodeId).replace(" 房间内", "").replace(" 门口", "门口") : ""}`,
        fill: palette.route,
        anchorOffset: { x: 8, y: -42 }
      },
      {
        point: target,
        text: `终点 ${roomLabel(route.targetRoomId)}`,
        fill: palette.target,
        anchorOffset: { x: 22, y: -48 }
      }
    ];
    callouts.forEach((item) => {
      if (!item.point || displayFloorForRoutePoint(item.point) !== floorId) return;
      this.drawCallout(ctx, item.text, item.point.point, state, {
        fill: item.fill,
        stroke: item.fill,
        anchorOffset: item.anchorOffset,
        fontSize: 12,
        maxWidth: 170
      });
    });
  },

  centroid(polygon) {
    const sum = polygon.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
    return [sum[0] / polygon.length, sum[1] / polygon.length];
  },

  canvasToMap(point, state) {
    const rotation = this.transform.rotation || 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = point.x - state.baseX;
    const dy = point.y - state.baseY;
    const px = dx * cos + dy * sin;
    const py = -dx * sin + dy * cos;
    const y = py / state.tiltY;
    const x = px - y * state.skewX;
    return [
      x / state.scale + state.viewport.minX + state.viewport.width / 2,
      y / state.scale + state.viewport.minY + state.viewport.height / 2
    ];
  },

  handleCanvasTap(event) {
    const touch = event.changedTouches && event.changedTouches[0];
    const raw = touch || event.detail || {};
    const tap = {
      x: Number(raw.x ?? raw.clientX ?? raw.pageX ?? 0),
      y: Number(raw.y ?? raw.clientY ?? raw.pageY ?? 0)
    };
    const railAction = railTapAction(tap);
    if (railAction) {
      if (railAction.action === "back") {
        this.goBack();
        return;
      }
      if (railAction.panel) {
        this.openPanel({ currentTarget: { dataset: { panel: railAction.panel } } });
        return;
      }
      if (railAction.view) {
        this.setViewPreset({ currentTarget: { dataset: { view: railAction.view } } });
        return;
      }
    }
    const ids = this.visibleFloorIds();
    for (let f = ids.length - 1; f >= 0; f -= 1) {
      const state = this.floorDrawState(ids[f], f, ids.length);
      const mapPoint = this.canvasToMap({ x: tap.x, y: tap.y }, state);
      const rooms = mapData.rooms.filter((room) => displayFloorForRoom(room) === ids[f]);
      for (const room of rooms) {
        if (pointInPolygon(mapPoint, room.polygon)) {
          this.selectRoomById(room.id);
          return;
        }
      }
    }
  },

  handlePageTap(event) {
    const touch = event.changedTouches && event.changedTouches[0];
    const raw = touch || event.detail || {};
    const tap = {
      x: Number(raw.x ?? raw.clientX ?? raw.pageX ?? 0),
      y: Number(raw.y ?? raw.clientY ?? raw.pageY ?? 0)
    };
    const railAction = railTapAction(tap);
    if (!railAction) return;
    if (railAction.action === "back") {
      this.goBack();
      return;
    }
    if (railAction.panel) {
      this.openPanel({ currentTarget: { dataset: { panel: railAction.panel } } });
      return;
    }
    if (railAction.view) {
      this.setViewPreset({ currentTarget: { dataset: { view: railAction.view } } });
    }
  },

  handleTouchStart(event) {
    const touches = event.touches || [];
    if (touches.length === 1) {
      this.touchState = {
        mode: "pan",
        startX: touches[0].clientX,
        startY: touches[0].clientY,
        transform: cloneTransform(this.transform)
      };
    } else if (touches.length >= 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      this.touchState = {
        mode: "pinch",
        distance: Math.hypot(dx, dy),
        angle: Math.atan2(dy, dx),
        transform: cloneTransform(this.transform)
      };
    }
  },

  handleTouchMove(event) {
    if (!this.touchState) return;
    const touches = event.touches || [];
    if (this.touchState.mode === "pan" && touches.length === 1) {
      this.transform.panX = this.touchState.transform.panX + touches[0].clientX - this.touchState.startX;
      this.transform.panY = this.touchState.transform.panY + touches[0].clientY - this.touchState.startY;
      this.transform.imagePanX = this.touchState.transform.imagePanX + touches[0].clientX - this.touchState.startX;
      this.transform.imagePanY = this.touchState.transform.imagePanY + touches[0].clientY - this.touchState.startY;
      this.drawMap();
    } else if (this.touchState.mode === "pinch" && touches.length >= 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      this.transform.zoom = Math.min(2.55, Math.max(0.82, this.touchState.transform.zoom * (distance / this.touchState.distance)));
      this.transform.rotation = Math.min(0.32, Math.max(-0.32, (this.touchState.transform.rotation || 0) + (angle - this.touchState.angle) * 0.42));
      this.transform.imageZoom = Math.min(2.4, Math.max(1, this.touchState.transform.imageZoom * (distance / this.touchState.distance)));
      this.transform.imageRotation = Math.min(0.18, Math.max(-0.18, (this.touchState.transform.imageRotation || 0) + (angle - this.touchState.angle) * 0.35));
      this.drawMap();
    }
  },

  handleTouchEnd() {
    this.touchState = null;
  },

  setLayer(event) {
    const layerMode = event.currentTarget.dataset.layer;
    this.transform = normalizeTransform(this.defaultTransform(layerMode, this.data.viewPreset));
    updateNativeVisualMetrics(layerMode, this.data.hasRoute);
    this.setData({
      ...buildNativeMapVisual(this.data.route, this.data.activeStepIndex || 0, layerMode),
      layerMode,
      mapImageSrc: mapImageSrc(layerMode, this.data.route),
      layerHint: layerHints[layerMode] || layerHints.allFloors,
      allLayerClass: activeLayerClass(layerMode, "allFloors"),
      layer1FClass: layerButtonClass(layerMode, "1F"),
      layer2FClass: layerButtonClass(layerMode, "2F"),
      layer25FClass: activeLayerClass(layerMode, "raised202"),
      raised202LayerClass: activeLayerClass(layerMode, "raised202"),
      explodedLayerClass: activeLayerClass(layerMode, "exploded"),
      sectionLayerClass: activeLayerClass(layerMode, "section")
    }, () => this.drawMap());
  },

  defaultTransform(layerMode = this.data.layerMode, viewPreset = this.data.viewPreset) {
    const grouped = layerMode === "allFloors" || layerMode === "exploded" || layerMode === "section";
    const compactLandscape = canvasBox.height > 0 && (canvasBox.height < 280 || canvasBox.width < 520);
    const base = compactLandscape ? (grouped ? 1.46 : layerMode === "raised202" ? 1.42 : 1.36) : grouped ? 1.18 : layerMode === "raised202" ? 1.2 : 1.16;
    const rotation = grouped || layerMode === "raised202" ? (compactLandscape ? -0.045 : -0.075) : 0;
    let zoom = base;
    if (viewPreset === "near") zoom = Math.max(1.22, base + 0.16);
    if (viewPreset === "route") zoom = this.data.route ? Math.max(1.16, base + 0.12) : base;
    return normalizeTransform({ panX: 0, panY: 0, zoom, rotation });
  },

  setViewPreset(event) {
    const viewPreset = event.currentTarget.dataset.view;
    if (viewPreset === "rotateLeft" || viewPreset === "rotateRight") {
      const delta = viewPreset === "rotateLeft" ? -0.09 : 0.09;
      this.transform = normalizeTransform(this.transform || {});
      this.transform.rotation = Math.min(0.36, Math.max(-0.36, (this.transform.rotation || 0) + delta));
      this.transform.imageRotation = Math.min(0.28, Math.max(-0.28, (this.transform.imageRotation || 0) + delta));
      this.setData({ viewPreset: "near" }, () => this.drawMap());
      return;
    }
    const nextPreset = viewPreset === "reset" ? "overview" : viewPreset;
    this.transform = normalizeTransform(this.defaultTransform(this.data.layerMode, nextPreset));
    this.transform = imagePresetTransform(this.transform, nextPreset);
    this.setData({ viewPreset: nextPreset }, () => this.drawMap());
  },

  focusActiveStep() {
    const route = this.data.route;
    if (!route) {
      this.transform = normalizeTransform(this.defaultTransform("allFloors", "overview"));
      updateNativeVisualMetrics("allFloors", false);
      this.setData({
        ...buildNativeMapVisual(null, 0, "allFloors"),
        layerMode: "allFloors",
        mapImageSrc: mapImageSrc("allFloors", null),
        viewPreset: "overview",
        layerHint: layerHints.allFloors
      }, () => this.drawMap());
      return;
    }
    const point = route.points[Math.min(route.points.length - 1, (this.data.activeStepIndex || 0) + 1)];
    const targetFloor = displayFloorForRoutePoint(point);
    const layerMode = shouldKeepRouteOverviewAsset(route) ? "allFloors" : targetFloor === "25F" ? "raised202" : targetFloor;
    this.transform = normalizeTransform(this.defaultTransform(layerMode, "route"));
    const ids = layerMode === "allFloors" ? floorOrder : layerMode === "raised202" ? ["2F", "25F"] : [layerMode];
    const floorId = layerMode === "allFloors" ? targetFloor : targetFloor === "25F" ? "25F" : targetFloor;
    const state = this.floorDrawState(floorId, Math.max(0, ids.indexOf(floorId)), ids.length, layerMode);
    const projected = this.project(point.point, state);
    this.transform.panX += canvasBox.width * 0.47 - projected.x;
    this.transform.panY += canvasBox.height * 0.48 - projected.y;
    updateNativeVisualMetrics(layerMode, true);
    this.setData({
      ...buildNativeMapVisual(route, this.data.activeStepIndex || 0, layerMode),
      layerMode,
      mapImageSrc: mapImageSrc(layerMode, route),
      viewPreset: "route",
      layerHint: layerHints[layerMode] || layerHints.allFloors,
      allLayerClass: activeLayerClass(layerMode, "allFloors"),
      layer1FClass: activeLayerClass(layerMode, "1F"),
      layer2FClass: activeLayerClass(layerMode, "2F"),
      layer25FClass: activeLayerClass(layerMode, "raised202"),
      raised202LayerClass: activeLayerClass(layerMode, "raised202"),
      explodedLayerClass: activeLayerClass(layerMode, "exploded"),
      sectionLayerClass: activeLayerClass(layerMode, "section")
    }, () => this.drawMap());
  },

  stepRouteProgress(delta) {
    if (!this.data.route) return;
    if (delta && delta.currentTarget) delta = Number(delta.currentTarget.dataset.delta || 0);
    this.setRouteState({
      route: this.data.route,
      targetRoomId: this.data.targetRoomId,
      startRoomId: this.data.startRoomId,
      activeStepIndex: (this.data.activeStepIndex || 0) + delta
    });
  },

  advanceRouteCheckpoint() {
    if (!this.data.route) return;
    if (!this.data.canNextStep) {
      this.clearRoute();
      return;
    }
    this.stepRouteProgress(1);
  },

  openPanel(event) {
    const panel = event.currentTarget.dataset.panel;
    this.setData({
      panel,
      routeButtonClass: panelButtonClass(panel, "route"),
      layersButtonClass: panelButtonClass(panel, "layers"),
      viewButtonClass: panelButtonClass(panel, "view"),
      roomButtonClass: panelButtonClass(panel, "room")
    });
  },

  closePanel() {
    this.setData({
      panel: "none",
      routeButtonClass: "",
      layersButtonClass: "",
      viewButtonClass: "",
      roomButtonClass: ""
    });
  },

  selectRoomById(id) {
    const selectedRoom = mapData.rooms.find((room) => room.id === id);
    this.setData({
      selectedRoom,
      selectedFloorLabel: selectedRoom ? `${displayFloorForRoom(selectedRoom)} · ${selectedRoom.roomNo}` : "点击地图房间",
      panel: "room",
      routeButtonClass: "",
      layersButtonClass: "",
      viewButtonClass: "",
      roomButtonClass: "active"
    }, () => this.drawMap());
  },

  selectNativeRoom(event) {
    const id = event.currentTarget.dataset.id;
    if (id) this.selectRoomById(id);
  },

  selectQuickTarget(event) {
    const targetRoomId = event.currentTarget.dataset.id;
    const route = calculateRoute(this.data.startRoomId, targetRoomId);
    this.transform = normalizeTransform(this.defaultTransform("allFloors", "route"));
    this.setRouteState({
      layerMode: "allFloors",
      layerHint: layerHints.allFloors,
      targetRoomId,
      route,
      viewPreset: "route",
      activeStepIndex: 0,
      panel: "none",
      allLayerClass: activeLayerClass("allFloors", "allFloors"),
      layer1FClass: "",
      layer2FClass: "",
      layer25FClass: "",
      raised202LayerClass: "",
      explodedLayerClass: "",
      sectionLayerClass: "",
      routeButtonClass: "active",
      layersButtonClass: "",
      viewButtonClass: "",
      roomButtonClass: ""
    });
    if (route) {
      wx.nextTick(() => this.focusActiveStep());
    }
  },

  clearRoute() {
    updateNativeVisualMetrics(this.data.layerMode, false);
    this.setRouteState({
      targetRoomId: "",
      route: null,
      activeStepIndex: 0,
      panel: "none",
      routeButtonClass: "",
      layersButtonClass: "",
      viewButtonClass: "",
      roomButtonClass: ""
    });
  },

  goBack() {
    wx.reLaunch({ url: "/pages/home/home" });
  }
});
