import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "public", "map-models", "model-manifest.json");
const primaryGlb = path.join(root, "public", "map-models", "jingong.glb");
const fallbackGlb = path.join(root, "public", "map-models", "jingong-fallback.glb");

for (const file of [manifestPath, primaryGlb, fallbackGlb]) {
  if (!existsSync(file)) throw new Error(`Missing model asset: ${path.relative(root, file)}`);
  if (statSync(file).size < 1024) throw new Error(`Model asset is too small: ${path.relative(root, file)}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const primary = manifest.runtime?.primary;
const fallback = manifest.runtime?.fallback;
if (!primary?.present || !fallback?.present) throw new Error("Manifest does not mark both runtime models as present.");
if ((primary.info?.meshes ?? 0) < 1 || (primary.info?.vertices ?? 0) < 100) {
  throw new Error("Primary 3D model manifest lacks usable mesh/vertex counts.");
}
if ((fallback.info?.meshes ?? 0) < 1 || (fallback.info?.vertices ?? 0) < 100) {
  throw new Error("Fallback 3D model manifest lacks usable mesh/vertex counts.");
}

console.log(
  `Model assets verified: primary ${primary.info.meshes} meshes / ${primary.info.vertices} vertices, fallback ${fallback.info.meshes} mesh / ${fallback.info.vertices} vertices.`,
);
