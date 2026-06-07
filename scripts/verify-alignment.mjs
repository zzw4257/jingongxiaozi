import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const manifestPath = path.join(root, "public", "map-models", "model-manifest.json");
const primaryGlb = path.join(root, "public", "map-models", "jingong.glb");
const fallbackGlb = path.join(root, "public", "map-models", "jingong-fallback.glb");

for (const file of [manifestPath, primaryGlb, fallbackGlb]) {
  if (!existsSync(file)) throw new Error(`Missing model calibration asset: ${path.relative(root, file)}`);
  if (statSync(file).size < 1024) throw new Error(`Model calibration asset is too small: ${path.relative(root, file)}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!manifest.runtime?.primary?.present || !manifest.runtime?.fallback?.present) {
  throw new Error("Model manifest must mark both primary and fallback runtime models as present.");
}

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { jingongMapData } = await server.ssrLoadModule("/src/features/map/data/mapData.ts");
  const { floorOffsetXZ, mapPointToModel, modelAlignment } = await server.ssrLoadModule("/src/features/map3d/modelAlignment.ts");
  const calibration = jingongMapData.calibration;
  if (!calibration) throw new Error("Missing model calibration data.");

  const controlPoints = calibration.controlPoints ?? [];
  const floorCounts = new Map();
  for (const point of controlPoints) floorCounts.set(point.floor, (floorCounts.get(point.floor) ?? 0) + 1);
  for (const floor of ["1F", "2F"]) {
    if ((floorCounts.get(floor) ?? 0) < 8) throw new Error(`Calibration must include at least 8 control points on ${floor}.`);
  }

  const scaleDelta = Math.abs(calibration.modelScale - modelAlignment.modelScale);
  const centerDelta = Math.hypot(
    calibration.mapCenter[0] - modelAlignment.mapCenter[0],
    calibration.mapCenter[1] - modelAlignment.mapCenter[1],
  );
  if (scaleDelta > 1e-8 || centerDelta > 0.001) {
    throw new Error("Calibration map transform and runtime modelAlignment transform have diverged.");
  }

  const errors = controlPoints.map((point) => {
    const projected = mapPointToModel(point.mapPoint, point.floor, { layerMode: "allFloors" });
    return Math.hypot(projected[0] - point.modelPoint[0], projected[1] - point.modelPoint[1], projected[2] - point.modelPoint[2]);
  });
  const maxError = Math.max(...errors);
  const averageError = errors.reduce((sum, item) => sum + item, 0) / errors.length;
  if (maxError > 0.5) throw new Error(`Control-point max error too high: ${maxError.toFixed(3)}`);
  if (averageError > 0.18) throw new Error(`Control-point average error too high: ${averageError.toFixed(3)}`);
  if (calibration.maxError > 0.5 || calibration.averageError > 0.18) {
    throw new Error(`Declared calibration error exceeds gate: max=${calibration.maxError}, avg=${calibration.averageError}`);
  }

  const rawSize = calibration.runtimeFit?.rawBBoxSize;
  const centeredScale = calibration.runtimeFit?.centeredScale;
  if (!rawSize || rawSize.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Runtime model bbox size is missing or invalid.");
  }
  const manifestRuntimeInfo = manifest.runtime?.primary?.runtimeInfo;
  if (!manifestRuntimeInfo?.bboxSize || !manifestRuntimeInfo?.runtimeCenteredScale) {
    throw new Error("Model manifest must include primary GLB runtime bbox and centered scale.");
  }
  const bboxDelta = Math.max(...rawSize.map((value, index) => Math.abs(value - manifestRuntimeInfo.bboxSize[index])));
  if (bboxDelta > 0.1) {
    throw new Error(`Calibration runtime bbox diverges from GLB manifest by ${bboxDelta.toFixed(3)} model units.`);
  }
  const expectedScale = 8.6 / Math.max(...rawSize);
  if (Math.abs(expectedScale - centeredScale) > expectedScale * 0.001) {
    throw new Error("Runtime bbox centeredScale does not match the recorded model bbox.");
  }
  if (Math.abs(manifestRuntimeInfo.runtimeCenteredScale - centeredScale) > expectedScale * 0.001) {
    throw new Error("Calibration centeredScale diverges from GLB manifest runtime scale.");
  }

  const allFloorsOffset1 = floorOffsetXZ("1F", { layerMode: "allFloors" });
  const allFloorsOffset2 = floorOffsetXZ("2F", { layerMode: "allFloors" });
  const physicalOffsetDelta = Math.hypot(allFloorsOffset1[0] - allFloorsOffset2[0], allFloorsOffset1[1] - allFloorsOffset2[1]);
  if (physicalOffsetDelta > 0.0001) {
    throw new Error("allFloors mode must keep 1F/2F physically aligned in XZ.");
  }
  const explodedOffset1 = floorOffsetXZ("1F", { layerMode: "exploded" });
  const explodedOffset2 = floorOffsetXZ("2F", { layerMode: "exploded" });
  const explodedDelta = Math.hypot(explodedOffset1[0] - explodedOffset2[0], explodedOffset1[1] - explodedOffset2[1]);
  if (explodedDelta < 0.4) {
    throw new Error("exploded mode must visibly separate floors from physical alignment.");
  }

  const doorCountBySource = jingongMapData.doors.reduce((counts, door) => {
    counts[door.source] = (counts[door.source] ?? 0) + 1;
    return counts;
  }, {});
  if (jingongMapData.doors.length < jingongMapData.rooms.length) throw new Error("Every room must expose at least one semantic doorway.");
  if (!doorCountBySource.reference || !doorCountBySource.inferred) {
    throw new Error("Doorway mapping must preserve both reference/cad-backed and inferred sources for audit.");
  }

  const roomBBox = (rooms) => {
    const points = rooms.flatMap((room) => room.polygon);
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };
  for (const floor of jingongMapData.floors) {
    const rooms = jingongMapData.rooms.filter((room) => room.floor === floor.id);
    const bbox = roomBBox(rooms);
    const outlineXs = floor.outline.map((point) => point[0]);
    const outlineYs = floor.outline.map((point) => point[1]);
    const tolerance = 36;
    if (
      bbox.minX < Math.min(...outlineXs) - tolerance ||
      bbox.maxX > Math.max(...outlineXs) + tolerance ||
      bbox.minY < Math.min(...outlineYs) - tolerance ||
      bbox.maxY > Math.max(...outlineYs) + tolerance
    ) {
      throw new Error(`${floor.id}: semantic room bbox exceeds floor outline tolerance.`);
    }
  }

  const midpoint = (from, to) => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  for (const stair of jingongMapData.stairs) {
    const lowerCenter = midpoint(stair.lowerLanding[0], stair.lowerLanding[2]);
    const upperCenter = midpoint(stair.upperLanding[0], stair.upperLanding[2]);
    const lower = mapPointToModel(lowerCenter, stair.lowerFloor, { layerMode: "allFloors", semanticId: `${stair.id}-lower` });
    const upper = mapPointToModel(upperCenter, stair.upperFloor, { layerMode: "allFloors", semanticId: `${stair.id}-upper` });
    const xzDelta = Math.hypot(lower[0] - upper[0], lower[2] - upper[2]);
    if (xzDelta > 0.08) {
      throw new Error(`${stair.id}: paired stair landings are not physically aligned in allFloors mode (${xzDelta.toFixed(3)}).`);
    }
    const explodedLower = mapPointToModel(lowerCenter, stair.lowerFloor, { layerMode: "exploded", semanticId: `${stair.id}-lower` });
    const explodedUpper = mapPointToModel(upperCenter, stair.upperFloor, { layerMode: "exploded", semanticId: `${stair.id}-upper` });
    const explodedXzDelta = Math.hypot(explodedLower[0] - explodedUpper[0], explodedLower[2] - explodedUpper[2]);
    if (explodedXzDelta < 0.35) {
      throw new Error(`${stair.id}: exploded mode should visibly separate paired stair landings.`);
    }
  }

  console.log(
    `Alignment verified: ${controlPoints.length} control points, max error ${maxError.toFixed(3)}, avg error ${averageError.toFixed(3)}, ${jingongMapData.doors.length} doorways.`,
  );

  const reportDir = path.join(root, "qa", "alignment");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, "latest-alignment-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: {
          primary: manifest.runtime.primary,
          fallback: manifest.runtime.fallback,
          runtimeFit: calibration.runtimeFit,
        },
        calibration: {
          sourcePriority: calibration.sourcePriority,
          controlPointCount: controlPoints.length,
          floorCounts: Object.fromEntries(floorCounts),
          maxError,
          averageError,
          declaredMaxError: calibration.maxError,
          declaredAverageError: calibration.averageError,
          allFloorsOffset1,
          allFloorsOffset2,
          explodedOffset1,
          explodedOffset2,
          note: calibration.note,
        },
        doorways: {
          total: jingongMapData.doors.length,
          bySource: doorCountBySource,
        },
        spaces: {
          total: jingongMapData.spaces.length,
          byKind: jingongMapData.spaces.reduce((counts, space) => {
            counts[space.kind] = (counts[space.kind] ?? 0) + 1;
            return counts;
          }, {}),
        },
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
