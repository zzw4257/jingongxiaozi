import path from "node:path";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Mobile layout QA requires the optional Node package 'playwright'.");
  console.error("Install it locally when you want to run this script: npm install -D playwright");
  process.exit(1);
}

const root = process.cwd();
const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:5173/";
const screenshotDir = path.join(root, "qa", "screenshots");

const viewports = [
  { name: "phone-portrait", width: 390, height: 844 },
  { name: "kiosk-landscape", width: 844, height: 390 },
  { name: "robot-hd", width: 1280, height: 720 },
];

const panelButtons = [
  { name: "route", selector: 'button[title="路线"]', panel: ".material-panel" },
  { name: "layers", selector: 'button[title="图层"]', panel: ".material-panel" },
  { name: "view", selector: 'button[title="视角"]', panel: ".material-panel" },
  { name: "debug", selector: 'button[title="调试"]', panel: ".material-panel" },
];

function outside(rect, width, height) {
  return rect.x < -1 || rect.y < -1 || rect.x + rect.width > width + 1 || rect.y + rect.height > height + 1;
}

async function assertVisibleInViewport(page, selector, viewport, label) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`${viewport.name}/${label}: missing ${selector}`);
  if (outside(box, viewport.width, viewport.height)) {
    throw new Error(`${viewport.name}/${label}: ${selector} outside viewport ${JSON.stringify(box)}`);
  }
}

async function assertCanvasNonBlank(page, viewport) {
  const result = await page.locator(".map3d-canvas-host canvas").evaluate((canvas) => {
    const source = canvas;
    const context = source.getContext("webgl2") || source.getContext("webgl");
    if (!context) return { ok: false, reason: "no-webgl-context" };
    const width = Math.min(source.width, 48);
    const height = Math.min(source.height, 48);
    const pixels = new Uint8Array(width * height * 4);
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
    let varied = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] !== 244 || pixels[index + 1] !== 248 || pixels[index + 2] !== 253) varied += 1;
    }
    return { ok: varied > 20, varied };
  });
  if (!result.ok) throw new Error(`${viewport.name}/map: canvas appears blank ${JSON.stringify(result)}`);
}

const browser = await chromium.launch();
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(baseUrl);
    await page.waitForLoadState("networkidle");

    await assertVisibleInViewport(page, 'button[aria-label="打开地图导航"]', viewport, "standby-map-fab");
    await assertVisibleInViewport(page, 'button[aria-label="打开应用抽屉"]', viewport, "standby-drawer-handle");
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-standby.png`), fullPage: true });

    await page.locator('button[aria-label="打开应用抽屉"]').click();
    await assertVisibleInViewport(page, ".app-drawer-panel", viewport, "drawer");
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-drawer.png`), fullPage: true });
    await page.locator(".app-drawer-title .icon-button").click();

    await page.locator('button[aria-label="打开地图导航"]').click();
    await page.waitForSelector(".map3d-canvas-host canvas");
    await page.waitForTimeout(1000);
    await assertVisibleInViewport(page, ".map3d-rail", viewport, "map-rail");
    await assertVisibleInViewport(page, ".map3d-status-chip", viewport, "map-status");
    await assertCanvasNonBlank(page, viewport);
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-map.png`), fullPage: true });

    for (const panel of panelButtons) {
      await page.locator(panel.selector).click();
      await assertVisibleInViewport(page, panel.panel, viewport, panel.name);
      await assertVisibleInViewport(page, ".material-close", viewport, `${panel.name}-close`);
      await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-${panel.name}.png`), fullPage: true });
      await page.locator(".material-close").click();
    }

    await page.locator('button[title="返回"]').click();
    await page.locator('button[aria-label="打开应用抽屉"]').click();
    await page.getByText("对话展示").click();
    await assertVisibleInViewport(page, ".response-card", viewport, "chat-response");
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-chat.png`), fullPage: true });

    await page.locator('button[aria-label="打开应用抽屉"]').click();
    await page.getByText("专家问答").click();
    await assertVisibleInViewport(page, ".response-card", viewport, "expert-response");
    await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-expert.png`), fullPage: true });

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Mobile layout QA passed for ${viewports.length} viewports.`);
