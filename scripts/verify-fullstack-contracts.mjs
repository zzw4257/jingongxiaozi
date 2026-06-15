import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  throw new Error(message);
};
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const json = (relativePath) => JSON.parse(read(relativePath));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const gitDuplex = (...args) => execFileSync("git", args, { cwd: path.join(root, "vendor/DuplexKit"), encoding: "utf8" }).trim();

const packageJson = json("package.json");
const backendLock = json("docs/backend-duplexkit-version.json");
for (const scriptName of ["check:duplex", "check:backend", "check:fullstack", "check:fullstack:release", "check:miniprogram", "check:miniprogram:release"]) {
  if (!packageJson.scripts?.[scriptName]) fail(`package.json missing release script: ${scriptName}`);
}
if (!packageJson.scripts["check:fullstack"].includes("check:backend")) {
  fail("check:fullstack must include backend verification");
}
if (!packageJson.scripts["check:fullstack:release"].includes("check:miniprogram:release")) {
  fail("check:fullstack:release must include miniprogram release verification");
}

const duplexRemote = gitDuplex("remote", "get-url", "origin");
if (duplexRemote !== "https://github.com/ElysiaFollower/DuplexKit.git") {
  fail(`DuplexKit origin drifted: ${duplexRemote}`);
}
const duplexHead = gitDuplex("rev-parse", "HEAD");
const duplexUpstream = gitDuplex("rev-parse", "@{u}");
if (backendLock.remote !== duplexRemote) {
  fail(`DuplexKit version lock remote mismatch: lock=${backendLock.remote} actual=${duplexRemote}`);
}
if (backendLock.branch !== "main") {
  fail(`DuplexKit version lock must target main, got ${backendLock.branch}`);
}
if (backendLock.commit !== duplexHead) {
  fail(`DuplexKit version lock mismatch: lock=${backendLock.commit} actual=${duplexHead}`);
}
if (duplexHead !== duplexUpstream) {
  fail(`DuplexKit is not at upstream HEAD: local=${duplexHead} upstream=${duplexUpstream}`);
}

const protocol = read("vendor/DuplexKit/src/protocol.ts");
for (const tool of ["map.open", "map.close", "map.set_origin", "map.set_destination", "navigation.start", "navigation.next", "navigation.previous", "navigation.status"]) {
  if (!protocol.includes(`"${tool}"`)) fail(`DuplexKit protocol missing tool: ${tool}`);
}
for (const token of ["navigation_progress", "guidance", "heading", "remainingMeters", "remainingSeconds", "current", "next", "destination"]) {
  if (!protocol.includes(token)) fail(`DuplexKit protocol missing navigation fact: ${token}`);
}

const server = read("vendor/DuplexKit/src/server.ts");
for (const endpoint of ["/api/tools", "/api/jingong-rooms", "/api/runtime-settings"]) {
  if (!server.includes(endpoint)) fail(`DuplexKit server missing endpoint: ${endpoint}`);
}

const bridge = read("miniprogram/miniprogram/packages/map/lib/backend-bridge.js");
for (const required of ["map.open", "navigation.start", "navigation.next", "navigation.previous", "navigation.status", "/api/realtime", "/api/tools", "navigation_progress", "tool_result"]) {
  if (!bridge.includes(required)) fail(`mini program backend bridge missing contract token: ${required}`);
}

const appJson = read("miniprogram/miniprogram/app.json");
const projectConfig = read("miniprogram/project.config.json");
for (const source of [
  ["miniprogram app.json", appJson],
  ["miniprogram project.config.json", projectConfig],
  ["miniprogram backend bridge", bridge],
]) {
  for (const forbidden of ["web-view", "127.0.0.1:5173", "localhost:5173", "mapImageSrc", "miniprogram-map-"]) {
    if (source[1].includes(forbidden)) fail(`${source[0]} must not contain ${forbidden}`);
  }
}

const summary = {
  duplexRemote,
  duplexHead,
  backendLock: backendLock.commit,
  backendVersionLocked: backendLock.commit === duplexHead,
  checkedScripts: ["check:duplex", "check:backend", "check:fullstack", "check:fullstack:release"],
  checkedTools: ["map.open", "navigation.start", "navigation.next", "navigation.previous", "navigation.status"],
};
console.log(JSON.stringify(summary, null, 2));
