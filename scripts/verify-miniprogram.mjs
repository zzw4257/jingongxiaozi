import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const releaseMode = process.argv.includes("--release") || process.env.MINIPROGRAM_RELEASE_CHECK === "1";
const requiredFiles = [
  "miniprogram/project.config.json",
  "miniprogram/miniprogram/app.json",
  "miniprogram/miniprogram/app.js",
  "miniprogram/miniprogram/pages/home/home.json",
  "miniprogram/miniprogram/pages/home/home.wxml",
  "miniprogram/miniprogram/pages/home/home.js",
  "miniprogram/miniprogram/pages/map/map.json",
  "miniprogram/miniprogram/pages/map/map.wxml",
  "miniprogram/miniprogram/pages/map/map.js",
  "miniprogram/miniprogram/pages/map/map.wxss",
  "miniprogram/miniprogram/data/map-data.js",
  "miniprogram/miniprogram/pages/chat/chat.json",
  "miniprogram/miniprogram/pages/chat/chat.wxml",
  "miniprogram/miniprogram/pages/chat/chat.js",
  "miniprogram/miniprogram/pages/chat/chat.wxss",
  "miniprogram/miniprogram/pages/expert/expert.json",
  "miniprogram/miniprogram/pages/expert/expert.wxml",
  "miniprogram/miniprogram/pages/expert/expert.js",
  "miniprogram/miniprogram/pages/expert/expert.wxss",
  "miniprogram/miniprogram/assets/ui/robot-standby.png",
  "miniprogram/miniprogram/assets/ui/robot-speaking.png",
  "miniprogram/miniprogram/assets/ui/robot-expert.png",
  "miniprogram/miniprogram/assets/ui/route-stairs.png",
  "miniprogram/miniprogram/assets/ui/map-layered.png",
  "miniprogram/miniprogram/assets/ui/map-building-pin.png",
  "src/shared/miniProgramBridge.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required miniprogram file: ${file}`);
  }
}

const projectConfig = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/project.config.json"), "utf8"));
if (projectConfig.miniprogramRoot !== "miniprogram/") {
  throw new Error("project.config.json miniprogramRoot must be miniprogram/");
}
if (releaseMode && (!projectConfig.appid || projectConfig.appid === "touristappid")) {
  throw new Error("release check requires a real WeChat AppID in miniprogram/project.config.json");
}

const appJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/app.js"), "utf8");
if (appJs.includes("webBaseUrl") || appJs.includes("127.0.0.1") || appJs.includes("localhost")) {
  throw new Error("mini program must be self-contained and must not depend on a local H5 service");
}

const appJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/miniprogram/app.json"), "utf8"));
const pages = new Set(appJson.pages || []);
for (const page of ["pages/home/home", "pages/map/map", "pages/chat/chat", "pages/expert/expert"]) {
  if (!pages.has(page)) throw new Error(`app.json does not declare page: ${page}`);
}
if (appJson.window?.navigationStyle !== "custom") {
  throw new Error("app.json must use custom navigation style");
}
if (appJson.window?.pageOrientation !== "landscape") {
  throw new Error("app.json must default to landscape");
}

const homeJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.json"), "utf8"));
if (homeJson.navigationStyle !== "custom") {
  throw new Error("home.json must use custom navigation style");
}
if (homeJson.pageOrientation !== "landscape") {
  throw new Error("home.json must default to landscape");
}

const webMapJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.json"), "utf8"));
if (webMapJson.navigationStyle !== "custom") {
  throw new Error("map.json must use custom navigation style");
}
if (webMapJson.pageOrientation !== "landscape") {
  throw new Error("map.json must default to landscape");
}

const home = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.js"), "utf8");
for (const token of ["source: \"miniprogram\"", "ui: \"mobile\"", "targetRoomId", "announce", "104-2F01", "202-5", "108-2F04"]) {
  if (!home.includes(token)) {
    throw new Error(`home.js must include synchronized token: ${token}`);
  }
}
if (!home.includes("mapDirects")) {
  throw new Error("home.js must pass MapDirect query parameters to the native map page");
}
for (const token of ["primaryMapDirects", "secondaryMapDirects", "showAppDrawer", "showMoreRoutes", "buildMapQuery", "wx.reLaunch", "navigating"]) {
  if (!home.includes(token)) {
    throw new Error(`home.js must keep landscape route grouping: ${token}`);
  }
}
if (home.includes("webBaseUrl") || home.includes("127.0.0.1") || home.includes("localhost") || home.includes("src=")) {
  throw new Error("home.js must not route through web-view/local H5 URLs");
}

const homeWxml = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.wxml"), "utf8");
for (const token of ["robot-standby.png", "robot-speaking.png", "robot-expert.png", "map-fab", "drawer-handle", "app-drawer", "primaryMapDirects", "secondaryMapDirects", "showMoreRoutes", "快速路线", "openChat", "openExpert"]) {
  if (!homeWxml.includes(token)) {
    throw new Error(`home.wxml must keep landscape route grouping: ${token}`);
  }
}
if (homeWxml.includes("WebView") || homeWxml.includes("业务域名") || homeWxml.includes("地图服务未连接")) {
  throw new Error("home.wxml must not expose web-service fallback UI");
}

const homeWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.wxss"), "utf8");
for (const token of ["height: 100vh", ".robot-expression-image", ".map-fab", ".drawer-handle", ".app-drawer", ".route-grid", "@media (orientation: portrait)"]) {
  if (!homeWxss.includes(token)) {
    throw new Error(`home.wxss must keep landscape touch layout token: ${token}`);
  }
}

const webMap = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.wxml"), "utf8");
if (webMap.includes("<web-view") || webMap.includes("src=\"{{src}}\"") || webMap.includes("src='{{src}}'")) {
  throw new Error("map page must be native and must not use web-view");
}
for (const token of ["native-map-page layer-{{layerMode}}", "map-stage", "mapCanvas", "map-canvas", "map3d-guidance-strip", "material-panel", "map-legend", "panel-close"]) {
  if (!webMap.includes(token)) {
    throw new Error(`map page must keep native map token: ${token}`);
  }
}

const webMapJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.js"), "utf8");
for (const token of ["require(\"../../data/map-data\")", "calculateRoute", "buildGraph", "drawFloor", "drawRoute", "drawDoors", "drawRooms", "handleCanvasTap", "handleTouchMove", "104-2F01", "202-5", "108-2F04", "wx.reLaunch"]) {
  if (!webMapJs.includes(token)) {
    throw new Error(`map.js must keep native map logic token: ${token}`);
  }
}
if (webMapJs.includes("webBaseUrl") || webMapJs.includes("127.0.0.1") || webMapJs.includes("localhost") || webMapJs.includes("canRenderWebView")) {
  throw new Error("map.js must not depend on web-view or local H5 URLs");
}

const webMapWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.wxss"), "utf8");
for (const token of ["position: fixed", ".native-map-page", ".map-stage", ".map-canvas", ".floor-deck", ".space-corridor", ".room", ".door", ".route-segment", ".stair", ".route-node", ".material-panel", ".panel-close", ".map3d-guidance-strip", ".layer-status-pill"]) {
  if (!webMapWxss.includes(token)) {
    throw new Error(`map.wxss must keep full-screen native map styling: ${token}`);
  }
}

const miniMapData = fs.readFileSync(path.join(root, "miniprogram/miniprogram/data/map-data.js"), "utf8");
for (const token of ["Generated by scripts/generate-miniprogram-map-data.mjs", "src/features/map/data/mapData.ts", "rooms", "spaces", "doors", "stairs", "nodes", "edges", "202-5", "104-2F01", "108-2F04"]) {
  if (!miniMapData.includes(token)) {
    throw new Error(`map-data.js must keep synchronized map token: ${token}`);
  }
}
const miniMapModule = { exports: {} };
vm.runInNewContext(miniMapData, { module: miniMapModule, exports: miniMapModule.exports }, { filename: "miniprogram/miniprogram/data/map-data.js" });
const syncedMapData = miniMapModule.exports;
for (const key of ["rooms", "spaces", "doors", "stairs", "nodes", "edges"]) {
  if (!Array.isArray(syncedMapData[key]) || syncedMapData[key].length === 0) {
    throw new Error(`map-data.js exported ${key} must be a non-empty array`);
  }
}
const routeNodeIds = new Set(syncedMapData.nodes.map((node) => node.id));
const routeAdjacency = new Map();
for (const edge of syncedMapData.edges) {
  if (!routeNodeIds.has(edge.from) || !routeNodeIds.has(edge.to)) continue;
  const fromList = routeAdjacency.get(edge.from) || [];
  fromList.push(edge.to);
  routeAdjacency.set(edge.from, fromList);
  const toList = routeAdjacency.get(edge.to) || [];
  toList.push(edge.from);
  routeAdjacency.set(edge.to, toList);
}
function hasRouteToRoom(roomId) {
  const start = `center-${syncedMapData.defaultStartRoomId || "101"}`;
  const target = `center-${roomId}`;
  const queue = [start];
  const seen = new Set(queue);
  for (const current of queue) {
    if (current === target) return true;
    for (const next of routeAdjacency.get(current) || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}
for (const roomId of ["104-2F01", "108-2F04", "202-5", "208"]) {
  if (!hasRouteToRoom(roomId)) {
    throw new Error(`map-data.js route graph cannot reach ${roomId} from default start`);
  }
}

const chatWxml = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/chat/chat.wxml"), "utf8");
const chatWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/chat/chat.wxss"), "utf8");
for (const token of ["robot-speaking.png", "response-page", "answer-zone", "keyword-row", "audio-pill", "response-rail"]) {
  if (!chatWxml.includes(token) && !chatWxss.includes(token)) {
    throw new Error(`chat page must keep mobile app response token: ${token}`);
  }
}

const expertWxml = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/expert/expert.wxml"), "utf8");
const expertWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/expert/expert.wxss"), "utf8");
for (const token of ["robot-expert.png", "response-page", "answer-zone", "keyword-row", "citation-strip", "response-rail"]) {
  if (!expertWxml.includes(token) && !expertWxss.includes(token)) {
    throw new Error(`expert page must keep mobile app response token: ${token}`);
  }
}

const miniProgramText = [
  appJs,
  home,
  homeWxml,
  homeWxss,
  webMap,
  webMapJs,
  webMapWxss,
  chatWxml,
  chatWxss,
  expertWxml,
  expertWxss,
  fs.readFileSync(path.join(root, "miniprogram/README.md"), "utf8"),
].join("\n");
for (const token of ["5173", "127.0.0.1", "localhost", "webBaseUrl", "<web-view", "业务域名"]) {
  if (miniProgramText.includes(token)) {
    throw new Error(`mini program self-contained release must not include token: ${token}`);
  }
}

const scriptText = fs.readFileSync(new URL(import.meta.url), "utf8");
if (!scriptText.includes("self-contained release")) {
  throw new Error("verification script self-check failed");
}

console.log(releaseMode ? "Mini program release gate verified." : "Mini program shell verified.");
