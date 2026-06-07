import { createServer } from "vite";
import fs from "node:fs";

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const polygonArea = (polygon) => {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
};

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

const pointOnSegment = (point, from, to, tolerance = 0.8) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 0.0001) return distance(point, from) <= tolerance;
  const t = ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / lengthSq;
  if (t < -0.01 || t > 1.01) return false;
  const projected = [from[0] + dx * t, from[1] + dy * t];
  return distance(point, projected) <= tolerance;
};

const pointOnPolygonBoundary = (point, polygon, tolerance = 0.8) =>
  polygon.some((from, index) => pointOnSegment(point, from, polygon[(index + 1) % polygon.length], tolerance));

const pointInsidePolygon = (point, polygon) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const last = polygon[previous];
    const crosses =
      current[1] > point[1] !== last[1] > point[1] &&
      point[0] < ((last[0] - current[0]) * (point[1] - current[1])) / (last[1] - current[1]) + current[0];
    if (crosses) inside = !inside;
  }
  return inside;
};

const pointInsideOrOnPolygon = (point, polygon, tolerance = 0.8) =>
  pointInsidePolygon(point, polygon) || pointOnPolygonBoundary(point, polygon, tolerance);

const midpoint = (from, to) => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];

const wallMatchesClosedSource = (wall, data) => {
  if (wall.id.startsWith(`outer-${wall.floor.toLowerCase()}`)) {
    const floor = data.floors.find((candidate) => candidate.id === wall.floor);
    return Boolean(floor && pointOnPolygonBoundary(wall.from, floor.outline, 0.05) && pointOnPolygonBoundary(wall.to, floor.outline, 0.05));
  }
  const stairMatch = wall.id.match(/^wall-(stair-[^-]+)(?:-(lower|upper))?-\d+$/);
  if (stairMatch) {
    const stair = data.stairs.find((candidate) => candidate.id === stairMatch[1]);
    if (!stair) return false;
    const polygon = stairMatch[2] === "upper" ? stair.upperLanding : stair.lowerLanding;
    return pointOnPolygonBoundary(wall.from, polygon, 0.05) && pointOnPolygonBoundary(wall.to, polygon, 0.05);
  }
  const roomMatch = wall.id.match(/^wall-(.+)-\d+$/);
  if (roomMatch) {
    const room = data.rooms.find((candidate) => candidate.id === roomMatch[1]);
    return Boolean(room && pointOnPolygonBoundary(wall.from, room.polygon, 0.05) && pointOnPolygonBoundary(wall.to, room.polygon, 0.05));
  }
  return false;
};

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const renderer = fs.readFileSync(new URL("../src/features/map3d/Map3DApp.tsx", import.meta.url), "utf8");
  for (const token of ["closedSpaces", "boundaryRole", "support", "stairPortals"]) {
    if (!renderer.includes(token) && token !== "stairPortals") {
      throw new Error(`Map renderer must use closed-space product geometry token: ${token}`);
    }
  }
  if (/visibleSupportDecksForSession\(session\)\)\s*\{[\s\S]*supportDeckGeometry/.test(renderer)) {
    throw new Error("Product renderer must not use legacy scattered supportDeckGeometry as a visible source.");
  }

  const { jingongMapData } = await server.ssrLoadModule("/src/features/map/data/mapData.ts");
  const data = jingongMapData;
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const roomById = new Map(data.rooms.map((room) => [room.id, room]));
  const spaceById = new Map(data.spaces.map((space) => [space.id, space]));
  const closedById = new Map(data.closedSpaces.map((space) => [space.id, space]));
  const edgeKeys = new Set(data.edges.map((edge) => `${edge.from}->${edge.to}`));

  if (data.closedSpaces.length !== data.spaces.length) {
    throw new Error(`closedSpaces must mirror spaces exactly (${data.closedSpaces.length} !== ${data.spaces.length}).`);
  }
  if (closedById.size !== data.closedSpaces.length) throw new Error("closedSpaces contains duplicate ids.");

  for (const floor of data.floors) {
    if (floor.outline.length < 3) throw new Error(`${floor.id}: floor outline must have at least 3 points.`);
    if (Math.abs(polygonArea(floor.outline)) < 1) throw new Error(`${floor.id}: floor outline area is zero.`);
    floor.outline.forEach((point, index) => {
      if (distance(point, floor.outline[(index + 1) % floor.outline.length]) < 0.05) {
        throw new Error(`${floor.id}: adjacent duplicate outline point at index ${index}.`);
      }
    });
  }

  const requiredSpaceKinds = ["room", "corridor", "stair", "restroom", "service", "storage", "reserved"];
  for (const kind of requiredSpaceKinds) {
    if (!data.closedSpaces.some((space) => space.kind === kind)) throw new Error(`Missing closed space kind: ${kind}`);
  }
  if (!data.closedSpaces.some((space) => space.kind === "support" && space.id === "support-202-lower")) {
    throw new Error("202 raised platform must have a classified lower support/projection space.");
  }

  for (const space of data.closedSpaces) {
    if (space.polygon.length < 3) throw new Error(`${space.id}: polygon must have at least 3 points.`);
    if (Math.abs(polygonArea(space.polygon)) < 1) throw new Error(`${space.id}: polygon area is zero.`);
    if (!space.boundaryRole || !space.elevationKind || !space.semanticId) {
      throw new Error(`${space.id}: closed space must declare boundaryRole/elevationKind/semanticId.`);
    }
    space.polygon.forEach((point, index) => {
      const next = space.polygon[(index + 1) % space.polygon.length];
      if (distance(point, next) < 0.05) throw new Error(`${space.id}: adjacent duplicate polygon point at index ${index}.`);
    });
    const floor = data.floors.find((candidate) => candidate.id === space.floor);
    if (!floor) throw new Error(`${space.id}: references missing floor ${space.floor}.`);
    const outside = space.polygon.filter((point) => !pointInsideOrOnPolygon(point, floor.outline, 1.2));
    if (outside.length > 0) {
      throw new Error(`${space.id}: polygon point escapes its closed floor outline: ${JSON.stringify(outside[0])}.`);
    }
  }

  for (const room of data.rooms) {
    const roomSpace = spaceById.get(`space-${room.id}`);
    const closedRoomSpace = closedById.get(`space-${room.id}`);
    if (!roomSpace || !closedRoomSpace) throw new Error(`${room.id}: missing closed room space.`);
    if (closedRoomSpace.kind !== "room" || closedRoomSpace.boundaryRole !== "room") {
      throw new Error(`${room.id}: room space must stay classified as room.`);
    }
  }

  for (const door of data.doors) {
    const room = roomById.get(door.connects[0]);
    if (!room) throw new Error(`${door.id}: first connects entry must be a room id.`);
    const connector = nodeById.get(door.connects[1]);
    if (!connector) throw new Error(`${door.id}: second connects entry must be a valid navigation node.`);
    if (connector.floor !== door.floor) throw new Error(`${door.id}: door connector node must be on the same floor.`);
    if (!spaceById.has(`space-${room.id}`)) throw new Error(`${door.id}: room side has no closed room space.`);
    const doorCenter = midpoint(door.from, door.to);
    if (distance(door.point, doorCenter) > 0.05) throw new Error(`${door.id}: point must be the segment midpoint.`);
    if (!pointOnPolygonBoundary(door.from, room.polygon) || !pointOnPolygonBoundary(door.to, room.polygon) || !pointOnPolygonBoundary(door.point, room.polygon)) {
      throw new Error(`${door.id}: door must lie on its room boundary.`);
    }
    const normalDot = (connector.point[0] - door.point[0]) * door.normal[0] + (connector.point[1] - door.point[1]) * door.normal[1];
    if (normalDot < -0.01) {
      throw new Error(`${door.id}: door normal points away from its connected corridor/stair node.`);
    }
    const adjacency = data.spaceAdjacency.find((item) => item.viaDoorId === door.id);
    if (!adjacency) throw new Error(`${door.id}: missing door adjacency record.`);
  }

  for (const wall of data.walls) {
    if (!wallMatchesClosedSource(wall, data)) throw new Error(`${wall.id}: wall is not generated from a closed floor/room/stair boundary.`);
  }

  for (const stair of data.stairs) {
    const lowerSpaceId = `${stair.id}-lower-space`;
    const upperSpaceId = `${stair.id}-upper-space`;
    const lowerSpace = spaceById.get(lowerSpaceId);
    const upperSpace = spaceById.get(upperSpaceId);
    if (!lowerSpace || !upperSpace) throw new Error(`${stair.id}: missing lower/upper closed stair landing space.`);
    if (lowerSpace.kind !== "stair" || upperSpace.kind !== "stair") throw new Error(`${stair.id}: landing spaces must be classified as stair.`);
    if (!nodeById.has(stair.lowerNodeId) || !nodeById.has(stair.upperNodeId)) throw new Error(`${stair.id}: missing lower/upper stair node.`);
    if (!edgeKeys.has(`${stair.lowerNodeId}->${stair.upperNodeId}`) && !edgeKeys.has(`${stair.upperNodeId}->${stair.lowerNodeId}`)) {
      throw new Error(`${stair.id}: missing paired route edge between landings.`);
    }
    const portal = data.stairPortals.find((candidate) => candidate.stairId === stair.id);
    if (!portal || portal.lowerSpaceId !== lowerSpaceId || portal.upperSpaceId !== upperSpaceId) {
      throw new Error(`${stair.id}: missing or invalid stair portal record.`);
    }
  }

  const floorSummary = Object.fromEntries(
    data.floors.map((floor) => {
      const spaces = data.closedSpaces.filter((space) => space.floor === floor.id);
      return [
        floor.id,
        {
          spaces: spaces.length,
          kinds: spaces.reduce((counts, space) => {
            counts[space.kind] = (counts[space.kind] ?? 0) + 1;
            return counts;
          }, {}),
          bounds: polygonBounds(spaces.flatMap((space) => space.polygon)),
        },
      ];
    }),
  );

  console.log(
    `Closed geometry verified: ${data.closedSpaces.length} spaces, ${data.doors.length} valid doors, ${data.stairPortals.length} stair portals, floors=${JSON.stringify(floorSummary)}.`,
  );
} finally {
  await server.close();
}
