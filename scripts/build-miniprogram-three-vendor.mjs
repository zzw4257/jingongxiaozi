import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const entry = path.join(root, "src/miniprogram/three-vendor-entry.js");
const outfile = path.join(root, "miniprogram/miniprogram/vendor/three-platformize-runtime.js");

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
  minify: false,
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
fs.writeFileSync(outfile, bundle);

const stat = fs.statSync(outfile);
console.log(`Built ${path.relative(root, outfile)} (${Math.round(stat.size / 1024)} KiB)`);
