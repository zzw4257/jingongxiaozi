import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const releaseMode = process.argv.includes("--release") || process.env.MINIPROGRAM_RELEASE_CHECK === "1";
const parityMode = process.argv.includes("--parity") || releaseMode || process.env.MINIPROGRAM_PARITY_CHECK === "1";
const mapSubpackageRoot = "packages/map";
const mapPageRoute = "packages/map/pages/map/map";
const mainPackagePages = ["pages/home/home", "pages/chat/chat", "pages/expert/expert"];
const maxMainPackageBytes = 2 * 1024 * 1024;
const maxSingleSubpackageBytes = 2 * 1024 * 1024;
const maxPackageBytes = 8 * 1024 * 1024;
const requiredFiles = [
  "miniprogram/project.config.json",
  "miniprogram/miniprogram/app.json",
  "miniprogram/miniprogram/app.js",
  "miniprogram/miniprogram/pages/home/home.json",
  "miniprogram/miniprogram/pages/home/home.wxml",
  "miniprogram/miniprogram/pages/home/home.js",
  "miniprogram/miniprogram/packages/map/pages/map/map.json",
  "miniprogram/miniprogram/packages/map/pages/map/map.wxml",
  "miniprogram/miniprogram/packages/map/pages/map/map.js",
  "miniprogram/miniprogram/packages/map/pages/map/map.wxss",
  "miniprogram/miniprogram/packages/map/data/map-data.js",
  "miniprogram/miniprogram/packages/map/data/map-data.json",
  "miniprogram/miniprogram/packages/map/data/map-runtime.js",
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
const packIgnore = projectConfig.packOptions?.ignore || [];
const hasIgnore = (type, value) => packIgnore.some((entry) => entry.type === type && entry.value === value);
for (const [type, value] of [
  ["glob", "**/.DS_Store"],
  ["folder", "assets/ui/generated-icons"],
  ["file", "assets/ui/jingong-xiaozi-icon-1024.png"],
  ["file", "packages/map/data/map-data.json"],
  ["file", "packages/map/map-models/jingong.glb"],
  ["folder", "packages/map/map-models/textures"],
]) {
  if (!hasIgnore(type, value)) {
    throw new Error(`project.config.json packOptions.ignore must exclude upload-only artifact: ${type}:${value}`);
  }
}
const miniRoot = path.join(root, "miniprogram/miniprogram");
const ignoredByPackOptions = (relativePath) => {
  if (relativePath.endsWith(".DS_Store")) return true;
  if (relativePath === "assets/ui/jingong-xiaozi-icon-1024.png") return true;
  if (relativePath.startsWith("assets/ui/generated-icons/")) return true;
  if (relativePath === "packages/map/data/map-data.json") return true;
  if (relativePath === "packages/map/map-models/jingong.glb") return true;
  if (relativePath.startsWith("packages/map/map-models/textures/")) return true;
  return false;
};
const walkFiles = (directory, prefix = "") => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath, relativePath));
    else files.push({ relativePath, absolutePath, bytes: fs.statSync(absolutePath).size });
  }
  return files;
};
const packageFiles = walkFiles(miniRoot).filter((file) => !ignoredByPackOptions(file.relativePath));
const packageBytes = packageFiles.reduce((sum, file) => sum + file.bytes, 0);
const mainPackageBytes = packageFiles
  .filter((file) => !file.relativePath.startsWith(`${mapSubpackageRoot}/`))
  .reduce((sum, file) => sum + file.bytes, 0);
const mapSubpackageBytes = packageFiles
  .filter((file) => file.relativePath.startsWith(`${mapSubpackageRoot}/`))
  .reduce((sum, file) => sum + file.bytes, 0);
if (packageBytes > maxPackageBytes) {
  throw new Error(`mini program effective package is too large: ${(packageBytes / 1024 / 1024).toFixed(2)} MiB > 8.00 MiB`);
}
if (mainPackageBytes > maxMainPackageBytes) {
  throw new Error(`mini program main package is too large: ${(mainPackageBytes / 1024 / 1024).toFixed(2)} MiB > 2.00 MiB`);
}
if (mapSubpackageBytes > maxSingleSubpackageBytes) {
  throw new Error(`mini program map subpackage is too large: ${(mapSubpackageBytes / 1024 / 1024).toFixed(2)} MiB > 2.00 MiB`);
}
for (const file of packageFiles) {
if (file.relativePath.includes("generated-icons") || file.relativePath.endsWith(".DS_Store") || file.relativePath === "assets/ui/jingong-xiaozi-icon-1024.png" || file.relativePath === "packages/map/data/map-data.json" || file.relativePath === "packages/map/map-models/jingong.glb" || file.relativePath.startsWith("packages/map/map-models/textures/")) {
    throw new Error(`packOptions.ignore did not exclude upload-only artifact: ${file.relativePath}`);
  }
}
if (releaseMode && (!projectConfig.appid || projectConfig.appid === "touristappid")) {
  throw new Error("release check requires a real WeChat AppID in miniprogram/project.config.json");
}
const conditionList = projectConfig.condition?.miniprogram?.list || [];
const homeCondition = conditionList.find((item) => item.name === "首页-待机入口");
if (!homeCondition) throw new Error("project.config.json must keep DevTools condition: 首页-待机入口");
if (homeCondition.pathName !== "pages/home/home" || homeCondition.query) {
  throw new Error("DevTools condition 首页-待机入口 must open the standby shell without route query");
}
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
  if (condition.pathName !== mapPageRoute) {
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
for (const page of mainPackagePages) {
  if (!pages.has(page)) throw new Error(`app.json does not declare page: ${page}`);
}
if (pages.has(mapPageRoute)) {
  throw new Error("app.json must keep the native map page in the map subpackage, not the main package");
}
const mapSubpackage = (appJson.subpackages || appJson.subPackages || []).find((pkg) => pkg.root === mapSubpackageRoot);
if (!mapSubpackage) {
  throw new Error("app.json must declare the map subpackage at packages/map");
}
if (!Array.isArray(mapSubpackage.pages) || !mapSubpackage.pages.includes("pages/map/map")) {
  throw new Error("app.json map subpackage must declare pages/map/map");
}
if (appJson.pages?.[0] !== "pages/home/home") {
  throw new Error("mini program must launch into the mobile-aligned standby shell page, not directly into the map");
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

const webMapJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/pages/map/map.json"), "utf8"));
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
const homeVisibleCopy = homeWxml.replace(/<[^>]*>/g, " ");
for (const token of ["MapDirect", "mock 指令", "发布版隐藏", "2.5D 分层", "后端调试", "联调入口"]) {
  if (homeVisibleCopy.includes(token)) {
    throw new Error(`home.wxml must not expose implementation/debug copy in the product shell: ${token}`);
  }
}

const homeWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.wxss"), "utf8");
for (const token of ["height: 100vh", ".robot-expression-image", ".map-fab", ".drawer-handle", ".app-drawer", ".route-grid", "@media (orientation: portrait)"]) {
  if (!homeWxss.includes(token)) {
    throw new Error(`home.wxss must keep landscape touch layout token: ${token}`);
  }
}

function smokeLoadHomePage() {
  let pageDef;
  const launched = [];
  const appMock = { globalData: {} };
  const wxMock = {
    reLaunch({ url, complete, fail }) {
      if (!url) {
        fail?.();
        return;
      }
      launched.push(url);
      complete?.();
    },
    showToast() {},
  };
  const context = {
    console,
    wx: wxMock,
    getApp: () => appMock,
    Page: (definition) => { pageDef = definition; },
  };
  const homePagePath = path.join(root, "miniprogram/miniprogram/pages/home/home.js");
  vm.createContext(context);
  vm.runInContext(home, context, { filename: homePagePath });
  if (!pageDef) throw new Error("home page smoke test did not register Page definition");
  const instance = {
    data: JSON.parse(JSON.stringify(pageDef.data)),
    setData(next, callback) {
      this.data = { ...this.data, ...next };
      if (callback) callback();
    },
    ...pageDef,
  };

  if (!Array.isArray(instance.data.primaryMapDirects) || instance.data.primaryMapDirects.length !== 3) {
    throw new Error("home page must keep three primary route entries for landscape layout");
  }
  if (!Array.isArray(instance.data.secondaryMapDirects) || instance.data.secondaryMapDirects.length < 1) {
    throw new Error("home page must keep secondary route entries");
  }
  instance.openAppDrawer.call(instance);
  if (!instance.data.showAppDrawer || instance.data.showMoreRoutes) {
    throw new Error("home page drawer did not open as the app shell entry");
  }
  instance.closeAppDrawer.call(instance);
  if (instance.data.showAppDrawer) {
    throw new Error("home page drawer did not close");
  }
  instance.showMoreRoutes.call(instance);
  if (!instance.data.showMoreRoutes || instance.data.showAppDrawer) {
    throw new Error("home page route sheet did not open independently");
  }
  instance.closeMoreRoutes.call(instance);
  if (instance.data.showMoreRoutes) {
    throw new Error("home page route sheet did not close");
  }

  instance.openMap.call(instance);
  const mapUrl = launched.at(-1) || "";
  if (!mapUrl.startsWith("/packages/map/pages/map/map?") || !mapUrl.includes("source=miniprogram") || !mapUrl.includes("ui=mobile")) {
    throw new Error("home page map FAB must open the native map with synchronized mobile query params");
  }
  if (appMock.globalData.lastMapDirective?.source !== "manual") {
    throw new Error("home page map FAB must seed the manual map directive");
  }

  instance.openMapDirect.call(instance, { currentTarget: { dataset: { index: 1 } } });
  const routeUrl = launched.at(-1) || "";
  if (!routeUrl.startsWith("/packages/map/pages/map/map?") || !routeUrl.includes("targetRoomId=202-5") || !routeUrl.includes("announce=summary%2Cdistance%2Cdirection%2CfloorChange")) {
    throw new Error("home page quick route must pass MapDirect route query params to the native map");
  }
  if (appMock.globalData.lastMapDirective?.request?.targetRoomId !== "202-5") {
    throw new Error("home page quick route must store the same MapDirect request for runtime bridge use");
  }

  instance.openChat.call(instance);
  if (launched.at(-1) !== "/pages/chat/chat") {
    throw new Error("home page chat entry must open the chat shell page");
  }
  instance.openExpert.call(instance);
  if (launched.at(-1) !== "/pages/expert/expert") {
    throw new Error("home page expert entry must open the expert shell page");
  }
}

smokeLoadHomePage();

const webMap = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/pages/map/map.wxml"), "utf8");
if (webMap.includes("<web-view") || webMap.includes("src=\"{{src}}\"") || webMap.includes("src='{{src}}'")) {
  throw new Error("map page must be native and must not use web-view");
}
for (const token of ["mapImageSrc", "mapImageTransformStyle", "map-static-fallback", "miniprogram-map-"]) {
  if (webMap.includes(token)) {
    throw new Error(`map page must not render packaged map images or fallback texture token: ${token}`);
  }
}
if (webMap.includes("map-native-start-bar") || webMap.includes("native-start-button")) {
  throw new Error("map page must not render invisible bottom shortcut hit zones in the default browsing state");
}
if (webMap.includes("mini-cover-rail") || webMap.includes("mini-cover-guidance") || webMap.includes("mini-cover-compass")) {
  throw new Error("map page must not keep the old large native cover overlay route");
}
for (const token of ["native-cover-ui", "native-shell-ui", "map-rail native-hot-rail", "map3d-guidance-strip", "material-panel", "panel-shade native-panel-hit-shade"]) {
  if (webMap.includes(token)) {
    throw new Error(`map page must not render duplicate native shell UI; remove token: ${token}`);
  }
}
for (const token of ["mp-map-rail", "mp-map-north", "mp-rail-button"]) {
  if (webMap.includes(token)) {
    throw new Error(`map page must not render stale WXML map controls; remove token: ${token}`);
  }
}
for (const token of ["mini-map-rail", "mini-route-guidance", "mini-map-panel", "data-panel=\"route\"", "data-panel=\"layers\"", "data-panel=\"view\"", "data-view=\"reset\"", "three-map-label-layer"]) {
  if (webMap.includes(token)) {
    throw new Error(`map page must not render duplicate native WXML HUD over WebGL canvas: ${token}`);
  }
}
for (const duplicatedLabel of [
  "<view>金工中心地图</view>",
  "<view>点终点，立即导引</view>",
  "<cover-view>待机</cover-view>"
]) {
  if (webMap.includes(duplicatedLabel)) {
    throw new Error(`map page must not duplicate runtime rail visible UI text: ${duplicatedLabel}`);
  }
}
if (!webMap.includes("id=\"mapCanvas\"") || !webMap.includes("type=\"webgl\"") || !webMap.includes("class=\"map-canvas native-map-visual native-webgl-map\"")) {
  throw new Error("map page must keep a real native WebGL canvas for runtime map rendering");
}
for (const token of ["native-map-page layer-{{layerMode}}", "catchtap=\"handlePageTap\"", "map-stage", "catchtouchmove=\"handleTouchMove\""]) {
  if (!webMap.includes(token)) {
    throw new Error(`map page must keep Three-host map token: ${token}`);
  }
}
for (const token of ["nativeFloors", "nativeSpaces", "nativeRooms", "nativeDoors", "nativeStairs", "nativeRouteSegments", "nativeRoutePins"]) {
  if (webMap.includes(token)) {
    throw new Error(`map page must not expose native polygon overlay token: ${token}`);
  }
}

const webMapJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/pages/map/map.js"), "utf8");
const webMapRuntimeJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/data/map-runtime.js"), "utf8");
const miniThreeScene = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/lib/three-map-scene.js"), "utf8");
const miniThreeVendor = fs.existsSync(path.join(root, "miniprogram/miniprogram/packages/map/vendor/three-platformize-runtime.js"))
  ? fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/vendor/three-platformize-runtime.js"), "utf8")
  : "";
for (const token of ["require(\"../../data/map-data\")", "require(\"../../data/map-runtime\")", "createMiniProgramThreeMap", "calculateRoute", "handleCanvasTap", "handlePageTap", "handleTouchMove", "handleRailOverlayTap", "rendererReadyClass", "railTapAction", "railButtonTops", "focusActiveStep", "advanceRouteCheckpoint", "allFloors", "exploded", "section", "104-2F01", "202-5", "108-2F04", "wx.reLaunch"]) {
  if (!(webMapJs + webMapRuntimeJs).includes(token)) {
    throw new Error(`native map runtime must keep synchronized token: ${token}`);
  }
}
for (const token of ["three-platformize-runtime", "WechatPlatform", "GLTFLoader", "OrbitControls", "CanvasTexture", "jingong.glb", "map-models", "semantic-room", "semantic-space", "stair-tread", "pickRoom", "dispatchTouchEvent"]) {
  if (!(webMapJs + miniThreeScene + miniThreeVendor).includes(token)) {
    throw new Error(`mini program must use shared Three/GLB scene token: ${token}`);
  }
}
const embeddedGlbModule = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/map-models/jingong-glb-data.js"), "utf8");
if (!embeddedGlbModule.includes("textureless: true")) {
  throw new Error("embedded mini program GLB must be textureless to avoid runtime texture fetch failures");
}
for (const token of ["ThomTh10.jpg", "ThomTh11.jpg", "Plaster_.png", "__L1.jpg", "____.jpg", "\"images\"", "\"textures\""]) {
  if (embeddedGlbModule.includes(token)) {
    throw new Error(`embedded mini program GLB must not reference external texture data: ${token}`);
  }
}
for (const token of ["addHudWidget", "labelMetrics", "drawLabelPill", "hudReservedBoxes", "boxesOverlap", "isCompactHud"]) {
  if (!miniThreeScene.includes(token)) {
    throw new Error(`mini program HUD must use bounded WebGL widgets, missing token: ${token}`);
  }
}
for (const token of ["drawPanel", "drawGuidance", "panelMetrics", "drawGuidanceLocal", "drawRailStackLocal", "drawNorthIndicatorLocal", "图层", "视角", "202 平台", "总览", "真北"]) {
  if (!miniThreeScene.includes(token)) {
    throw new Error(`Three HUD must own mobile map controls, missing token: ${token}`);
  }
}
if (!/const railTapActions = \[\s*\{ action: "back" \},\s*\{ panel: "route" \},\s*\{ panel: "layers" \},\s*\{ panel: "view" \},\s*\{ view: "reset" \}\s*\]/s.test(webMapJs)) {
  throw new Error("mini program map rail must keep the same five-button order as mobile: back, route, layers, view, overview");
}
for (const token of ["hudPlane", "new THREE.PlaneGeometry(hudWidth, hudHeight)", "drawWebglBaselineTexture"]) {
  if (miniThreeScene.includes(token)) {
    throw new Error(`mini program HUD must not use a full-screen transparent texture path: ${token}`);
  }
}
if (webMapJs.includes("webBaseUrl") || webMapJs.includes("127.0.0.1") || webMapJs.includes("localhost") || webMapJs.includes("canRenderWebView")) {
  throw new Error("map.js must not depend on web-view or local H5 URLs");
}
if (webMapJs.includes("wx.createCanvasContext")) {
  throw new Error("mini program map must not use legacy canvas contexts");
}
for (const token of ["debugProbe", "debugClearColor", "debugSnapshot"]) {
  if (webMapJs.includes(token)) {
    throw new Error(`map.js must not ship temporary WebGL diagnostics: ${token}`);
  }
}
for (const token of ["mapImageSrc", "mapImageTransformStyle", "miniprogram-map-", "createWebglTextureProgram", "drawWebglBaselineTexture", "ensureWebglMapTexture", "texImage2D", "createImage"]) {
  if (webMapJs.includes(token)) {
    throw new Error(`mini program map must not use packaged screenshot texture path: ${token}`);
  }
}
if (!webMapJs.includes("select(\"#mapCanvas\")") || !webMapJs.includes("createMiniProgramThreeMap")) {
  throw new Error("mini program map must mount the native WebGL canvas into the shared Three scene");
}
for (const file of [
  "miniprogram/miniprogram/packages/map/vendor/three-platformize-runtime.js",
  "miniprogram/miniprogram/packages/map/map-models/jingong.glb",
  "miniprogram/miniprogram/packages/map/map-models/jingong-glb-data.js",
  "miniprogram/miniprogram/packages/map/map-models/jingong-fallback.glb",
  "miniprogram/miniprogram/packages/map/map-models/model-manifest.json",
]) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`mini program must package runtime Three/model asset: ${file}`);
  }
}

if (parityMode) {
  const parityInputs = `${webMap}\n${webMapJs}\n${webMapRuntimeJs}\n${miniThreeScene}\n${miniThreeVendor}`;
  const hasThreeRuntime =
    parityInputs.includes("three-platformize") ||
    parityInputs.includes("createScopedThreejs") ||
    parityInputs.includes("GLTFLoader") ||
    parityInputs.includes("OrbitControls");
  if (!hasThreeRuntime) {
    throw new Error("parity/release check requires a real mini program Three.js runtime adapter; current native polygon renderer is not visually equivalent to H5/Tauri Map3DApp");
  }
if (webMap.includes("nativeRooms") || webMap.includes("nativeSpaces") || webMap.includes("nativeDoors") || webMap.includes("nativeRouteSegments")) {
    throw new Error("parity/release check forbids product-visible native polygon overlays; mini program must render the shared Three scene instead");
  }
  for (const token of ["CanvasTexture", "hudScene", "addHudWidget", "drawLabelPill"]) {
    if (!miniThreeScene.includes(token)) {
      throw new Error(`parity/release check requires WebGL-internal HUD token: ${token}`);
    }
  }
  if (!miniThreeScene.includes("jingong.glb") && !miniThreeScene.includes("map-models")) {
    throw new Error("parity/release check requires packaged model loading, not only semantic map-data polygons");
  }
}

function smokeLoadMapPage() {
  let pageDef;
  const mapPagePath = path.join(root, "miniprogram/miniprogram/packages/map/pages/map/map.js");
  const wxMock = {
    getWindowInfo: () => ({ windowWidth: 844, windowHeight: 390 }),
    getDeviceInfo: () => ({}),
    getStorageSync: () => "",
    nextTick: (fn) => { if (typeof fn === "function") fn(); },
    reLaunch: () => {},
    navigateBack: () => {},
    showToast: () => {},
    createSelectorQuery: () => ({
      in() { return this; },
      select() { return this; },
      fields() { return this; },
      exec(callback) {
        callback([
          {
            node: {
              width: 844,
              height: 390,
              getContext: () => ({}),
            },
            width: 844,
            height: 390,
          },
        ]);
      },
    }),
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
    if (resolved.endsWith("data/map-runtime")) {
      const module = { exports: {} };
      vm.runInNewContext(
        fs.readFileSync(`${resolved}.js`, "utf8"),
        { module, exports: module.exports },
        { filename: `${resolved}.js` },
      );
      return module.exports;
    }
    if (resolved.endsWith("lib/three-map-scene")) {
      return {
        createMiniProgramThreeMap: (_canvas, options = {}) => {
          const updates = [];
          options.onStatus?.({ ready: true, text: "" });
          options.onLabels?.([{ id: "mock-room-101", text: "101", variant: "room", x: 120, y: 80, visible: true }]);
          return {
            updates,
            update(next) {
              updates.push(next);
            },
            setSize() {},
            dispatchTouchEvent() {},
            rotate(delta) {
              updates.push({ rotate: delta });
            },
            pickRoom() {
              return "101";
            },
            dispose() {},
          };
        },
      };
    }
    if (resolved.endsWith("lib/backend-bridge")) {
      const module = { exports: {} };
      vm.runInNewContext(
        fs.readFileSync(`${resolved}.js`, "utf8"),
        { module, exports: module.exports, wx: wxMock, console },
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

  const assertThreeScene = (reason) => {
    if (!instance.threeMap) {
      throw new Error(`${reason}: Three scene was not mounted`);
    }
    if (!Array.isArray(instance.data.threeLabels) || instance.data.threeLabels.length < 1) {
      throw new Error(`${reason}: Three scene did not publish projected labels`);
    }
  };
  const setLayerAndAssert = (layer) => {
    instance.setLayer.call(instance, { currentTarget: { dataset: { layer } } });
    if (instance.data.layerMode !== layer) {
      throw new Error(`map layer switch did not select ${layer}`);
    }
    assertThreeScene(`map layer ${layer}`);
  };
  const assertRoute = (targetRoomId, requiredKind, reason) => {
    if (!instance.data.route || instance.data.route.targetRoomId !== targetRoomId) {
      throw new Error(`${reason}: route target mismatch`);
    }
    if (!instance.data.route.steps.some((step) => String(step.kind || "").includes(requiredKind))) {
      throw new Error(`${reason}: route steps did not include ${requiredKind}`);
    }
    if (!instance.data.route.nodeIds.includes(`center-${targetRoomId}`)) {
      throw new Error(`${reason}: route path did not reach the target room center`);
    }
  };
  const assertProgress = (reason) => {
    const progress = instance.emitNavigationProgress.call(instance, "status_requested", true);
    if (!progress || progress.type !== "navigation_progress") {
      throw new Error(`${reason}: map page did not emit navigation_progress`);
    }
    if (!progress.current?.nodeId || !progress.next?.nodeId || !progress.destination?.roomId) {
      throw new Error(`${reason}: navigation_progress missing structured route facts`);
    }
    if (!progress.guidance?.currentSegmentLabel || !progress.guidance?.canManualAdvance || !progress.guidance?.canVoiceAdvance) {
      throw new Error(`${reason}: navigation_progress missing shared guidance facts`);
    }
    if (!progress.heading?.status) {
      throw new Error(`${reason}: navigation_progress missing heading feedback`);
    }
    return progress;
  };

  instance.onLoad.call(instance, {});
  assertThreeScene("manual map open");
  if (instance.data.hasRoute || instance.data.route) {
    throw new Error("manual map open must start without a route");
  }
  setLayerAndAssert("2F");
  setLayerAndAssert("raised202");
  setLayerAndAssert("exploded");
  setLayerAndAssert("allFloors");

  instance.onLoad.call(instance, { targetRoomId: "202-5", announce: "summary,distance,direction,floorChange" });
  assertThreeScene("MapDirect 202-5");
  if (!instance.data.route || instance.data.route.targetRoomId !== "202-5") {
    throw new Error("map page smoke test did not generate a route for 202-5");
  }
  assertRoute("202-5", "stair", "MapDirect 202-5");
  assertProgress("MapDirect 202-5");
  if (!instance.data.route.nodeIds.includes("stair-public-upper") && !instance.data.route.nodeIds.includes("door-202-5")) {
    throw new Error("MapDirect 202-5 route must pass the public stair / 202 platform connector");
  }
  const railX = 844 - 12 - 28;
  instance.handlePageTap.call(instance, { detail: { x: railX, y: 195 } });
  if (instance.data.panel !== "layers") {
    throw new Error("map page right rail tap zone must open layers panel");
  }
  instance.closePanel.call(instance);
  instance.handlePageTap.call(instance, { detail: { x: railX, y: 257 } });
  if (instance.data.panel !== "view") {
    throw new Error("map page right rail tap zone must open view panel");
  }
  instance.closePanel.call(instance);
  instance.handlePageTap.call(instance, { detail: { x: 30, y: 342 } });
  if (instance.data.panel !== "layers") {
    throw new Error("map page guidance strip must open layers panel");
  }
  instance.closePanel.call(instance);
  instance.handlePageTap.call(instance, { detail: { x: 72, y: 342 } });
  if (instance.data.panel !== "view") {
    throw new Error("map page guidance strip must open view panel");
  }
  instance.closePanel.call(instance);
  instance.handleTouchStart.call(instance, { touches: [{ clientX: 100, clientY: 80 }] });
  instance.handleTouchMove.call(instance, { touches: [{ clientX: 128, clientY: 96 }] });
  instance.handleTouchStart.call(instance, { touches: [{ clientX: 100, clientY: 80 }, { clientX: 160, clientY: 80 }] });
  instance.handleTouchMove.call(instance, { touches: [{ clientX: 92, clientY: 76 }, { clientX: 176, clientY: 92 }] });
  instance.setViewPreset.call(instance, { currentTarget: { dataset: { view: "rotateRight" } } });
  instance.selectQuickTarget.call(instance, { currentTarget: { dataset: { id: "104-2F01" } } });
  assertRoute("104-2F01", "internal-stair", "manual 104-2F01 target");
  assertProgress("manual 104-2F01 target");
  if (!instance.data.route.nodeIds.some((nodeId) => nodeId.includes("104") && nodeId.includes("stair"))) {
    throw new Error("manual 104-2F01 target must pass a 104 internal stair node");
  }
  instance.selectQuickTarget.call(instance, { currentTarget: { dataset: { id: "108-2F04" } } });
  assertRoute("108-2F04", "internal-stair", "manual 108-2F04 target");
  assertProgress("manual 108-2F04 target");
  if (instance.data.route.nodeIds.some((nodeId) => nodeId.includes("public") || nodeId === "stair-public-upper")) {
    throw new Error("manual 108-2F04 target must not use the public stair");
  }
  instance.selectQuickTarget.call(instance, { currentTarget: { dataset: { id: "208" } } });
  assertRoute("208", "stair", "manual 208 target");
  assertProgress("manual 208 target");
  if (!instance.data.route.nodeIds.some((nodeId) => nodeId.includes("public"))) {
    throw new Error("manual 208 target must use the public stair connection");
  }
  instance.clearRoute.call(instance);
  if (instance.data.hasRoute || instance.data.route || instance.data.targetRoomId) {
    throw new Error("clearRoute must return the map to independent browsing state");
  }
}

smokeLoadMapPage();

const webMapWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/pages/map/map.wxss"), "utf8");
const threeMapScene = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/lib/three-map-scene.js"), "utf8");
for (const token of ["SEMANTIC_RENDER_POLICY", "doorThresholdLift", "routeKeyPinLift", "wallOverviewScale"]) {
  if (!threeMapScene.includes(token)) {
    throw new Error(`mini program Three scene must keep mobile semantic render policy token: ${token}`);
  }
}
if (/wall\.kind\s*===\s*[\"']outer[\"']\)\s*return\s*false/.test(threeMapScene)) {
  throw new Error("mini program must not hide second-floor outer walls in all-floors view.");
}
for (const token of ["position: fixed", ".native-map-page", ".map-backplate", ".map-stage", ".three-map-label-layer", ".three-map-label", ".label-route", ".label-stair", ".label-compact-room", ".map-canvas"]) {
  if (!webMapWxss.includes(token)) {
    throw new Error(`map.wxss must keep full-screen Three map styling: ${token}`);
  }
}
for (const token of [
  ".mp-map-rail",
  ".mp-map-north",
  ".mp-rail-button",
  ".mini-rail-button",
  ".mini-map-compass",
  ".native-map-hit-layer",
  ".native-floor",
  ".native-space",
  ".native-room",
  ".native-stair",
  ".native-door",
  ".native-route-segment",
  ".native-route-pin",
  ".native-shell-ui",
  ".native-cover-ui",
  ".map-rail",
  ".material-panel",
  ".map3d-guidance-strip",
]) {
  if (webMapWxss.includes(token)) {
    throw new Error(`map.wxss must not keep obsolete native overlay/control styling: ${token}`);
  }
}
for (const token of ["drawFixedHudLocal", "drawPanel", "drawRailStackLocal", "drawGuidanceLocal", "drawLabelPill"]) {
  if (!threeMapScene.includes(token)) {
    throw new Error(`mini program Three scene must own runtime HUD rendering: ${token}`);
  }
}
for (const token of [".map-static-fallback", ".renderer-canvas-ready .map-static-fallback", ".native-screenshot-owned-ui"]) {
  if (webMapWxss.includes(token)) {
    throw new Error(`map.wxss must not keep screenshot/fallback styling: ${token}`);
  }
}
for (const token of [".map-native-start-bar", ".native-start-button", ".native-start-copy", ".native-hot-start", ".map-start-card", ".start-target"]) {
  if (webMapWxss.includes(token)) {
    throw new Error(`map.wxss must not keep obsolete bottom shortcut styling: ${token}`);
  }
}
const canvasCssBlock = webMapWxss.match(/\.map-canvas\s*\{[^}]*\}/)?.[0] || "";
const canvasOwnsRuntimeWidth = /width:\s*100%/.test(canvasCssBlock) || (/right:\s*0/.test(canvasCssBlock) && /width:\s*auto/.test(canvasCssBlock));
if (!/display:\s*block/.test(canvasCssBlock) || !canvasOwnsRuntimeWidth || !/height:\s*100%/.test(canvasCssBlock) || !/opacity:\s*1\b/.test(canvasCssBlock) || !/pointer-events:\s*auto/.test(canvasCssBlock)) {
  throw new Error("map WebGL canvas must be the visible primary runtime renderer, not a hidden compatibility node");
}
const mapStageCssBlock = webMapWxss.match(/\.map-stage\s*\{[^}]*\}/)?.[0] || "";
if (!/right:\s*0/.test(mapStageCssBlock)) {
  throw new Error("map stage must keep the map surface pinned to the full viewport frame");
}
if (webMap.includes("three-map-label")) {
  throw new Error("Three labels must be rendered inside the WebGL HUD, not as WXML overlays");
}
if (webMap.includes("native-cover-ui") || webMap.includes("native-shell-ui") || webMap.includes("material-panel")) {
  throw new Error("map.wxml must not render duplicate native shell controls; Three HUD owns visible controls");
}

const miniMapDataJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/data/map-data.js"), "utf8");
if (miniMapDataJs.includes("require(\"./map-data.json\")") || miniMapDataJs.includes("require('./map-data.json')")) {
  throw new Error("WeChat runtime cannot require JSON here; map-data.js must inline the generated object");
}
const miniMapData = fs.readFileSync(path.join(root, "miniprogram/miniprogram/packages/map/data/map-data.json"), "utf8");
for (const token of ["Generated by scripts/generate-miniprogram-map-data.mjs", "src/features/map/data/mapData.ts", "rooms", "spaces", "doors", "stairs", "walls", "centerlines", "nodes", "edges", "202-5", "104-2F01", "108-2F04"]) {
  if (!miniMapData.includes(token) && !miniMapDataJs.includes(token)) {
    throw new Error(`map-data.js must keep synchronized map token: ${token}`);
  }
}
const miniMapModule = { exports: {} };
vm.runInNewContext(miniMapDataJs, { module: miniMapModule, exports: miniMapModule.exports }, { filename: "miniprogram/miniprogram/packages/map/data/map-data.js" });
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
const chatJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/chat/chat.js"), "utf8");
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
const expertJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/expert/expert.js"), "utf8");
if (!expertWxml.includes("../../assets/ui/robot-expert.png") || expertWxml.includes("src=\"/assets/")) {
  throw new Error("expert.wxml must use bundled relative assets");
}
for (const token of ["robot-expert.png", "response-page", "answer-zone", "keyword-row", "citation-strip", "response-rail"]) {
  if (!expertWxml.includes(token) && !expertWxss.includes(token)) {
    throw new Error(`expert page must keep mobile app response token: ${token}`);
  }
}

function smokeResponsePage(pageName, source, expectations) {
  let pageDef;
  const launched = [];
  const backed = [];
  const wxMock = {
    navigateBack({ delta, fail }) {
      backed.push(delta);
      fail?.();
    },
    reLaunch({ url }) {
      launched.push(url);
    },
  };
  const context = {
    console,
    wx: wxMock,
    Page: (definition) => { pageDef = definition; },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: `miniprogram/miniprogram/pages/${pageName}/${pageName}.js` });
  if (!pageDef) throw new Error(`${pageName} page smoke test did not register Page definition`);
  if (!pageDef.data?.answer || !Array.isArray(pageDef.data.keywords) || pageDef.data.keywords.length < 1) {
    throw new Error(`${pageName} page must provide a non-empty app-style default response`);
  }
  const defaultCopy = JSON.stringify(pageDef.data);
  for (const token of ["mock", "占位", "等待后端", "正式接入后", "用于验证"]) {
    if (defaultCopy.includes(token)) {
      throw new Error(`${pageName} page default copy must not expose unfinished implementation token: ${token}`);
    }
  }
  const instance = { ...pageDef };
  instance.goBack.call(instance);
  if (backed.at(-1) !== 1 || launched.at(-1) !== "/pages/home/home") {
    throw new Error(`${pageName} page back fallback must return to the standby shell`);
  }
  for (const [method, targetUrl] of Object.entries(expectations)) {
    instance[method].call(instance);
    if (launched.at(-1) !== targetUrl) {
      throw new Error(`${pageName} page ${method} must reLaunch ${targetUrl}`);
    }
  }
}

smokeResponsePage("chat", chatJs, {
  openMap: "/packages/map/pages/map/map?source=miniprogram&ui=mobile",
  openExpert: "/pages/expert/expert",
});
smokeResponsePage("expert", expertJs, {
  openMap: "/packages/map/pages/map/map?source=miniprogram&ui=mobile",
  openChat: "/pages/chat/chat",
});

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
  chatJs,
  expertJs,
].join("\n");
for (const token of ["5173", "127.0.0.1", "localhost", "webBaseUrl", "<web-view", "业务域名"]) {
  if (miniProgramText.includes(token)) {
    throw new Error(`mini program self-contained release must not include token: ${token}`);
  }
}
for (const token of ["本地 mock", "引用占位", "等待后端", "正式接入后", "用于验证小程序端", "后端调试", "联调入口"]) {
  if (miniProgramText.includes(token)) {
    throw new Error(`mini program product shell must not expose unfinished implementation copy: ${token}`);
  }
}

const scriptText = fs.readFileSync(new URL(import.meta.url), "utf8");
if (!scriptText.includes("self-contained release")) {
  throw new Error("verification script self-check failed");
}

console.log(releaseMode ? "Mini program release gate verified." : "Mini program shell verified.");
