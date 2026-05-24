import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "miniprogram/project.config.json",
  "miniprogram/miniprogram/app.json",
  "miniprogram/miniprogram/app.js",
  "miniprogram/miniprogram/pages/home/home.wxml",
  "miniprogram/miniprogram/pages/home/home.js",
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

const appJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram/miniprogram/app.json"), "utf8"));
const pages = new Set(appJson.pages || []);
for (const page of ["pages/home/home", "pages/web-map/web-map"]) {
  if (!pages.has(page)) throw new Error(`app.json does not declare page: ${page}`);
}

const home = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/home/home.js"), "utf8");
if (!home.includes("targetRoomId") || !home.includes("announce")) {
  throw new Error("home.js must pass MapDirect query parameters to the web-view page");
}

const webMap = fs.readFileSync(path.join(root, "miniprogram/miniprogram/pages/web-map/web-map.wxml"), "utf8");
if (!webMap.includes("<web-view") || !webMap.includes("bindmessage")) {
  throw new Error("web-map page must use web-view and bindmessage");
}

console.log("Mini program shell verified.");
