import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "miniprogram/miniprogram/packages/map/map-models/jingong.glb");
const outputPath = path.join(root, "miniprogram/miniprogram/packages/map/map-models/jingong-glb-data.js");

function align4(value) {
  return (value + 3) & ~3;
}

function readChunks(buffer) {
  if (buffer.slice(0, 4).toString("utf8") !== "glTF") {
    throw new Error("Input is not a GLB file");
  }
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error(`Unsupported GLB version: ${version}`);
  const chunks = [];
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString("utf8");
    const data = buffer.slice(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 8 + length;
  }
  return chunks;
}

function stripExternalTextures(gltf) {
  const textureKeys = new Set([
    "baseColorTexture",
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
    "specularColorTexture",
    "specularTexture",
    "thicknessTexture",
  ]);
  for (const material of gltf.materials || []) {
    for (const key of textureKeys) {
      delete material[key];
    }
    if (material.pbrMetallicRoughness) {
      for (const key of textureKeys) delete material.pbrMetallicRoughness[key];
    }
    for (const extension of Object.values(material.extensions || {})) {
      if (!extension || typeof extension !== "object") continue;
      for (const key of textureKeys) delete extension[key];
    }
  }
  delete gltf.textures;
  delete gltf.images;
  delete gltf.samplers;
  gltf.extensionsUsed = (gltf.extensionsUsed || []).filter((name) => name !== "KHR_texture_transform");
  gltf.extensionsRequired = (gltf.extensionsRequired || []).filter((name) => name !== "KHR_texture_transform");
  if (!gltf.extensionsUsed.length) delete gltf.extensionsUsed;
  if (!gltf.extensionsRequired.length) delete gltf.extensionsRequired;
  return gltf;
}

function chunk(type, data, padByte) {
  const paddedLength = align4(data.length);
  const out = Buffer.alloc(8 + paddedLength, padByte);
  out.writeUInt32LE(data.length, 0);
  out.write(type, 4, 4, "utf8");
  data.copy(out, 8);
  return out;
}

const source = fs.readFileSync(inputPath);
const chunks = readChunks(source);
const jsonChunk = chunks.find((item) => item.type === "JSON");
const binChunk = chunks.find((item) => item.type === "BIN\u0000");
if (!jsonChunk || !binChunk) throw new Error("GLB must contain JSON and BIN chunks");

const gltf = stripExternalTextures(JSON.parse(jsonChunk.data.toString("utf8").trim()));
const json = Buffer.from(JSON.stringify(gltf), "utf8");
const jsonChunkOut = chunk("JSON", json, 0x20);
const binChunkOut = chunk("BIN\u0000", binChunk.data, 0x00);
const totalLength = 12 + jsonChunkOut.length + binChunkOut.length;
const glb = Buffer.alloc(totalLength);
glb.write("glTF", 0, 4, "utf8");
glb.writeUInt32LE(2, 4);
glb.writeUInt32LE(totalLength, 8);
jsonChunkOut.copy(glb, 12);
binChunkOut.copy(glb, 12 + jsonChunkOut.length);

const base64 = glb.toString("base64");
const lines = base64.match(/.{1,120}/g) || [];
const content = [
  "// Generated from textureless jingong.glb for WeChat package runtime loading.",
  "// Run `npm run build:miniprogram:glb` after replacing the source GLB.",
  "module.exports = {",
  `  byteLength: ${glb.length},`,
  "  textureless: true,",
  "  base64: [",
  ...lines.map((line) => `    '${line}',`),
  "  ].join('')",
  "};",
  "",
].join("\n");

fs.writeFileSync(outputPath, content);
console.log(`Generated ${path.relative(root, outputPath)} (${Math.round(glb.length / 1024)} KiB GLB, ${Math.round(Buffer.byteLength(content) / 1024)} KiB JS)`);
