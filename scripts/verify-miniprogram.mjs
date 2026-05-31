import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const releaseMode = process.argv.includes("--release") || process.env.MINIPROGRAM_RELEASE_CHECK === "1";
const requiredFiles = [
  "miniprogram/project.config.json",
  "miniprogram/miniprogram/app.json",
  "miniprogram/miniprogram/app.js",
  "miniprogram/miniprogram/pages/home/home.json",
  "miniprogram/miniprogram/pages/home/home.wxml",
  "miniprogram/miniprogram/pages/home/home.js",
  "miniprogram/miniprogram/pages/web-map/web-map.json",
  "miniprogram/miniprogram/pages/web-map/web-map.wxml",
  "miniprogram/miniprogram/pages/web-map/web-map.js",
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
const webBaseUrl = appJs.match(/webBaseUrl:\s*["']([^"']+)["']/)?.[1] ?? "";
if (!webBaseUrl) {
  throw new Error("app.js must define globalData.webBaseUrl");
}
const localWebBaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(?::|\/|$)/i.test(webBaseUrl);
if (releaseMode && (!webBaseUrl.startsWith("https://") || localWebBaseUrl)) {
  throw new Error("release check requires globalData.webBaseUrl to be a production HTTPS business-domain URL");
}

const appJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/miniprogram/app.json"), "utf8"));
const pages = new Set(appJson.pages || []);
for (const page of ["pages/home/home", "pages/web-map/web-map"]) {
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

const webMapJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/web-map/web-map.json"), "utf8"));
if (webMapJson.navigationStyle !== "custom") {
  throw new Error("web-map.json must use custom navigation style");
}
if (webMapJson.pageOrientation !== "landscape") {
  throw new Error("web-map.json must default to landscape");
}

const home = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.js"), "utf8");
for (const token of ["source: \"miniprogram\"", "ui: \"mobile\"", "targetRoomId", "announce", "104-2F01", "202-5", "108-2F04"]) {
  if (!home.includes(token)) {
    throw new Error(`home.js must include synchronized token: ${token}`);
  }
}
if (!home.includes("mapDirects")) {
  throw new Error("home.js must pass MapDirect query parameters to the web-view page");
}
for (const token of ["primaryMapDirects", "secondaryMapDirects", "showMoreRoutes", "showMapUnavailable", "canOpenWebMap"]) {
  if (!home.includes(token)) {
    throw new Error(`home.js must keep landscape route grouping: ${token}`);
  }
}

const homeWxml = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.wxml"), "utf8");
for (const token of ["primaryMapDirects", "secondaryMapDirects", "showMoreRoutes", "showMapUnavailable", "更多路线", "地图服务未连接", "HTTPS 业务域名"]) {
  if (!homeWxml.includes(token)) {
    throw new Error(`home.wxml must keep landscape route grouping: ${token}`);
  }
}

const homeWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.wxss"), "utf8");
for (const token of ["@media (orientation: landscape)", "grid-template-columns: repeat(3", ".route-sheet-mask", ".route-entry .entry-desc", "width: 100%"]) {
  if (!homeWxss.includes(token)) {
    throw new Error(`home.wxss must keep landscape touch layout token: ${token}`);
  }
}

const webMap = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/web-map/web-map.wxml"), "utf8");
if (!webMap.includes("<web-view") || !webMap.includes("bindmessage")) {
  throw new Error("web-map page must use web-view and bindmessage");
}
for (const token of ["canRenderWebView", "loadFailed", "地图暂未连接", "返回首页", "地图加载中", "地图服务未连接", "HTTPS 业务域名"]) {
  if (!webMap.includes(token)) {
    throw new Error(`web-map page must keep non-transparent failure state: ${token}`);
  }
}

const webMapJs = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/web-map/web-map.js"), "utf8");
for (const token of ["canRenderWebView", "127\\.0\\.0\\.1", "localhost"]) {
  if (!webMapJs.includes(token)) {
    throw new Error(`web-map.js must guard local dev web-view behavior: ${token}`);
  }
}

const webMapWxss = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/web-map/web-map.wxss"), "utf8");
for (const token of ["position: fixed", ".map-web-view", ".map-fallback", ".map-backdrop", ".map-loading"]) {
  if (!webMapWxss.includes(token)) {
    throw new Error(`web-map.wxss must keep full-screen web-view styling: ${token}`);
  }
}

console.log(releaseMode ? "Mini program release gate verified." : "Mini program shell verified.");
