const mapData = require("../../data/map-data");

const defaultStartRoomId = mapData.defaultStartRoomId || "101";
const floorOrder = ["1F", "2F", "25F"];
const floorTitles = {
  "1F": "一层",
  "2F": "二层",
  "25F": "202 二层半"
};
const layerHints = {
  all: "全楼分层总览",
  "1F": "一层单层浏览",
  "2F": "二层单层浏览",
  "25F": "202 二层半平台"
};
const quickTargets = [
  { id: "104-2F01", label: "104 二层" },
  { id: "202-5", label: "202-5" },
  { id: "108-2F04", label: "108 二层" },
  { id: "208", label: "208" }
];

const palette = {
  floor: "#f7fbff",
  floorEdge: "#6e829c",
  floorSide: "#c7d7e8",
  corridor: "#d9f2ff",
  corridorLine: "#7bb9d6",
  service: "#dff6ec",
  restroom: "#d9f3e9",
  storage: "#e7edf4",
  reserved: "#edf1f6",
  teaching: "#e6f1ff",
  processing: "#fff0d7",
  lab: "#fff5dc",
  office: "#f0eafe",
  other: "#eef2f6",
  wall: "#53677f",
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

function floorViewport(floorId) {
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
    return expandBounds(boundsForPolygon(points), 0.18);
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
  if (density === "sparse") return onRoute ? room.roomNo : "";
  if (density === "medium") return room.roomNo;
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
      title: nodeTitle(to, edgeItem.to),
      desc: stepInstruction(edgeItem.edge, from, to, Math.round(edgeItem.weight)),
      kind: edgeItem.edge.kind,
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
    zoom: transform.zoom
  };
}

Page({
  data: {
    layerMode: "all",
    targetRoomId: "",
    startRoomId: defaultStartRoomId,
    route: null,
    hasRoute: false,
    routeSteps: [],
    routeDistanceLabel: "未选择终点",
    activeStepLabel: "1/1",
    currentStepTitle: "当前位置",
    nextStepTitle: "选择终点",
    selectedRoom: null,
    selectedFloorLabel: "点击地图房间",
    layerHint: layerHints.all,
    panel: "none",
    routeButtonClass: "",
    layersButtonClass: "",
    roomButtonClass: "",
    allLayerClass: "active",
    layer1FClass: "",
    layer2FClass: "",
    layer25FClass: "",
    sensorHint: "模拟器无传感器",
    quickTargets
  },

  onLoad(options) {
    this.transform = { panX: 0, panY: 0, zoom: 1 };
    this.touchState = null;
    const targetRoomId = options.targetRoomId || "";
    const startRoomId = options.startRoomId || defaultStartRoomId;
    const route = targetRoomId ? calculateRoute(startRoomId, targetRoomId) : null;
    this.initCanvas();
    this.setRouteState({
      targetRoomId,
      startRoomId,
      route,
      panel: route ? "route" : "none",
      routeButtonClass: route ? "active" : "",
      layersButtonClass: "",
      roomButtonClass: ""
    });
  },

  onReady() {
    this.initCanvas();
  },

  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select("#mapCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res && res[0];
        if (!item) return;
        const info = wx.getSystemInfoSync();
        canvasBox = { width: item.width, height: item.height };
        dprRef = info.pixelRatio || 1;
        if (item.node && item.node.getContext) {
          legacyCanvas = false;
          canvasRef = item.node;
          ctxRef = canvasRef.getContext("2d");
          canvasRef.width = item.width * dprRef;
          canvasRef.height = item.height * dprRef;
          ctxRef.setTransform(dprRef, 0, 0, dprRef, 0, 0);
        } else {
          legacyCanvas = true;
          canvasRef = null;
          ctxRef = wx.createCanvasContext("mapCanvas", this);
        }
        this.drawMap();
      });
  },

  setRouteState(next) {
    const route = next.route || null;
    const steps = route ? route.steps : [];
    const currentStep = steps[0];
    const nextStep = steps[1] || steps[0];
    this.setData({
      ...next,
      route,
      hasRoute: Boolean(route),
      routeSteps: steps,
      routeDistanceLabel: route ? route.distance : "未选择终点",
      activeStepLabel: route ? `1/${Math.max(1, steps.length)}` : "1/1",
      currentStepTitle: currentStep ? currentStep.title : "当前位置",
      nextStepTitle: nextStep ? nextStep.title : "选择终点"
    }, () => this.drawMap());
  },

  visibleFloorIds() {
    return this.data.layerMode === "all" ? floorOrder : [this.data.layerMode];
  },

  drawMap() {
    if (!ctxRef || !canvasBox.width || !canvasBox.height) return;
    const ctx = ctxRef;
    ctx.clearRect(0, 0, canvasBox.width, canvasBox.height);
    lastTapTargets = [];
    const ids = this.visibleFloorIds();
    ids.forEach((floorId, index) => {
      const state = this.floorDrawState(floorId, index, ids.length);
      this.drawFloor(ctx, floorId, state);
    });
    if (legacyCanvas && ctx.draw) ctx.draw();
  },

  floorDrawState(floorId, index, count) {
    const viewport = floorViewport(floorId);
    const all = this.data.layerMode === "all";
    const stageW = canvasBox.width;
    const stageH = canvasBox.height;
    const usableW = stageW * (all ? 0.88 : 0.9);
    const usableH = stageH * (all ? 0.78 : 0.82);
    const scale = Math.min(usableW / viewport.width, usableH / viewport.height) * this.transform.zoom;
    const floorGap = all ? Math.max(68, stageH * 0.2) : 0;
    const baseX = stageW * 0.5 + this.transform.panX + (all ? index * 26 : 0);
    const baseY = stageH * (all ? 0.7 : 0.54) + this.transform.panY - (all ? (count - 1 - index) * floorGap : 0);
    const tiltY = all ? 0.78 : 0.88;
    const skewX = all ? -0.04 : -0.01;
    return { floorId, index, viewport, scale, baseX, baseY, tiltY, skewX, all };
  },

  project(point, state) {
    const x = (point[0] - state.viewport.minX - state.viewport.width / 2) * state.scale;
    const y = (point[1] - state.viewport.minY - state.viewport.height / 2) * state.scale;
    return {
      x: state.baseX + x + y * state.skewX,
      y: state.baseY + y * state.tiltY
    };
  },

  drawPolygon(ctx, polygon, state, fill, stroke, lineWidth = 1.5, shadow = false) {
    if (!polygon.length) return;
    ctx.save();
    if (shadow) {
      ctx.shadowColor = "rgba(20, 53, 94, 0.16)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 10;
    }
    ctx.beginPath();
    polygon.forEach((point, index) => {
      const p = this.project(point, state);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
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
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    if (dashed) ctx.setLineDash([8, 7]);
    ctx.stroke();
    ctx.restore();
  },

  drawLabel(ctx, text, point, state, options = {}) {
    if (!text) return;
    const density = state.all && this.transform.zoom < 1.15 ? "sparse" : state.all ? "medium" : "dense";
    if (options.priority === "low" && density === "sparse") return;
    const p = this.project(point, state);
    const lines = String(text).split("\n");
    const fontSize = options.small ? 10 : density === "sparse" ? 11 : 12;
    ctx.save();
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = Math.min(96, Math.max(...lines.map((line) => ctx.measureText(line).width)) + 12);
    const height = lines.length * (fontSize + 2) + 7;
    ctx.fillStyle = options.badge === false ? "transparent" : "rgba(255,255,255,0.82)";
    if (options.badge !== false) {
      this.roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, 9);
      ctx.fill();
    }
    ctx.fillStyle = options.color || palette.text;
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
      const offsetOutline = floor.outline.map((point) => [point[0] + 10 / state.scale, point[1] + 42 / state.scale]);
      this.drawPolygon(ctx, offsetOutline, state, palette.floorSide, null, 0);
      this.drawPolygon(ctx, floor.outline, state, palette.floor, palette.floorEdge, 3.4, true);
    } else {
      const space = mapData.spaces.find((candidate) => candidate.id === "space-202-5");
      const room = mapData.rooms.find((candidate) => candidate.id === "202-5");
      const outline = space ? space.polygon : room.polygon;
      this.drawPolygon(ctx, outline, state, "#fff2d7", "#ce8721", 3.4, true);
    }

    this.drawSpaces(ctx, floorId, state);
    this.drawRooms(ctx, floorId, state);
    this.drawDoors(ctx, floorId, state);
    this.drawStairs(ctx, floorId, state);
    this.drawRoute(ctx, floorId, state);
    this.drawRouteNodes(ctx, floorId, state);

    const titlePoint = floorId === "25F" ? state.viewport.minX + 35 : state.viewport.minX + 70;
    this.drawLabel(ctx, floorTitles[floorId], [titlePoint, state.viewport.minY + 35], state, { color: floorId === "25F" ? "#9a5a00" : palette.text });
  },

  drawSpaces(ctx, floorId, state) {
    const spaces = mapData.spaces.filter((space) => {
      if (floorId === "25F") return space.id === "space-202-5";
      if (space.id === "space-202-5" || space.kind === "room") return false;
      return space.floor === floorId;
    });
    spaces.forEach((space) => {
      this.drawPolygon(ctx, space.polygon, state, spaceColor(space), space.kind === "corridor" ? palette.corridorLine : "#8da1b5", space.kind === "corridor" ? 2.3 : 1.6);
      const priority = space.kind === "corridor" ? "normal" : "low";
      this.drawLabel(ctx, space.kind === "corridor" ? "走廊" : space.label, space.center, state, { small: true, color: "#245672", priority });
    });
  },

  drawRooms(ctx, floorId, state) {
    const route = this.data.route;
    const selectedRoom = this.data.selectedRoom;
    const rooms = mapData.rooms.filter((room) => displayFloorForRoom(room) === floorId);
    rooms.forEach((room) => {
      const onRoute = Boolean(route && (route.targetRoomId === room.id || route.nodeIds.includes(`center-${room.id}`) || route.nodeIds.includes(room.doorNodeId)));
      this.drawPolygon(ctx, room.polygon, state, onRoute ? "#dbeafe" : roomColor(room), selectedRoom && selectedRoom.id === room.id ? "#17253a" : palette.wall, onRoute ? 3.6 : 2.2);
      const labelPoint = room.labelPoint || room.center;
      const density = state.all && this.transform.zoom < 1.15 ? "sparse" : state.all ? "medium" : "dense";
      this.drawLabel(ctx, labelForRoom(room, density, onRoute), labelPoint, state, { color: onRoute ? "#0b4fb3" : palette.text, priority: onRoute ? "normal" : density === "sparse" ? "low" : "normal" });
      lastTapTargets.push({ id: room.id, floorId, polygon: room.polygon, state });
    });
  },

  drawDoors(ctx, floorId, state) {
    const route = this.data.route;
    const doors = mapData.doors.filter((door) => displayFloorForDoor(door) === floorId);
    doors.forEach((door) => {
      const active = Boolean(route && route.nodeIds.includes(door.nodeId));
      this.drawLine(ctx, door.from, door.to, state, active ? palette.route : door.source === "inferred" ? palette.inferredDoor : palette.door, active ? 5 : 3, door.source === "inferred");
      if (active) {
        const p = this.project(door.point, state);
        ctx.save();
        ctx.fillStyle = palette.route;
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
        this.drawPolygon(ctx, entry.polygon, state, active ? "#ffb12b" : palette.stair, palette.stairEdge, active ? 2.8 : 1.8);
        this.drawStairTreads(ctx, entry.polygon, state);
        this.drawLabel(ctx, entry.label, this.centroid(entry.polygon), state, { small: true, color: "#704100" });
      });
    });
  },

  drawStairTreads(ctx, polygon, state) {
    const box = boundsForPolygon(polygon);
    const steps = 5;
    for (let i = 1; i < steps; i += 1) {
      const y = box.minY + ((box.maxY - box.minY) * i) / steps;
      this.drawLine(ctx, [box.minX + 4, y], [box.maxX - 4, y], state, "rgba(111, 62, 0, 0.82)", 1.3);
    }
  },

  drawRoute(ctx, floorId, state) {
    const route = this.data.route;
    if (!route) return;
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1];
      const to = route.points[index];
      const fromFloor = displayFloorForRoutePoint(from);
      const toFloor = displayFloorForRoutePoint(to);
      if (fromFloor !== floorId || toFloor !== floorId) continue;
      this.drawLine(ctx, from.point, to.point, state, "#ffffff", 13, false);
    }
    ctx.restore();
    for (let index = 1; index < route.points.length; index += 1) {
      const from = route.points[index - 1];
      const to = route.points[index];
      const fromFloor = displayFloorForRoutePoint(from);
      const toFloor = displayFloorForRoutePoint(to);
      if (fromFloor !== floorId || toFloor !== floorId) continue;
      const stair = to.kind.includes("stair") || to.kind === "stair";
      this.drawLine(ctx, from.point, to.point, state, stair ? palette.stairRoute : palette.route, stair ? 6 : 5);
    }
  },

  drawRouteNodes(ctx, floorId, state) {
    const route = this.data.route;
    if (!route) return;
    route.points.forEach((point, index) => {
      if (displayFloorForRoutePoint(point) !== floorId) return;
      const p = this.project(point.point, state);
      const first = index === 0;
      const last = index === route.points.length - 1;
      ctx.save();
      ctx.fillStyle = first ? palette.start : last ? palette.target : point.kind.includes("stair") ? palette.stairRoute : palette.route;
      ctx.shadowColor = "rgba(11, 108, 255, 0.22)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, first || last ? 11 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "800 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(first ? "起" : last ? "终" : String(index + 1), p.x, p.y);
      ctx.restore();
    });
  },

  centroid(polygon) {
    const sum = polygon.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
    return [sum[0] / polygon.length, sum[1] / polygon.length];
  },

  canvasToMap(point, state) {
    const y = (point.y - state.baseY) / state.tiltY;
    const x = point.x - state.baseX - y * state.skewX;
    return [
      x / state.scale + state.viewport.minX + state.viewport.width / 2,
      y / state.scale + state.viewport.minY + state.viewport.height / 2
    ];
  },

  handleCanvasTap(event) {
    const tap = event.detail;
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
      this.drawMap();
    } else if (this.touchState.mode === "pinch" && touches.length >= 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      this.transform.zoom = Math.min(2.2, Math.max(0.74, this.touchState.transform.zoom * (distance / this.touchState.distance)));
      this.drawMap();
    }
  },

  handleTouchEnd() {
    this.touchState = null;
  },

  setLayer(event) {
    const layerMode = event.currentTarget.dataset.layer;
    this.transform = { panX: 0, panY: 0, zoom: layerMode === "all" ? 1 : 1.12 };
    this.setData({
      layerMode,
      layerHint: layerHints[layerMode] || layerHints.all,
      allLayerClass: layerButtonClass(layerMode, "all"),
      layer1FClass: layerButtonClass(layerMode, "1F"),
      layer2FClass: layerButtonClass(layerMode, "2F"),
      layer25FClass: layerButtonClass(layerMode, "25F")
    }, () => this.drawMap());
  },

  openPanel(event) {
    const panel = event.currentTarget.dataset.panel;
    this.setData({
      panel,
      routeButtonClass: panelButtonClass(panel, "route"),
      layersButtonClass: panelButtonClass(panel, "layers"),
      roomButtonClass: panelButtonClass(panel, "room")
    });
  },

  closePanel() {
    this.setData({
      panel: "none",
      routeButtonClass: "",
      layersButtonClass: "",
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
      roomButtonClass: "active"
    }, () => this.drawMap());
  },

  selectQuickTarget(event) {
    const targetRoomId = event.currentTarget.dataset.id;
    const route = calculateRoute(this.data.startRoomId, targetRoomId);
    this.setRouteState({
      targetRoomId,
      route,
      panel: "route",
      routeButtonClass: "active",
      layersButtonClass: "",
      roomButtonClass: ""
    });
  },

  clearRoute() {
    this.setRouteState({
      targetRoomId: "",
      route: null,
      panel: "none",
      routeButtonClass: "",
      layersButtonClass: "",
      roomButtonClass: ""
    });
  },

  goBack() {
    wx.reLaunch({ url: "/pages/home/home" });
  }
});
