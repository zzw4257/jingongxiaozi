import { createServer } from "vite";
import fs from "node:fs";

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const midpoint = (from, to) => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];

const polygonBounds = (polygon) => {
  const xs = polygon.map((point) => point[0]);
  const ys = polygon.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

const pointOnRoomBoundary = (point, room, tolerance = 0.75) => {
  const bounds = polygonBounds(room.polygon);
  const withinX = point[0] >= bounds.minX - tolerance && point[0] <= bounds.maxX + tolerance;
  const withinY = point[1] >= bounds.minY - tolerance && point[1] <= bounds.maxY + tolerance;
  if (!withinX || !withinY) return false;
  return (
    Math.abs(point[0] - bounds.minX) <= tolerance ||
    Math.abs(point[0] - bounds.maxX) <= tolerance ||
    Math.abs(point[1] - bounds.minY) <= tolerance ||
    Math.abs(point[1] - bounds.maxY) <= tolerance
  );
};

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const mapRenderer = fs.readFileSync(new URL("../src/features/map3d/Map3DApp.tsx", import.meta.url), "utf8");
  for (const token of ["SEMANTIC_RENDER_POLICY", "minimumPassiveRoomOpacity", "doorThresholdLift", "routeKeyPinLift"]) {
    if (!mapRenderer.includes(token)) {
      throw new Error(`Map renderer must keep centralized semantic render policy token: ${token}`);
    }
  }
  if (mapRenderer.includes("building.add(pointMarker(center")) {
    throw new Error("Ordinary door points must not be product-visible; only active checkpoint doors may render markers.");
  }
  if (/wall\.kind\s*===\s*[\"']outer[\"']\)\s*return\s*false/.test(mapRenderer)) {
    throw new Error("Second-floor outer walls must not be hidden in all-floors view.");
  }

  const { jingongMapData } = await server.ssrLoadModule("/src/features/map/data/mapData.ts");
  const roomIds = jingongMapData.rooms.map((room) => room.id);
  const duplicates = roomIds.filter((id, index) => roomIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate room ids: ${duplicates.join(", ")}`);
  }

  const required = ["101", "104-2F01", "106-2F", "108-2F04", "202-5"];
  for (const id of required) {
    if (!roomIds.includes(id)) throw new Error(`Missing required room ${id}`);
  }

  const nodeIds = new Set(jingongMapData.nodes.map((node) => node.id));
  const edgeKeys = new Set(jingongMapData.edges.map((edge) => `${edge.from}->${edge.to}`));
  const nodesById = new Map(jingongMapData.nodes.map((node) => [node.id, node]));
  for (const room of jingongMapData.rooms) {
    if (!nodeIds.has(room.doorNodeId)) throw new Error(`${room.id}: missing door node ${room.doorNodeId}`);
    if (!nodeIds.has(`center-${room.id}`)) throw new Error(`${room.id}: missing room center node`);
    if (!edgeKeys.has(`center-${room.id}->${room.doorNodeId}`) && !edgeKeys.has(`${room.doorNodeId}->center-${room.id}`)) {
      throw new Error(`${room.id}: missing room-entry edge from center to door`);
    }
    const door = jingongMapData.doors.find((candidate) => candidate.nodeId === room.doorNodeId);
    if (!door) throw new Error(`${room.id}: missing explicit door segment`);
    if (!door.from || !door.to || door.width <= 0) throw new Error(`${room.id}: invalid door segment geometry`);
    if (!door.source) throw new Error(`${room.id}: door source must be declared`);
    if (door.floor !== room.floor) throw new Error(`${room.id}: door floor does not match room floor`);
    if (door.connects[0] !== room.id) throw new Error(`${room.id}: door connects tuple must start with the room id`);
    const doorMidpoint = midpoint(door.from, door.to);
    const doorNode = nodesById.get(room.doorNodeId);
    if (distance(door.point, doorMidpoint) > 0.05) throw new Error(`${room.id}: door point must be the center of the door segment`);
    if (distance(doorNode.point, doorMidpoint) > 0.05) throw new Error(`${room.id}: door navigation node must sit on the door opening center`);
    if (!pointOnRoomBoundary(door.from, room) || !pointOnRoomBoundary(door.to, room) || !pointOnRoomBoundary(door.point, room)) {
      throw new Error(`${room.id}: door segment must lie on the room boundary`);
    }
  }

  const forbiddenDirectPublicLinks = [
    ["stair-public-2f", "door-104-2F01"],
    ["stair-public-2f", "door-106-2F"],
    ["stair-public-2f", "door-108-2F04"],
    ["stair-public-2f", "center-104-2F01"],
    ["stair-public-2f", "center-106-2F"],
    ["stair-public-2f", "center-108-2F04"],
  ];
  for (const [from, to] of forbiddenDirectPublicLinks) {
    if (edgeKeys.has(`${from}->${to}`) || edgeKeys.has(`${to}->${from}`)) {
      throw new Error(`Forbidden public stair link found: ${from} <-> ${to}`);
    }
  }

  const requiredSpaceKinds = ["corridor", "restroom", "service", "storage", "reserved", "stair", "room"];
  const spaceKinds = new Set(jingongMapData.spaces.map((space) => space.kind));
  for (const kind of requiredSpaceKinds) {
    if (!spaceKinds.has(kind)) throw new Error(`Missing mapped space kind: ${kind}`);
  }

  if (!jingongMapData.centerlines.some((segment) => segment.to === "c2-202" || segment.from === "c2-202")) {
    throw new Error("202 raised corridor centerline is not connected.");
  }

  const internalStairs = ["stair-104", "stair-106", "stair-108"];
  for (const stairId of internalStairs) {
    const stair = jingongMapData.stairs.find((candidate) => candidate.id === stairId);
    if (!stair || stair.access !== "internal") throw new Error(`Missing internal stair geometry: ${stairId}`);
    if (!nodesById.has(stair.lowerNodeId) || !nodesById.has(stair.upperNodeId)) throw new Error(`${stairId}: missing paired stair nodes`);
    const lowerNode = nodesById.get(stair.lowerNodeId);
    const upperNode = nodesById.get(stair.upperNodeId);
    if (lowerNode.floor !== stair.lowerFloor || upperNode.floor !== stair.upperFloor) throw new Error(`${stairId}: stair node floors do not match stair geometry`);
    if (distance(lowerNode.point, midpoint(stair.lowerLanding[0], stair.lowerLanding[2])) > 6) throw new Error(`${stairId}: lower stair node is not centered on its landing`);
    if (distance(upperNode.point, midpoint(stair.upperLanding[0], stair.upperLanding[2])) > 6) throw new Error(`${stairId}: upper stair node is not centered on its landing`);
  }

  const publicStair = jingongMapData.stairs.find((candidate) => candidate.id === "stair-public");
  if (!publicStair || publicStair.access !== "public") throw new Error("Missing public stair geometry.");
  for (const stair of jingongMapData.stairs) {
    const pairedEdge = edgeKeys.has(`${stair.lowerNodeId}->${stair.upperNodeId}`) || edgeKeys.has(`${stair.upperNodeId}->${stair.lowerNodeId}`);
    if (!pairedEdge) throw new Error(`${stair.id}: missing navigation edge between lower and upper landings`);
  }

  console.log(
    `Map data verified: ${roomIds.length} rooms, ${jingongMapData.doors.length} door segments, ${jingongMapData.spaces.length} spaces, ${jingongMapData.centerlines.length} centerlines.`,
  );
} finally {
  await server.close();
}
