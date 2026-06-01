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
  "miniprogram/miniprogram/data/map-data.json",
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
  "miniprogram/miniprogram/assets/ui/miniprogram-map-overview.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-main.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-2f.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-202.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-exploded.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-104.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-202.png",
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
if (appJson.pages?.[0] !== "pages/map/map") {
  throw new Error("mini program must launch directly into the usable native map page");
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
for (const token of ["primaryMapDirects", "secondaryMapDirects", "showAppDrawer", "showMoreRoutes", "buildMapQuery", "wx.navigateTo", "navigating"]) {
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
if (!webMap.includes("mapImageSrc")) {
  throw new Error("map page must keep the self-contained PNG map fallback");
}
if (!webMap.includes("map-native-start-bar") || !webMap.includes("native-start-button") || !webMap.includes("<view class=\"map-rail native-screenshot-owned-ui native-hot-rail\"")) {
  throw new Error("map page must keep transparent hit zones over the screenshot-owned mobile right rail");
}
for (const duplicatedLabel of [
  "<view>金工中心地图</view>",
  "<view>点终点，立即导引</view>",
  "<cover-view>待机</cover-view>",
  "<cover-view>路线</cover-view>",
  "<cover-view>图层</cover-view>",
  "<cover-view>视角</cover-view>",
  "<cover-view>总览</cover-view>"
]) {
  if (webMap.includes(duplicatedLabel)) {
    throw new Error(`map page must not duplicate screenshot-owned visible UI text: ${duplicatedLabel}`);
  }
}
for (const token of ["catchtap=\"openPanel\"", "catchtap=\"setViewPreset\"", "rail-visible-icon"]) {
  if (!webMap.includes(token)) {
    throw new Error(`transparent right rail must use real catchtap hit nodes: ${token}`);
  }
}
if (webMap.includes("style=\"width:1px;height:1px;\"")) {
  throw new Error("map canvas must not be hidden; mini program map has to remain interactive");
}
for (const token of ["native-map-page layer-{{layerMode}}", "catchtap=\"handlePageTap\"", "map-stage", "map-static-fallback", "mapImageTransformStyle", "native-map-hit-layer", "native-screenshot-owned-ui", "nativeRooms", "map3d-guidance-strip", "map-native-start-bar", "native-start-button", "material-panel", "map-legend", "panel-close", "focusActiveStep", "advanceRouteCheckpoint", "view-control-row", "202 平台"]) {
  if (!webMap.includes(token)) {
    throw new Error(`map page must keep native map token: ${token}`);
  }
}

const webMapJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.js"), "utf8");
for (const token of ["require(\"../../data/map-data\")", "calculateRoute", "buildGraph", "drawFloor", "drawRoute", "drawDoors", "drawRooms", "buildNativeMapVisual", "selectNativeRoom", "handleCanvasTap", "handlePageTap", "handleTouchMove", "normalizeTransform", "imageTransformStyle", "userImageTransformStyle", "mapImageTransformStyle", "railTapAction", "railTapZones", "focusActiveStep", "advanceRouteCheckpoint", "raised202ContextBounds", "mapImageSrc", "miniprogram-map-route-104.png", "miniprogram-map-layer-202.png", "allFloors", "exploded", "section", "104-2F01", "202-5", "108-2F04", "wx.reLaunch"]) {
  if (!webMapJs.includes(token)) {
    throw new Error(`map.js must keep native map logic token: ${token}`);
  }
}
if (webMapJs.includes("webBaseUrl") || webMapJs.includes("127.0.0.1") || webMapJs.includes("localhost") || webMapJs.includes("canRenderWebView")) {
  throw new Error("map.js must not depend on web-view or local H5 URLs");
}
if (webMapJs.includes("wx.createCanvasContext") || webMapJs.includes(".select(\"#mapCanvas\")")) {
  throw new Error("mini program map must not create legacy canvas contexts; native WXML layer is the stable renderer");
}

function smokeLoadMapPage() {
  let pageDef;
  const mapPagePath = path.join(root, "miniprogram/miniprogram/pages/map/map.js");
  const wxMock = {
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 180 }),
    getDeviceInfo: () => ({}),
    nextTick: (fn) => { if (typeof fn === "function") fn(); },
    reLaunch: () => {},
    navigateBack: () => {},
    showToast: () => {},
  };
  const localRequire = (specifier) => {
    const resolved = path.resolve(path.dirname(mapPagePath), specifier);
    if (resolved.endsWith("data/map-data")) {
      const module = { exports: {} };
      vm.runInNewContext(
        fs.readFileSync(`${resolved}.js`, "utf8"),
        { module, exports: module.exports },
        { filename: `${resolved}.js` },
      );
      return module.exports;
    }
    throw new Error(`Unexpected map page require in smoke test: ${specifier}`);
  };
  const context = {
    require: localRequire,
    module: { exports: {} },
    exports: {},
    console,
    wx: wxMock,
    getCurrentPages: () => [],
    Page: (definition) => { pageDef = definition; },
    setTimeout: (fn) => { if (typeof fn === "function") fn(); },
    Math,
    Number,
    String,
    Boolean,
    Set,
    Map,
    Array,
    Object,
    RegExp,
  };
  vm.createContext(context);
  vm.runInContext(webMapJs, context, { filename: mapPagePath });
  if (!pageDef) throw new Error("map page smoke test did not register Page definition");
  const instance = {
    data: JSON.parse(JSON.stringify(pageDef.data)),
    setData(next, callback) {
      this.data = { ...this.data, ...next };
      if (callback) callback();
    },
    ...pageDef,
  };
  instance.onLoad.call(instance, { targetRoomId: "202-5", announce: "summary,distance,direction,floorChange" });
  const styledItems = [
    ...instance.data.nativeRooms,
  ];
  if (instance.data.nativeRooms.length < 40) {
    throw new Error("map page smoke test did not generate enough room hit areas");
  }
  if (!instance.data.route || !instance.data.mapImageSrc.includes("miniprogram-map-route-202.png")) {
    throw new Error("map page smoke test did not generate a route for 202-5");
  }
  if (!instance.data.mapImageTransformStyle.includes("scale(1.000)") || !instance.data.mapImageTransformStyle.includes("rotate(0.00deg)")) {
    throw new Error("map PNG must open at the un-cropped current baseline before user gestures");
  }
  const beforeTransform = instance.data.mapImageTransformStyle;
  instance.handleCanvasTap.call(instance, { detail: { x: 360, y: 90 } });
  if (instance.data.panel !== "layers") {
    throw new Error("map page right screenshot rail tap zone must open layers panel");
  }
  instance.closePanel.call(instance);
  instance.handlePageTap.call(instance, { detail: { x: 360, y: 116 } });
  if (instance.data.panel !== "view") {
    throw new Error("map page right screenshot rail tap zone must open view panel");
  }
  instance.closePanel.call(instance);
  instance.handleTouchStart.call(instance, { touches: [{ clientX: 100, clientY: 80 }] });
  instance.handleTouchMove.call(instance, { touches: [{ clientX: 128, clientY: 96 }] });
  if (!instance.data.mapImageTransformStyle || instance.data.mapImageTransformStyle === beforeTransform || !instance.data.mapImageTransformStyle.includes("translate(")) {
    throw new Error("map page touch pan must update the visible PNG transform");
  }
  const afterPanTransform = instance.data.mapImageTransformStyle;
  instance.handleTouchStart.call(instance, { touches: [{ clientX: 100, clientY: 80 }, { clientX: 160, clientY: 80 }] });
  instance.handleTouchMove.call(instance, { touches: [{ clientX: 92, clientY: 76 }, { clientX: 176, clientY: 92 }] });
  if (!instance.data.mapImageTransformStyle || instance.data.mapImageTransformStyle === afterPanTransform || !/scale\((?!1\.000)/.test(instance.data.mapImageTransformStyle)) {
    throw new Error("map page pinch gesture must update the visible PNG scale/rotation");
  }
  const beforeRotateTransform = instance.data.mapImageTransformStyle;
  instance.setViewPreset.call(instance, { currentTarget: { dataset: { view: "rotateRight" } } });
  if (!instance.data.mapImageTransformStyle || instance.data.mapImageTransformStyle === beforeRotateTransform || !/rotate\((?!0\.00deg)/.test(instance.data.mapImageTransformStyle)) {
    throw new Error("map page explicit rotate control must update the visible PNG rotation");
  }
  if (styledItems.some((item) => /NaN|undefined/.test(item.style || ""))) {
    throw new Error("map page smoke test generated invalid native map styles");
  }
}

smokeLoadMapPage();

const webMapWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.wxss"), "utf8");
for (const token of ["position: fixed", ".native-map-page", ".map-backplate", ".map-stage", ".map-static-fallback", ".native-map-hit-layer", ".native-screenshot-owned-ui", ".native-room", ".map-canvas", ".floor-deck", ".space-corridor", ".room", ".door", ".route-segment", ".stair", ".route-node", ".material-panel", ".panel-close", ".map3d-guidance-strip", ".map-start-card", ".start-target", ".layer-status-pill", ".route-action-controls", ".view-control-row", ".rail-icon"]) {
  if (!webMapWxss.includes(token)) {
    throw new Error(`map.wxss must keep full-screen native map styling: ${token}`);
  }
}
const canvasCssBlock = webMapWxss.match(/\.map-canvas\s*\{[^}]*\}/)?.[0] || "";
if (/width:\s*1px/.test(canvasCssBlock)) {
  throw new Error("map canvas must not be collapsed to 1px");
}
const nativeHitLayerCssBlock = webMapWxss.match(/\.native-map-hit-layer\s*\{[^}]*\}/)?.[0] || "";
if (!nativeHitLayerCssBlock || !webMap.includes("bindtap=\"selectNativeRoom\"")) {
  throw new Error("native WXML map hit layer must remain tappable");
}
if (!/pointer-events:\s*auto/.test(nativeHitLayerCssBlock)) {
  throw new Error("native map hit layer must receive touch gestures");
}
const staticMapCssBlock = webMapWxss.match(/\.map-static-fallback\s*\{[^}]*\}/)?.[0] || "";
if (!/pointer-events:\s*none/.test(staticMapCssBlock)) {
  throw new Error("static map image must not steal gestures from the transparent hit layer");
}
if (!/\.map-native-start-bar\.native-hot-start\s*,\s*\.map3d-guidance-strip\.native-hot-guidance\s*,\s*\.map-rail\.native-hot-rail\s*\{[^}]*background:\s*transparent/s.test(webMapWxss)) {
  throw new Error("screenshot-owned rail/guidance/start hot zones must stay visually transparent to avoid duplicate overlap");
}
if (!/\.map-native-start-bar\.native-hot-start \.native-start-copy\s*,\s*\.map-native-start-bar\.native-hot-start \.native-start-button\s*,\s*\.map3d-guidance-strip\.native-hot-guidance \.guidance-hot-action\s*\{[^}]*color:\s*transparent/s.test(webMapWxss)) {
  throw new Error("transparent bottom/guidance hot-zone children must not render visible duplicate labels");
}
if (!/\.map-rail\.native-hot-rail \.rail-hot-button\s*,\s*\.map-rail\.native-hot-rail \.rail-hot-button\.active\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\)/s.test(webMapWxss)) {
  throw new Error("right rail buttons must use compact mobile icon style instead of native text rail");
}
if (!/\.rail-visible-icon\s*\{[^}]*font-size:\s*15px/s.test(webMapWxss)) {
  throw new Error("right rail hit labels must render as compact icons only");
}
for (const nth of ["nth-child(1)", "nth-child(2)", "nth-child(3)", "nth-child(4)", "nth-child(5)"]) {
  if (!webMapWxss.includes(`.map-rail.native-hot-rail .rail-hot-button:${nth}`)) {
    throw new Error(`transparent rail hot-zone must be explicitly aligned to screenshot rail: ${nth}`);
  }
}
if (webMapWxss.includes(".native-control-rail")) {
  throw new Error("mini program must not draw a separate native right rail over the mobile screenshot rail");
}
if (!/opacity:\s*0/.test(webMapWxss.match(/\.native-room\s*\{[^}]*\}/)?.[0] || "")) {
  throw new Error("native room hit areas must stay transparent so the 5-31 current map asset is not polluted");
}

const miniMapDataJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/data/map-data.js"), "utf8");
if (miniMapDataJs.includes("require(\"./map-data.json\")") || miniMapDataJs.includes("require('./map-data.json')")) {
  throw new Error("WeChat runtime cannot require JSON here; map-data.js must inline the generated object");
}
const miniMapData = fs.readFileSync(path.join(root, "miniprogram/miniprogram/data/map-data.json"), "utf8");
for (const token of ["Generated by scripts/generate-miniprogram-map-data.mjs", "src/features/map/data/mapData.ts", "rooms", "spaces", "doors", "stairs", "walls", "centerlines", "nodes", "edges", "202-5", "104-2F01", "108-2F04"]) {
  if (!miniMapData.includes(token) && !miniMapDataJs.includes(token)) {
    throw new Error(`map-data.js must keep synchronized map token: ${token}`);
  }
}
const miniMapModule = { exports: {} };
vm.runInNewContext(miniMapDataJs, { module: miniMapModule, exports: miniMapModule.exports }, { filename: "miniprogram/miniprogram/data/map-data.js" });
const syncedMapData = miniMapModule.exports;
for (const key of ["rooms", "spaces", "doors", "stairs", "walls", "centerlines", "nodes", "edges"]) {
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
