import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const entry = path.join(root, "src/miniprogram/three-vendor-entry.js");
const outfile = path.join(root, "miniprogram/miniprogram/packages/map/vendor/three-platformize-runtime.js");

fs.mkdirSync(path.dirname(outfile), { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2018"],
  legalComments: "none",
  logLevel: "info",
  minify: true,
  define: {
    global: "globalThis",
  },
});

let bundle = fs.readFileSync(outfile, "utf8");
bundle = bundle.replace(
  'useOffscreenCanvas = typeof $OffscreenCanvas !== "undefined" && new $OffscreenCanvas(1, 1).getContext("2d") !== null;',
  "useOffscreenCanvas = false;",
);
bundle = bundle.replace(
  'const contextNames = ["webgl2", "webgl", "experimental-webgl"];',
  'const contextNames = ["webgl", "experimental-webgl"];',
);
bundle = bundle.replace(
  'let i=wx.getSystemInfoSync(),s=i.platform==="android";',
  'let i=(()=>{let o=wx.getWindowInfo?wx.getWindowInfo():{},a=wx.getDeviceInfo?wx.getDeviceInfo():{};return{windowWidth:o.windowWidth||0,windowHeight:o.windowHeight||0,pixelRatio:o.pixelRatio||1,platform:a.platform||"devtools"}})(),s=i.platform==="android";',
);
bundle = bundle.replace(
  'let i=(()=>{let o=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync(),a=wx.getDeviceInfo?wx.getDeviceInfo():{};return{...o,platform:a.platform||o.platform}})(),s=i.platform==="android";',
  'let i=(()=>{let o=wx.getWindowInfo?wx.getWindowInfo():{},a=wx.getDeviceInfo?wx.getDeviceInfo():{};return{windowWidth:o.windowWidth||0,windowHeight:o.windowHeight||0,pixelRatio:o.pixelRatio||1,platform:a.platform||"devtools"}})(),s=i.platform==="android";',
);
bundle = bundle.replace(
  'var{platform:K_}=wx.getSystemInfoSync(),zt=class r extends Zi',
  'var K_=(wx.getDeviceInfo?wx.getDeviceInfo():{}).platform||"devtools",zt=class r extends Zi',
);
fs.writeFileSync(outfile, bundle);

const stat = fs.statSync(outfile);
console.log(`Built ${path.relative(root, outfile)} (${Math.round(stat.size / 1024)} KiB)`);
