import { execFileSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const modelDir = path.join(root, "models");
const publicDir = path.join(root, "public", "map-models");

const sources = {
  primary3ds: path.join(modelDir, "金工中心模型.3ds"),
  fallbackStl: path.join(modelDir, "金工中心精确模型.stl"),
  calibrationDwg: path.join(modelDir, "金工.dwg"),
  sketchup: path.join(modelDir, "金工.skp"),
};

const runtime = {
  primaryGlb: path.join(publicDir, "jingong.glb"),
  fallbackGlb: path.join(publicDir, "jingong-fallback.glb"),
};

function assimpInfo(file) {
  const output = execFileSync("assimp", ["info", file], { encoding: "utf8" });
  const number = (label) => {
    const match = output.match(new RegExp(`${label}:\\s+([\\d.-]+)`));
    return match ? Number(match[1]) : undefined;
  };
  const point = (label) => {
    const match = output.match(new RegExp(`${label}\\s+\\(([-\\d.]+)\\s+([-\d.]+)\\s+([-\d.]+)\\)`));
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
  };
  return {
    nodes: number("Nodes"),
    meshes: number("Meshes"),
    materials: number("Materials"),
    vertices: number("Vertices"),
    faces: number("Faces"),
    minPoint: point("Minimum point"),
    maxPoint: point("Maximum point"),
    centerPoint: point("Center point"),
  };
}

function fileInfo(file) {
  return {
    path: path.relative(root, file),
    present: existsSync(file),
    bytes: existsSync(file) ? statSync(file).size : 0,
  };
}

const manifest = {
  generatedAt: new Date().toISOString(),
  runtime: {
    primary: {
      ...fileInfo(runtime.primaryGlb),
      source: path.relative(root, sources.primary3ds),
      format: "glb2",
      role: "visual-model",
      info: assimpInfo(sources.primary3ds),
    },
    fallback: {
      ...fileInfo(runtime.fallbackGlb),
      source: path.relative(root, sources.fallbackStl),
      format: "glb2",
      role: "low-fidelity-geometry",
      info: assimpInfo(sources.fallbackStl),
    },
  },
  calibrationSources: {
    dwg: fileInfo(sources.calibrationDwg),
    sketchup: fileInfo(sources.sketchup),
  },
  transforms: {
    note: "Map3D uses modelAlignment.ts for runtime centering, scaling, axis correction, and semantic overlay alignment.",
    unit: "source-model-units",
    upAxis: "auto-corrected-to-y-up-in-runtime",
  },
};

writeFileSync(path.join(publicDir, "model-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, path.join(publicDir, "model-manifest.json"))}`);
