import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/features/map/data/mapData.ts", import.meta.url), "utf8");

const roomIds = [...source.matchAll(/room\("([^"]+)"/g)].map((match) => match[1]);
const duplicates = roomIds.filter((id, index) => roomIds.indexOf(id) !== index);
if (duplicates.length > 0) {
  throw new Error(`Duplicate room ids: ${duplicates.join(", ")}`);
}

const required = ["101", "104-2F01", "106-2F", "108-2F04", "202-5"];
for (const id of required) {
  if (!roomIds.includes(id)) throw new Error(`Missing required room ${id}`);
}

const forbiddenDirectPublicLinks = [
  /edge\("stair-public-2f",\s*"door-104-2F01"/,
  /edge\("stair-public-2f",\s*"door-106-2F"/,
  /edge\("stair-public-2f",\s*"door-108-2F/,
];
for (const pattern of forbiddenDirectPublicLinks) {
  if (pattern.test(source)) {
    throw new Error(`Forbidden public stair link found: ${pattern}`);
  }
}

const internalStairRules = [
  "104 二层只能通过 104 内部楼梯到达",
  "106 二层只能通过 106 内部楼梯到达",
  "108 二层只能通过 108 内部楼梯到达",
];
for (const rule of internalStairRules) {
  if (!source.includes(rule)) throw new Error(`Missing internal stair rule: ${rule}`);
}

console.log(`Map data verified: ${roomIds.length} rooms, independent upper-floor rules present.`);
