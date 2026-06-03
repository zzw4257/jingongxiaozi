import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const releaseMode = process.argv.includes("--release") || process.env.MINIPROGRAM_RELEASE_CHECK === "1";
const currentMobileMapHashes = {
  default: "2dc5d1544d90f22e6eb58cd66401c9280ce4da0067811eda83249e921bdac4f1",
  layer2f: "8364a57c2a38342a42879b828a3ac56e784383c2a295a6d85fde530b84ba0ce1",
  layer202: "d629eaf5bca50cf86f54f8ec6c841e1940e1e3a12b531fc86811c22dd2a42d15",
  layerExploded: "d23ee8fed88862bc0adc759274da0d891b21151bab5e1304afa7121f29c2df37",
  route104: "0c5c19cac96b6c72689a324594ed77ea394b5d58d0f38bc8da7b753ca940aa3e",
  route202: "c722d8d65f9f302d62576f6403fb21862a34535a3a316ced659aaf5e546593e1",
  route108: "a968bd00376f41e963ad93a6c381b2411e0f15dc879ad941d8602e34bfce096d",
  route208: "b059e90cd11ad0f5f10fedbbdec4ffbf32e594b6bb698059b78ef6a0d4da0557",
};
const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const pngSize = (file) => {
  const buffer = fs.readFileSync(path.join(root, file));
  if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error(`${file} is not a PNG asset`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};
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
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-108.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-208.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-main-mobile-0603.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-2f-mobile-0603.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-202-mobile-0603.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-exploded-mobile-0603.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-104-mobile-0603.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-202-mobile-0603.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-108-mobile-0603.png",
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-208-mobile-0603.png",
  "src/shared/miniProgramBridge.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required miniprogram file: ${file}`);
  }
}

const currentLayerAssetHashes = {
  "miniprogram/miniprogram/assets/ui/miniprogram-map-main-mobile-0603.png": currentMobileMapHashes.default,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-main.png": currentMobileMapHashes.default,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-overview.png": currentMobileMapHashes.default,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-2f-mobile-0603.png": currentMobileMapHashes.layer2f,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-2f.png": currentMobileMapHashes.layer2f,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-202-mobile-0603.png": currentMobileMapHashes.layer202,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-202.png": currentMobileMapHashes.layer202,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-exploded-mobile-0603.png": currentMobileMapHashes.layerExploded,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-layer-exploded.png": currentMobileMapHashes.layerExploded,
};
for (const [file, expectedHash] of Object.entries(currentLayerAssetHashes)) {
  const size = pngSize(file);
  if (size.width !== 844 || size.height !== 390) {
    throw new Error(`${file} must stay at the current mobile landscape baseline size 844x390`);
  }
  const hash = sha256File(file);
  if (hash !== expectedHash) {
    throw new Error(`${file} must match its current H5/mobile layer baseline; got ${hash}`);
  }
}
if (currentMobileMapHashes.layer2f === currentMobileMapHashes.default || currentMobileMapHashes.layer202 === currentMobileMapHashes.default || currentMobileMapHashes.layerExploded === currentMobileMapHashes.default) {
  throw new Error("mini program layer assets must be visually distinct from the default overview");
}
const routeAssetHashes = {
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-104-mobile-0603.png": currentMobileMapHashes.route104,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-104.png": currentMobileMapHashes.route104,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-202-mobile-0603.png": currentMobileMapHashes.route202,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-202.png": currentMobileMapHashes.route202,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-108-mobile-0603.png": currentMobileMapHashes.route108,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-108.png": currentMobileMapHashes.route108,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-208-mobile-0603.png": currentMobileMapHashes.route208,
  "miniprogram/miniprogram/assets/ui/miniprogram-map-route-208.png": currentMobileMapHashes.route208,
};
for (const [file, expectedHash] of Object.entries(routeAssetHashes)) {
  const size = pngSize(file);
  if (size.width !== 844 || size.height !== 390) {
    throw new Error(`${file} must stay at the current mobile landscape baseline size 844x390`);
  }
  const hash = sha256File(file);
  if (hash !== expectedHash) {
    throw new Error(`${file} must match the current H5/mobile route baseline; got ${hash}`);
  }
}

const projectConfig = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/project.config.json"), "utf8"));
if (projectConfig.miniprogramRoot !== "miniprogram/") {
  throw new Error("project.config.json miniprogramRoot must be miniprogram/");
}
if (releaseMode && (!projectConfig.appid || projectConfig.appid === "touristappid")) {
  throw new Error("release check requires a real WeChat AppID in miniprogram/project.config.json");
}
const conditionList = projectConfig.condition?.miniprogram?.list || [];
const expectedConditions = new Map([
  ["地图页-默认总览", "source=miniprogram&ui=mobile"],
  ["地图页-104路线", "targetRoomId=104-2F01"],
  ["地图页-108路线", "targetRoomId=108-2F04"],
  ["地图页-202路线", "targetRoomId=202-5"],
  ["地图页-208路线", "targetRoomId=208"],
]);
for (const [name, queryToken] of expectedConditions) {
  const condition = conditionList.find((item) => item.name === name);
  if (!condition) throw new Error(`project.config.json must keep DevTools condition: ${name}`);
  if (condition.pathName !== "pages/map/map") {
    throw new Error(`DevTools condition ${name} must open the native map page`);
  }
  if (!condition.query?.includes("source=miniprogram") || !condition.query?.includes("ui=mobile") || !condition.query?.includes(queryToken)) {
    throw new Error(`DevTools condition ${name} must keep synchronized query token: ${queryToken}`);
  }
  if (condition.query.includes("127.0.0.1") || condition.query.includes("localhost") || condition.query.includes("5173")) {
    throw new Error(`DevTools condition ${name} must not depend on a local H5 service`);
  }
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
for (const token of ["primaryMapDirects", "secondaryMapDirects", "showAppDrawer", "showMoreRoutes", "buildMapQuery", "launchPage", "wx.reLaunch", "navigating"]) {
  if (!home.includes(token)) {
    throw new Error(`home.js must keep landscape route grouping: ${token}`);
  }
}
if (home.includes("wx.navigateTo")) {
  throw new Error("home.js must use reLaunch for primary shell pages to avoid stacked pageframe drift in landscape display mode");
}
if (home.includes("webBaseUrl") || home.includes("127.0.0.1") || home.includes("localhost") || home.includes("src=")) {
  throw new Error("home.js must not route through web-view/local H5 URLs");
}

const homeWxml = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.wxml"), "utf8");
for (const token of ["../../assets/ui/robot-standby.png", "../../assets/ui/robot-speaking.png", "../../assets/ui/robot-expert.png", "../../assets/ui/map-building-pin.png", "../../assets/ui/route-stairs.png", "map-fab", "drawer-handle", "app-drawer", "primaryMapDirects", "secondaryMapDirects", "showMoreRoutes", "快速路线", "openChat", "openExpert"]) {
  if (!homeWxml.includes(token)) {
    throw new Error(`home.wxml must keep landscape route grouping: ${token}`);
  }
}
if (homeWxml.includes("WebView") || homeWxml.includes("业务域名") || homeWxml.includes("地图服务未连接") || homeWxml.includes("src=\"/assets/")) {
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
if (webMap.includes("map-native-start-bar") || webMap.includes("native-start-button")) {
  throw new Error("map page must not render invisible bottom shortcut hit zones in the default browsing state");
}
if (!webMap.includes("<view class=\"map-rail native-screenshot-owned-ui native-hot-rail\"")) {
  throw new Error("map page must keep touch hit zones aligned with the runtime mobile right rail");
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
    throw new Error(`map page must not duplicate runtime rail visible UI text: ${duplicatedLabel}`);
  }
}
for (const token of ["catchtap=\"openPanel\"", "catchtap=\"setViewPreset\"", "rail-visible-icon"]) {
  if (!webMap.includes(token)) {
    throw new Error(`transparent right rail must use real catchtap hit nodes: ${token}`);
  }
}
if (!webMap.includes("id=\"mapCanvas\"") || !webMap.includes("type=\"webgl\"") || !webMap.includes("class=\"map-canvas native-map-visual native-webgl-map\"")) {
  throw new Error("map page must keep a real native WebGL canvas for runtime map rendering");
}
for (const token of ["native-map-page layer-{{layerMode}}", "catchtap=\"handlePageTap\"", "map-stage", "map-static-fallback", "mapImageTransformStyle", "native-map-hit-layer", "native-screenshot-owned-ui", "nativeFloors", "nativeSpaces", "nativeRooms", "nativeDoors", "nativeStairs", "nativeRouteSegments", "nativeRoutePins", "map3d-guidance-strip", "material-panel", "map-legend", "panel-close", "focusActiveStep", "advanceRouteCheckpoint", "view-control-row", "202 平台"]) {
  if (!webMap.includes(token)) {
    throw new Error(`map page must keep native map token: ${token}`);
  }
}

const webMapJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.js"), "utf8");
for (const token of ["require(\"../../data/map-data\")", "calculateRoute", "buildGraph", "drawFloor", "drawRoute", "drawDoors", "drawRooms", "buildNativeMapVisual", "selectNativeRoom", "handleCanvasTap", "handlePageTap", "handleTouchMove", "normalizeTransform", "imageTransformStyle", "userImageTransformStyle", "mapImageTransformStyle", "rendererReadyClass", "railTapAction", "railButtonTops", "focusActiveStep", "advanceRouteCheckpoint", "raised202ContextBounds", "mapImageSrc", "miniprogram-map-route-104-mobile-0603.png", "miniprogram-map-route-108-mobile-0603.png", "miniprogram-map-route-208-mobile-0603.png", "miniprogram-map-layer-202-mobile-0603.png", "allFloors", "exploded", "section", "104-2F01", "202-5", "108-2F04", "wx.reLaunch"]) {
  if (!webMapJs.includes(token)) {
    throw new Error(`map.js must keep native map logic token: ${token}`);
  }
}
for (const [targetId, asset] of Object.entries({
  "104-2F01": "miniprogram-map-route-104-mobile-0603.png",
  "202-5": "miniprogram-map-route-202-mobile-0603.png",
  "108-2F04": "miniprogram-map-route-108-mobile-0603.png",
  "208": "miniprogram-map-route-208-mobile-0603.png",
})) {
  if (!webMapJs.includes(`"${targetId}"`) || !webMapJs.includes(asset)) {
    throw new Error(`quick target ${targetId} must keep an explicit packaged route asset ${asset}`);
  }
}
if (webMapJs.includes("webBaseUrl") || webMapJs.includes("127.0.0.1") || webMapJs.includes("localhost") || webMapJs.includes("canRenderWebView")) {
  throw new Error("map.js must not depend on web-view or local H5 URLs");
}
if (webMapJs.includes("wx.createCanvasContext")) {
  throw new Error("mini program map must not use legacy canvas contexts");
}
if (!webMapJs.includes("select(\"#mapCanvas\")") || !webMapJs.includes("getContext(\"webgl\")") || !webMapJs.includes("renderWebglBackdrop")) {
  throw new Error("mini program map must use the native WebGL canvas as the primary runtime renderer");
}
for (const token of [
  "createWebglProgram",
  "createWebglTextureProgram",
  "compileWebglShader",
  "buildWebglMapGeometry",
  "drawWebglMap",
  "drawWebglBaselineTexture",
  "ensureWebglMapTexture",
  "texImage2D",
  "createImage",
  "pushWebglFloor",
  "pushWebglSpaces",
  "pushWebglRooms",
  "pushWebglWalls",
  "pushWebglDoors",
  "pushWebglStairs",
  "pushWebglRoute",
  "pushWebglRouteNodes",
  "gl.bufferData",
  "gl.drawArrays",
]) {
  if (!webMapJs.includes(token)) {
    throw new Error(`mini program WebGL map renderer must draw runtime geometry, missing token: ${token}`);
  }
}
if (/if\s*\(webglRef\s*&&\s*canvasRef\)\s*\{\s*renderWebglBackdrop\([^;]+;\s*return;\s*\}/s.test(webMapJs)) {
  throw new Error("mini program WebGL map renderer must not stop after clearing the backdrop");
}
if (!webMapJs.includes("drawWebglBaselineTexture();") || !webMapJs.includes("mapImageSrc(this.data.layerMode, this.data.route)")) {
  throw new Error("mini program WebGL renderer must draw the current mobile baseline texture before dynamic route geometry");
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

  const assertMapAsset = (expected, reason) => {
    if (!instance.data.mapImageSrc || !instance.data.mapImageSrc.includes(expected)) {
      throw new Error(`${reason}; got ${instance.data.mapImageSrc || "<empty>"}`);
    }
  };
  const assertRuntimeGeometry = (floorIds, minimumVertices, reason) => {
    if (typeof instance.buildWebglMapGeometry !== "function") {
      throw new Error(`${reason}: WebGL geometry builder is not exposed on the page instance`);
    }
    const vertices = instance.buildWebglMapGeometry.call(instance, floorIds);
    if (!Array.isArray(vertices) || vertices.length < minimumVertices) {
      throw new Error(`${reason}: WebGL geometry is too small (${vertices?.length || 0} floats)`);
    }
    if (vertices.some((value) => !Number.isFinite(value))) {
      throw new Error(`${reason}: WebGL geometry contains NaN/Infinity`);
    }
    if (vertices.length % 6 !== 0) {
      throw new Error(`${reason}: WebGL vertex stride must be position+color (6 floats)`);
    }
  };
  const setLayerAndAssert = (layer, expectedAsset) => {
    instance.setLayer.call(instance, { currentTarget: { dataset: { layer } } });
    if (instance.data.layerMode !== layer) {
      throw new Error(`map layer switch did not select ${layer}`);
    }
    assertMapAsset(expectedAsset, `map layer ${layer} did not switch to its packaged mobile asset`);
    if (!instance.data.nativeRooms || instance.data.nativeRooms.length < 1) {
      throw new Error(`map layer ${layer} did not keep native room hit areas`);
    }
  };
  const assertRoute = (targetRoomId, expectedAsset, requiredKind, reason) => {
    if (!instance.data.route || instance.data.route.targetRoomId !== targetRoomId) {
      throw new Error(`${reason}: route target mismatch`);
    }
    assertMapAsset(expectedAsset, `${reason}: route did not switch to expected mobile route asset`);
    if (!instance.data.route.steps.some((step) => String(step.kind || "").includes(requiredKind))) {
      throw new Error(`${reason}: route steps did not include ${requiredKind}`);
    }
    if (!instance.data.route.nodeIds.includes(`center-${targetRoomId}`)) {
      throw new Error(`${reason}: route path did not reach the target room center`);
    }
  };

  instance.onLoad.call(instance, {});
  assertMapAsset("miniprogram-map-main-mobile-0603.png", "manual map open must use the current mobile overview");
  assertRuntimeGeometry(["1F", "2F", "25F"], 900, "manual all-floor fallback WebGL geometry");
  if (instance.data.hasRoute || instance.data.route) {
    throw new Error("manual map open must start without a route");
  }
  setLayerAndAssert("2F", "miniprogram-map-layer-2f-mobile-0603.png");
  assertRuntimeGeometry(["2F"], 240, "2F fallback WebGL geometry");
  setLayerAndAssert("raised202", "miniprogram-map-layer-202-mobile-0603.png");
  assertRuntimeGeometry(["2F", "25F"], 300, "202 platform fallback WebGL geometry");
  setLayerAndAssert("exploded", "miniprogram-map-layer-exploded-mobile-0603.png");
  setLayerAndAssert("allFloors", "miniprogram-map-main-mobile-0603.png");

  instance.onLoad.call(instance, { targetRoomId: "202-5", announce: "summary,distance,direction,floorChange" });
  const styledItems = [
    ...instance.data.nativeRooms,
  ];
  if (instance.data.nativeRooms.length < 40) {
    throw new Error("map page smoke test did not generate enough room hit areas");
  }
  if (!instance.data.route || !instance.data.mapImageSrc.includes("miniprogram-map-route-202-mobile-0603.png")) {
    throw new Error("map page smoke test did not generate a route for 202-5");
  }
  assertRuntimeGeometry(["1F", "2F", "25F"], 1000, "MapDirect 202-5 fallback WebGL route geometry");
  assertRoute("202-5", "miniprogram-map-route-202-mobile-0603.png", "stair", "MapDirect 202-5");
  if (!instance.data.route.nodeIds.includes("stair-public-upper") && !instance.data.route.nodeIds.includes("door-202-5")) {
    throw new Error("MapDirect 202-5 route must pass the public stair / 202 platform connector");
  }
  if (!instance.data.mapImageTransformStyle.includes("scale(1.000)") || !instance.data.mapImageTransformStyle.includes("rotate(0.00deg)")) {
    throw new Error("map fallback image must open at the un-cropped current baseline before user gestures");
  }
  const beforeTransform = instance.data.mapImageTransformStyle;
  instance.handleCanvasTap.call(instance, { detail: { x: 360, y: 89 } });
  if (instance.data.panel !== "layers") {
    throw new Error("map page right screenshot rail tap zone must open layers panel");
  }
  instance.closePanel.call(instance);
  instance.handlePageTap.call(instance, { detail: { x: 360, y: 125 } });
  if (instance.data.panel !== "view") {
    throw new Error("map page right screenshot rail tap zone must open view panel");
  }
  instance.closePanel.call(instance);
  instance.handleTouchStart.call(instance, { touches: [{ clientX: 100, clientY: 80 }] });
  instance.handleTouchMove.call(instance, { touches: [{ clientX: 128, clientY: 96 }] });
  if (!instance.data.mapImageTransformStyle || instance.data.mapImageTransformStyle === beforeTransform || !instance.data.mapImageTransformStyle.includes("translate(")) {
    throw new Error("map page touch pan must update the fallback transform used before canvas readiness");
  }
  if (instance.transform.panX === 0 || instance.transform.panY === 0) {
    throw new Error("map page touch pan must update the geometric map transform, not only the PNG fallback");
  }
  const afterPanTransform = instance.data.mapImageTransformStyle;
  instance.handleTouchStart.call(instance, { touches: [{ clientX: 100, clientY: 80 }, { clientX: 160, clientY: 80 }] });
  instance.handleTouchMove.call(instance, { touches: [{ clientX: 92, clientY: 76 }, { clientX: 176, clientY: 92 }] });
  if (!instance.data.mapImageTransformStyle || instance.data.mapImageTransformStyle === afterPanTransform || !/scale\((?!1\.000)/.test(instance.data.mapImageTransformStyle)) {
    throw new Error("map page pinch gesture must update the fallback scale/rotation used before canvas readiness");
  }
  if (instance.transform.zoom <= 1 || Math.abs(instance.transform.rotation) <= 0.001) {
    throw new Error("map page pinch gesture must update geometric zoom and rotation");
  }
  const beforeRotateTransform = instance.data.mapImageTransformStyle;
  instance.setViewPreset.call(instance, { currentTarget: { dataset: { view: "rotateRight" } } });
  if (!instance.data.mapImageTransformStyle || instance.data.mapImageTransformStyle === beforeRotateTransform || !/rotate\((?!0\.00deg)/.test(instance.data.mapImageTransformStyle)) {
    throw new Error("map page explicit rotate control must update the fallback rotation used before canvas readiness");
  }
  if (Math.abs(instance.transform.rotation) <= 0.001) {
    throw new Error("map page explicit rotate control must update geometric map rotation");
  }
  instance.selectQuickTarget.call(instance, { currentTarget: { dataset: { id: "104-2F01" } } });
  assertRoute("104-2F01", "miniprogram-map-route-104-mobile-0603.png", "internal-stair", "manual 104-2F01 target");
  if (!instance.data.route.nodeIds.some((nodeId) => nodeId.includes("104") && nodeId.includes("stair"))) {
    throw new Error("manual 104-2F01 target must pass a 104 internal stair node");
  }
  instance.selectQuickTarget.call(instance, { currentTarget: { dataset: { id: "108-2F04" } } });
  assertRoute("108-2F04", "miniprogram-map-route-108-mobile-0603.png", "internal-stair", "manual 108-2F04 target");
  if (instance.data.route.nodeIds.some((nodeId) => nodeId.includes("public") || nodeId === "stair-public-upper")) {
    throw new Error("manual 108-2F04 target must not use the public stair");
  }
  instance.selectQuickTarget.call(instance, { currentTarget: { dataset: { id: "208" } } });
  assertRoute("208", "miniprogram-map-route-208-mobile-0603.png", "stair", "manual 208 target");
  if (!instance.data.route.nodeIds.some((nodeId) => nodeId.includes("public"))) {
    throw new Error("manual 208 target must use the public stair connection");
  }
  instance.clearRoute.call(instance);
  if (instance.data.hasRoute || instance.data.route || instance.data.targetRoomId) {
    throw new Error("clearRoute must return the map to independent browsing state");
  }
  if (styledItems.some((item) => /NaN|undefined/.test(item.style || ""))) {
    throw new Error("map page smoke test generated invalid native map styles");
  }
}

smokeLoadMapPage();

const webMapWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/map/map.wxss"), "utf8");
for (const token of ["position: fixed", ".native-map-page", ".map-backplate", ".map-stage", ".map-static-fallback", ".renderer-canvas-ready .map-static-fallback", ".native-map-hit-layer", ".native-screenshot-owned-ui", ".native-room", ".map-canvas", ".floor-deck", ".space-corridor", ".room", ".door", ".route-segment", ".stair", ".route-node", ".material-panel", ".panel-close", ".map3d-guidance-strip", ".layer-status-pill", ".route-action-controls", ".view-control-row", ".rail-icon"]) {
  if (!webMapWxss.includes(token)) {
    throw new Error(`map.wxss must keep full-screen native map styling: ${token}`);
  }
}
for (const token of [".map-native-start-bar", ".native-start-button", ".native-start-copy", ".native-hot-start", ".map-start-card", ".start-target"]) {
  if (webMapWxss.includes(token)) {
    throw new Error(`map.wxss must not keep obsolete bottom shortcut styling: ${token}`);
  }
}
const canvasCssBlock = webMapWxss.match(/\.map-canvas\s*\{[^}]*\}/)?.[0] || "";
if (!/display:\s*block/.test(canvasCssBlock) || !/width:\s*calc\(100% - 12px\)/.test(canvasCssBlock) || !/height:\s*calc\(100% - 12px\)/.test(canvasCssBlock) || !/opacity:\s*1\b/.test(canvasCssBlock) || !/pointer-events:\s*auto/.test(canvasCssBlock)) {
  throw new Error("map WebGL canvas must be the visible primary runtime renderer, not a hidden compatibility node");
}
const mapStageCssBlock = webMapWxss.match(/\.map-stage\s*\{[^}]*\}/)?.[0] || "";
if (!/right:\s*0/.test(mapStageCssBlock)) {
  throw new Error("map stage must use the full viewport; do not reserve a dead right gutter");
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
if (!/opacity:\s*1\b/.test(staticMapCssBlock) || !/filter:\s*none/.test(staticMapCssBlock)) {
  throw new Error("static map image must render the exact mobile baseline without dimming or filter drift");
}
const readyFallbackCssBlock = webMapWxss.match(/\.renderer-canvas-ready \.map-static-fallback\s*\{[^}]*\}/)?.[0] || "";
if (!/opacity:\s*0\b/.test(readyFallbackCssBlock)) {
  throw new Error("self-contained mini program must hide the PNG fallback once the canvas renderer is ready");
}
if (!/\.map3d-guidance-strip\.native-hot-guidance\s*,\s*\.map-rail\.native-hot-rail\s*\{[^}]*background:\s*transparent/s.test(webMapWxss)) {
  throw new Error("rail/guidance hit zones must stay visually transparent to avoid duplicate overlap");
}
if (!/\.map3d-guidance-strip\.native-hot-guidance \.guidance-hot-action\s*\{[^}]*color:\s*transparent/s.test(webMapWxss)) {
  throw new Error("transparent guidance hot-zone children must not render visible duplicate labels");
}
if (!/\.map-rail\.native-hot-rail \.rail-hot-button\s*,\s*\.map-rail\.native-hot-rail \.rail-hot-button\.active\s*\{[^}]*background:\s*transparent/s.test(webMapWxss)) {
  throw new Error("right rail buttons must be transparent hot-zones over the mobile screenshot rail");
}
if (!/\.rail-visible-icon\s*\{[^}]*font-size:\s*15px/s.test(webMapWxss)) {
  throw new Error("right rail hit labels must render as compact icons only");
}
if (!/\.rail-visible-icon\s*\{[^}]*opacity:\s*0/s.test(webMapWxss)) {
  throw new Error("right rail hit labels must be invisible because the runtime rail visual is owned by the map shell");
}
for (const nth of ["nth-child(1)", "nth-child(2)", "nth-child(3)", "nth-child(4)", "nth-child(5)"]) {
  if (!webMapWxss.includes(`.map-rail.native-hot-rail .rail-hot-button:${nth}`)) {
    throw new Error(`transparent rail hot-zone must be explicitly aligned to screenshot rail: ${nth}`);
  }
}
const railCssBlock = webMapWxss.match(/\.map-rail\s*\{[^}]*\}/)?.[0] || "";
if (!/top:\s*50%/.test(railCssBlock) || !/transform:\s*translateY\(-50%\)/.test(railCssBlock)) {
  throw new Error("right rail must be centered away from the WeChat capsule area");
}
if (webMapWxss.includes(".native-control-rail")) {
  throw new Error("mini program must not draw a separate native right rail over the mobile screenshot rail");
}
if (!/opacity:\s*1/.test(webMapWxss.match(/\.native-room\s*\{[^}]*\}/)?.[0] || "")) {
  throw new Error("native room geometry overlay must stay visible above the WebGL map");
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
if (!chatWxml.includes("../../assets/ui/robot-speaking.png") || chatWxml.includes("src=\"/assets/")) {
  throw new Error("chat.wxml must use bundled relative assets");
}
for (const token of ["robot-speaking.png", "response-page", "answer-zone", "keyword-row", "audio-pill", "response-rail"]) {
  if (!chatWxml.includes(token) && !chatWxss.includes(token)) {
    throw new Error(`chat page must keep mobile app response token: ${token}`);
  }
}

const expertWxml = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/expert/expert.wxml"), "utf8");
const expertWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/expert/expert.wxss"), "utf8");
if (!expertWxml.includes("../../assets/ui/robot-expert.png") || expertWxml.includes("src=\"/assets/")) {
  throw new Error("expert.wxml must use bundled relative assets");
}
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
