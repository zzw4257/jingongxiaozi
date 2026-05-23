import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();

const distance2d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const midpoint = (from, to) => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
const bounds = (points) => {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { jingongMapData } = await server.ssrLoadModule("/src/features/map/data/mapData.ts");
  const { floorOffsetXZ, mapPointToModel, modelAlignment } = await server.ssrLoadModule("/src/features/map3d/modelAlignment.ts");
  const nodeById = new Map(jingongMapData.nodes.map((node) => [node.id, node]));
  const doorByNode = new Map(jingongMapData.doors.map((door) => [door.nodeId, door]));

  const floorReports = jingongMapData.floors.map((floor) => {
    const floorRooms = jingongMapData.rooms.filter((room) => room.floor === floor.id);
    const floorSpaces = jingongMapData.spaces.filter((space) => space.floor === floor.id);
    const corridorSpaces = floorSpaces.filter((space) => space.kind === "corridor");
    const floorBounds = bounds(floor.outline);
    const roomBounds = bounds(floorRooms.flatMap((room) => room.polygon));
    const corridorBounds = bounds(corridorSpaces.flatMap((space) => space.polygon));
    return {
      id: floor.id,
      outline: floorBounds,
      rooms: floorRooms.length,
      spaces: floorSpaces.length,
      corridorSpaces: corridorSpaces.length,
      roomCoverageBBox: roomBounds,
      corridorBBox: corridorBounds,
      corridorInsideOutline:
        corridorBounds.minX >= floorBounds.minX &&
        corridorBounds.maxX <= floorBounds.maxX &&
        corridorBounds.minY >= floorBounds.minY &&
        corridorBounds.maxY <= floorBounds.maxY,
    };
  });

  const stairReports = jingongMapData.stairs.map((stair) => {
    const lowerCenter = midpoint(stair.lowerLanding[0], stair.lowerLanding[2]);
    const upperCenter = midpoint(stair.upperLanding[0], stair.upperLanding[2]);
    const lowerSemanticId = `${stair.id}-lower`;
    const upperSemanticId = `${stair.id}-upper`;
    const lowerPhysical = mapPointToModel(lowerCenter, stair.lowerFloor, { layerMode: "allFloors", semanticId: lowerSemanticId });
    const upperPhysical = mapPointToModel(upperCenter, stair.upperFloor, { layerMode: "allFloors", semanticId: upperSemanticId });
    const lowerExploded = mapPointToModel(lowerCenter, stair.lowerFloor, { layerMode: "exploded", semanticId: lowerSemanticId });
    const upperExploded = mapPointToModel(upperCenter, stair.upperFloor, { layerMode: "exploded", semanticId: upperSemanticId });
    return {
      id: stair.id,
      label: stair.label,
      access: stair.access,
      ownerRoomId: stair.ownerRoomId ?? null,
      lowerNode: stair.lowerNodeId,
      upperNode: stair.upperNodeId,
      lowerCenter,
      upperCenter,
      pairedEdgeExists: jingongMapData.edges.some(
        (edge) =>
          (edge.from === stair.lowerNodeId && edge.to === stair.upperNodeId) ||
          (edge.from === stair.upperNodeId && edge.to === stair.lowerNodeId),
      ),
      planOffsetUnits: Number(distance2d(lowerCenter, upperCenter).toFixed(2)),
      physicalModelOffsetXZ: Number(Math.hypot(lowerPhysical[0] - upperPhysical[0], lowerPhysical[2] - upperPhysical[2]).toFixed(4)),
      physicalHeightDelta: Number((upperPhysical[1] - lowerPhysical[1]).toFixed(4)),
      explodedOffsetXZ: Number(Math.hypot(lowerExploded[0] - upperExploded[0], lowerExploded[2] - upperExploded[2]).toFixed(4)),
    };
  });

  const doorReports = jingongMapData.rooms.map((room) => {
    const door = doorByNode.get(room.doorNodeId);
    const node = nodeById.get(room.doorNodeId);
    return {
      roomId: room.id,
      roomNo: room.roomNo,
      floor: room.floor,
      doorNodeId: room.doorNodeId,
      source: door?.source ?? "missing",
      connectsTo: door?.connects[1] ?? null,
      nodeToDoorCenterError: door && node ? Number(distance2d(node.point, door.point).toFixed(4)) : null,
      doorWidth: door ? Number(door.width.toFixed(2)) : null,
    };
  });

  const centerlineReports = jingongMapData.centerlines.map((segment) => {
    const from = nodeById.get(segment.from);
    const to = nodeById.get(segment.to);
    return {
      id: segment.id,
      floor: segment.floor,
      kind: segment.kind,
      from: segment.from,
      to: segment.to,
      lengthUnits: from && to ? Number(distance2d(from.point, to.point).toFixed(2)) : null,
      source: segment.source,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      rooms: jingongMapData.rooms.length,
      spaces: jingongMapData.spaces.length,
      doors: jingongMapData.doors.length,
      stairs: jingongMapData.stairs.length,
      centerlines: jingongMapData.centerlines.length,
      defaultLayerMode: "allFloors",
      physicalFloorOffsetXZ1F: floorOffsetXZ("1F", { layerMode: "allFloors" }),
      physicalFloorOffsetXZ2F: floorOffsetXZ("2F", { layerMode: "allFloors" }),
      explodedFloorOffsetXZ1F: floorOffsetXZ("1F", { layerMode: "exploded" }),
      explodedFloorOffsetXZ2F: floorOffsetXZ("2F", { layerMode: "exploded" }),
      explodedModeHasVisualOffset: floorOffsetXZ("1F", { layerMode: "exploded" }).join(",") !== floorOffsetXZ("2F", { layerMode: "exploded" }).join(","),
      floorHeight: modelAlignment.floorHeight,
    },
    floors: floorReports,
    stairs: stairReports,
    doors: doorReports,
    centerlines: centerlineReports,
  };

  const outDir = path.join(root, "qa", "alignment");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "latest-map-qa-report.json"), JSON.stringify(report, null, 2));
  console.log(
    `Map QA report generated: ${report.summary.rooms} rooms, ${report.summary.doors} doors, ${report.summary.stairs} stairs, ${report.summary.centerlines} centerlines.`,
  );
} finally {
  await server.close();
}
