const { THREE, WechatPlatform, GLTFLoader, OrbitControls } = require("../vendor/three-platformize-runtime");
const mapDataModule = require("../data/map-data");
const mapRuntimeModule = require("../data/map-runtime");

const mapData = mapDataModule.default || mapDataModule;
const mapRuntime = mapRuntimeModule.default || mapRuntimeModule;

const MAP_CENTER = [620, 360];
const MODEL_SCALE = 0.00815;
const FLOOR_HEIGHT = 0.92;
const EXPLODE_HEIGHT = 1.18;
const SLAB_THICKNESS = 0.045;
const WALL_HEIGHT = 0.38;
const OUTER_WALL_HEIGHT = 0.54;
const ROUTE_LIFT = 0.18;
const RAISED_202_HEIGHT = 0.46;
const raised202Polygon = [
  [620, 88],
  [1058, 88],
  [1058, 350],
  [620, 350],
];
const secondFloorSupportDecks = [
  {
    id: "2f-west-support",
    label: "108/208 承托区",
    semanticId: "2f-west-support",
    polygon: [
      [90, 70],
      [635, 70],
      [635, 345],
      [90, 345],
    ],
  },
  {
    id: "2f-public-corridor-support",
    label: "公共二层过道承托",
    semanticId: "2f-public-corridor-support",
    polygon: [
      [500, 190],
      [620, 190],
      [620, 272],
      [500, 272],
    ],
  },
  {
    id: "2f-106-support",
    label: "106 二层承托",
    semanticId: "2f-106-support",
    polygon: [
      [760, 15],
      [930, 15],
      [930, 95],
      [760, 95],
    ],
  },
  {
    id: "2f-104-support",
    label: "104 二层承托",
    semanticId: "2f-104-support",
    polygon: [
      [1050, 160],
      [1180, 160],
      [1180, 280],
      [1050, 280],
    ],
  },
  {
    id: "2f-east-service-support",
    label: "东侧服务承托",
    semanticId: "2f-east-service-support",
    polygon: [
      [920, 205],
      [1050, 205],
      [1050, 280],
      [920, 280],
    ],
  },
  {
    id: "2f-east-connector-support",
    label: "东侧过道承托",
    semanticId: "2f-east-connector-support",
    polygon: [
      [920, 160],
      [1050, 160],
      [1050, 245],
      [920, 245],
    ],
  },
  {
    id: "2f-office-support",
    label: "办公区承托",
    semanticId: "2f-office-support",
    polygon: [
      [235, 625],
      [520, 625],
      [520, 705],
      [235, 705],
    ],
  },
];
const semanticAnchors2F = [
  {
    offset: [-320, 95],
    match: (id) => id.includes("104-2F") || id.includes("stair-104-upper") || id.includes("stair-104-2f"),
  },
  {
    offset: [136.5, 210],
    match: (id) => id.includes("106-2F") || id.includes("stair-106-upper") || id.includes("stair-106-2f"),
  },
  {
    offset: [-14, 290],
    match: (id) =>
      id.includes("108-2F") ||
      id.includes("stair-108-upper") ||
      id.includes("stair-108-2f") ||
      ["208", "209", "c2-108", "c2-west"].some((token) => id.includes(token)),
  },
  {
    offset: [162.5, 290],
    match: (id) =>
      id.includes("stair-public-upper") ||
      id.includes("stair-public-2f") ||
      id.includes("201") ||
      id.includes("202") ||
      id.includes("raised-202") ||
      id.includes("restroom-2f-east") ||
      id.includes("c2-main") ||
      id.includes("c2-202") ||
      id.includes("2F-corridor-0") ||
      id.includes("2F-corridor-1"),
  },
];
const roomColor = {
  teaching: 0x78c96c,
  processing: 0xffa45f,
  lab: 0xb77fea,
  office: 0xffcd56,
  service: 0x67a8ff,
  other: 0xd7dde7,
};
const spaceColor = {
  corridor: 0xaee4ff,
  service: 0xc8ddff,
  restroom: 0xd6f4ea,
  storage: 0xe4e9f0,
  reserved: 0xf0e9d8,
  stair: 0xd3994e,
  void: 0xf4f6f8,
  room: 0xffffff,
};
const floorShellColor = {
  "1F": 0xf3eadb,
  "2F": 0xeef4fa,
};
const miniCameraPresets = {
  overview: {
    compactPosition: [6.62, 5.02, 7.35],
    compactTarget: [0.02, 0.82, 0.1],
    regularPosition: [6.45, 5.95, 8.55],
    regularTarget: [-0.02, 0.7, 0.16],
    compactFov: 32,
    regularFov: 34,
  },
  near: {
    compactPosition: [7.85, 7.35, 8.95],
    compactTarget: [0.06, 1.28, 0.08],
    regularPosition: [7.6, 7.0, 8.4],
    regularTarget: [0.02, 1.5, 0.12],
    compactFov: 37,
    regularFov: 42,
  },
  route: {
    compactPosition: [5.05, 6.05, 6.58],
    compactTarget: [0.02, 1.24, -0.04],
    regularPosition: [4.86, 5.62, 6.18],
    regularTarget: [0.08, 1.28, 0.02],
    compactFov: 35,
    regularFov: 32,
  },
  top: {
    compactPosition: [0, 11.4, 0.001],
    compactTarget: [0, 0.72, 0],
    regularPosition: [0, 11.4, 0.001],
    regularTarget: [0, 0.72, 0],
    compactFov: 30,
    regularFov: 32,
  },
  raised202: {
    compactPosition: [5.9, 6.9, 6.3],
    compactTarget: [2.42, 1.62, 1.0],
    regularPosition: [5.45, 6.8, 5.8],
    regularTarget: [2.82, 1.55, 1.1],
    compactFov: 35,
    regularFov: 34,
  },
};
const labelDensityRank = { far: 0, mid: 1, near: 2 };
const hudPixelRatioLimit = 2;
const hudLayoutRevision = "webgl-guidance-v7-safe-north";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createHudCanvas(width, height) {
  let canvas = null;
  try {
    if (typeof wx !== "undefined" && wx.createOffscreenCanvas) {
      canvas = wx.createOffscreenCanvas({ type: "2d", width, height });
    }
  } catch (error) {
    try {
      canvas = typeof wx !== "undefined" && wx.createOffscreenCanvas ? wx.createOffscreenCanvas() : null;
    } catch (_) {
      canvas = null;
    }
  }
  if (!canvas && typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(width, height);
  }
  if (!canvas && typeof document !== "undefined" && document.createElement) {
    canvas = document.createElement("canvas");
  }
  if (!canvas) return null;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cameraZoomFactor(preset, compact) {
  if (preset === "route") return compact ? 0.58 : 0.78;
  if (preset === "near") return compact ? 1.04 : 1.02;
  if (preset === "overview") return compact ? 0.92 : 0.9;
  return 1;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, color, lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

function ellipsize(ctx, text, maxWidth) {
  const raw = String(text || "");
  if (!raw) return "";
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  const suffix = "...";
  let value = raw;
  while (value.length > 1 && ctx.measureText(`${value}${suffix}`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}${suffix}`;
}

function drawText(ctx, text, x, y, options = {}) {
  const size = options.size || 12;
  const weight = options.weight || 900;
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.fillStyle = options.color || "#17253a";
  ctx.textAlign = options.align || "left";
  ctx.textBaseline = options.baseline || "middle";
  const value = options.maxWidth ? ellipsize(ctx, text, options.maxWidth) : String(text || "");
  ctx.fillText(value, x, y);
}

function drawLabelPill(ctx, label) {
  const width = label.boxW || 92;
  const height = label.boxH || 26;
  const x = label.x - width / 2;
  const y = label.y - height / 2;
  const palette = {
    route: { bg: "#0b6cff", border: "rgba(255,255,255,0.86)", text: "#ffffff", shadow: "rgba(11,108,255,0.28)" },
    stair: { bg: "rgba(255,232,188,0.95)", border: "rgba(191,119,28,0.56)", text: "#704100", shadow: "rgba(191,119,28,0.16)" },
    corridor: { bg: "rgba(223,248,255,0.94)", border: "rgba(48,143,189,0.48)", text: "#245672", shadow: "rgba(20,53,94,0.12)" },
    floor: { bg: "rgba(255,255,255,0.82)", border: "rgba(166,191,218,0.45)", text: "#31516f", shadow: "rgba(20,53,94,0.10)" },
    door: { bg: "#0b6cff", border: "rgba(255,255,255,0.88)", text: "#ffffff", shadow: "rgba(11,108,255,0.2)" },
    "compact-room": { bg: "rgba(255,255,255,0.92)", border: "rgba(173,190,213,0.78)", text: "#20344f", shadow: "rgba(20,53,94,0.11)" },
    note: { bg: "rgba(255,255,255,0.82)", border: "rgba(166,191,218,0.42)", text: "#31516f", shadow: "rgba(20,53,94,0.10)" },
    room: { bg: "rgba(255,255,255,0.94)", border: "rgba(166,191,218,0.54)", text: "#17253a", shadow: "rgba(20,53,94,0.15)" },
  };
  const style = label.variant === "route" && label.start
    ? { ...palette.route, bg: "#18a058", shadow: "rgba(24,160,88,0.24)" }
    : label.variant === "route" && label.target
      ? { ...palette.route, bg: "#ff3f6c", shadow: "rgba(255,63,108,0.24)" }
      : palette[label.variant] || palette.room;
  ctx.save();
  ctx.shadowColor = style.shadow;
  ctx.shadowBlur = label.variant === "route" ? 12 : 8;
  ctx.shadowOffsetY = label.variant === "route" ? 5 : 3;
  fillRoundRect(ctx, x, y, width, height, Math.min(999, height / 2), style.bg);
  ctx.shadowColor = "transparent";
  strokeRoundRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, Math.min(999, height / 2), style.border, 1);
  const compact = height <= 23 || width <= 64;
  drawText(ctx, label.text, label.x, label.y + 0.5, {
    color: style.text,
    size: compact ? 9 : label.variant === "compact-room" || label.variant === "door" ? 10 : 11,
    weight: 900,
    align: "center",
    maxWidth: width - (compact ? 10 : 14),
  });
  ctx.restore();
}

function panelMetrics(width, height, panelId = "route") {
  const compact = height < 260 || width < 520;
  const railReserve = compact ? 58 : 70;
  const expandedWidth = panelId === "layers"
    ? Math.min(500, Math.max(430, width - railReserve - 92))
    : panelId === "view"
      ? Math.min(252, Math.max(226, width * 0.28))
      : Math.min(344, Math.max(292, width * 0.38));
  const expandedHeight = panelId === "view"
    ? Math.min(330, Math.max(276, height - 54))
    : Math.min(360, Math.max(278, height - 24));
  const panelWidth = compact
    ? Math.min(252, Math.max(218, width - railReserve - 20))
    : Math.min(expandedWidth, Math.max(226, width - railReserve - 30));
  const panelHeight = compact
    ? panelId === "layers"
      ? Math.min(150, Math.max(132, height - 78))
      : Math.min(166, Math.max(148, height - 16))
    : expandedHeight;
  return {
    x: compact
      ? panelId === "layers"
        ? Math.max(12, Math.min(28, (width - railReserve - panelWidth) / 2))
        : 12
      : Math.max(16, width - railReserve - panelWidth - 16),
    y: compact
      ? panelId === "layers"
        ? 8
        : 8
      : panelId === "view" ? Math.max(18, Math.min(30, (height - panelHeight) / 2)) : 12,
    width: panelWidth,
    height: panelHeight,
  };
}

function railMetrics(width, height) {
  const compact = height < 260 || width < 520;
  const buttonW = compact ? 44 : 56;
  const buttonH = compact ? 32 : 56;
  const gap = 5;
  const total = buttonH * 5 + gap * 4;
  const rightSafe = compact ? 6 : 8;
  return {
    x: width - buttonW - rightSafe,
    y: clamp(height / 2 - total / 2, compact ? 4 : 14, Math.max(compact ? 4 : 14, height - total - 8)),
    width: buttonW,
    height: total,
  };
}

function railStackMetrics(width, height) {
  const compact = height < 260 || width < 520;
  const buttonW = compact ? 44 : 52;
  const buttonH = compact ? 32 : 52;
  const gap = compact ? 5 : 4;
  const total = buttonH * 5 + gap * 4;
  const rightSafe = compact ? 10 : 10;
  return {
    x: width - buttonW - rightSafe,
    y: clamp(height / 2 - total / 2, compact ? 8 : 16, Math.max(compact ? 8 : 16, height - total - 8)),
    width: buttonW,
    height: total,
    buttonW,
    buttonH,
    gap,
  };
}

function guidanceMetrics(width, height, hasRoute, safeInsets = {}) {
  if (!hasRoute) return null;
  const compact = height <= 430 && width >= height;
  const safeLeft = Math.max(0, Number(safeInsets.left || 0));
  const safeBottom = Math.max(0, Number(safeInsets.bottom || 0));
  const x = compact ? Math.max(10, safeLeft + 8) : Math.max(14, safeLeft + 8);
  const bottom = compact ? Math.max(10, safeBottom + 12) : Math.max(14, safeBottom + 14);
  const panelWidth = compact ? Math.min(214, Math.max(198, width * 0.25)) : Math.min(720, Math.max(430, width - 126));
  const panelHeight = compact ? 102 : 64;
  return {
    x,
    y: Math.max(8, height - panelHeight - bottom),
    width: Math.min(panelWidth, Math.max(168, width - x - (compact ? 10 : 14))),
    height: panelHeight,
  };
}

function labelMetrics(label) {
  const pad = label.variant === "route" ? 14 : 8;
  return {
    x: label.x - (label.boxW || 92) / 2 - pad,
    y: label.y - (label.boxH || 26) / 2 - pad,
    width: (label.boxW || 92) + pad * 2,
    height: (label.boxH || 26) + pad * 2,
  };
}

function drawGuidanceLocal(ctx, hud, width, height, fullWidth, fullHeight) {
  if (!hud.hasRoute) return;
  const compact = fullHeight <= 430 && fullWidth >= fullHeight;
  if (compact) {
    fillRoundRect(ctx, 0, 0, width, height, 20, "rgba(13,43,82,0.96)");
    strokeRoundRect(ctx, 0.5, 0.5, width - 1, height - 1, 20, "rgba(146,202,255,0.42)", 1);
    const stepSize = 34;
    fillRoundRect(ctx, 9, 13, stepSize, stepSize, stepSize / 2, "#1ac46d");
    drawText(ctx, hud.activeStepLabel || "1/1", 9 + stepSize / 2, 34, { color: "#ffffff", size: 10, weight: 950, align: "center", maxWidth: 28 });
    const currentX = 52;
    const nextX = 126;
    drawText(ctx, "当前", currentX, 19, { color: "#cfe0f5", size: 8.5, weight: 850, maxWidth: 42 });
    drawText(ctx, hud.currentStepTitle || "当前位置", currentX, 38, { color: "#ffffff", size: 9.5, weight: 950, maxWidth: 58 });
    drawText(ctx, "→", 112, 34, { color: "rgba(255,255,255,0.76)", size: 16, weight: 950, align: "center" });
    drawText(ctx, hud.nextStepVerb || "到门口", nextX, 19, { color: "#cfe0f5", size: 8.5, weight: 850, maxWidth: 60 });
    drawText(ctx, hud.nextStepTitle || "下一处", nextX, 38, { color: "#bfe0ff", size: 9.5, weight: 950, maxWidth: 68 });
    const chipY = 58;
    const chipH = 22;
    const chipW = 38;
    const chipGap = 5;
    const chips = [
      { label: "图层", fill: "rgba(255,255,255,0.13)", color: "#ffffff" },
      { label: "视角", fill: "rgba(255,255,255,0.13)", color: "#ffffff" },
      { label: "聚焦", fill: "rgba(255,255,255,0.13)", color: "#ffffff" },
      { label: hud.stepActionLabel || "到达", fill: "#ffffff", color: "#0d2a45" },
    ];
    chips.forEach((chip, index) => {
      const x = 10 + index * (chipW + chipGap);
      fillRoundRect(ctx, x, chipY, chipW, chipH, 11, chip.fill);
      drawText(ctx, chip.label, x + chipW / 2, chipY + 14, { color: chip.color, size: 8.5, weight: 950, align: "center", maxWidth: chipW - 6 });
    });
    fillRoundRect(ctx, 54, 84, 42, 16, 8, "rgba(255,255,255,0.13)");
    drawText(ctx, hud.currentStepDistance || "5m", 75, 95, { color: "#dbeaff", size: 8, weight: 850, align: "center", maxWidth: 34 });
    return;
  }
  const stepSize = compact ? 30 : 38;
  const stepY = (height - stepSize) / 2;
  const textBase = height / 2;
  fillRoundRect(ctx, 0, 0, width, height, 22, "rgba(13,43,82,0.95)");
  strokeRoundRect(ctx, 0.5, 0.5, width - 1, height - 1, 22, "rgba(146,202,255,0.52)", 1);
  fillRoundRect(ctx, compact ? 7 : 9, stepY, stepSize, stepSize, stepSize / 2, "#1ac46d");
  drawText(ctx, hud.activeStepLabel || "1/1", (compact ? 7 : 9) + stepSize / 2, textBase, { color: "#ffffff", size: compact ? 10 : 12, weight: 950, align: "center" });
  const currentX = compact ? 46 : 58;
  const arrowX = compact ? Math.min(width * 0.4, 178) : Math.min(width * 0.38, 238);
  const nextX = arrowX + (compact ? 18 : 22);
  const actionArea = compact ? 202 : 238;
  drawText(ctx, "当前位置", currentX, compact ? 17 : 20, { color: "#cfe0f5", size: compact ? 9 : 10, weight: 850, maxWidth: Math.max(56, arrowX - currentX - 18) });
  drawText(ctx, hud.currentStepTitle || "当前位置", currentX, compact ? 38 : 40, { color: "#ffffff", size: compact ? 11 : 13, weight: 950, maxWidth: Math.max(58, arrowX - currentX - 18) });
  drawText(ctx, "→", arrowX, textBase, { color: "rgba(255,255,255,0.72)", size: compact ? 16 : 18, weight: 950, align: "center" });
  drawText(ctx, hud.nextStepVerb || "到下一处", nextX, compact ? 17 : 20, { color: "#cfe0f5", size: compact ? 9 : 10, weight: 850, maxWidth: Math.max(58, width - actionArea - nextX) });
  drawText(ctx, hud.nextStepTitle || "选择终点", nextX, compact ? 38 : 40, { color: "#bfe0ff", size: compact ? 11 : 13, weight: 950, maxWidth: Math.max(58, width - actionArea - nextX) });
  const chipY = compact ? 18 : 12;
  const chipH = compact ? 28 : 38;
  const chipW = compact ? 40 : 48;
  const chipGap = compact ? 5 : 6;
  const chips = [
    { label: "图层", fill: "rgba(255,255,255,0.16)", color: "#ffffff" },
    { label: "视角", fill: "rgba(255,255,255,0.16)", color: "#ffffff" },
    { label: "聚焦", fill: "rgba(255,255,255,0.16)", color: "#ffffff" },
    { label: hud.stepActionLabel || "到达", fill: "#ffffff", color: "#0d2a45" },
  ];
  const actionLeft = width - chipW * chips.length - chipGap * (chips.length - 1) - (compact ? 7 : 12);
  chips.forEach((chip, index) => {
    const x = actionLeft + index * (chipW + chipGap);
    fillRoundRect(ctx, x, chipY, chipW, chipH, 19, chip.fill);
    drawText(ctx, chip.label, x + chipW / 2, textBase, { color: chip.color, size: compact ? 9 : 11, weight: 950, align: "center", maxWidth: chipW - 6 });
  });
}

function drawRailIcon(ctx, type, cx, cy, active) {
  ctx.save();
  ctx.strokeStyle = active ? "#ffffff" : "#20344f";
  ctx.fillStyle = active ? "#ffffff" : "#20344f";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (type === "back") {
    ctx.beginPath();
    ctx.moveTo(cx + 7, cy - 8);
    ctx.lineTo(cx - 5, cy);
    ctx.lineTo(cx + 7, cy + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.stroke();
  } else if (type === "route") {
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 6, 3, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy + 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 5);
    ctx.bezierCurveTo(cx - 2, cy - 12, cx + 6, cy - 4, cx + 4, cy + 3);
    ctx.stroke();
  } else if (type === "layers") {
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 7 + i * 6);
      ctx.lineTo(cx, cy - 12 + i * 6);
      ctx.lineTo(cx + 10, cy - 7 + i * 6);
      ctx.lineTo(cx, cy - 2 + i * 6);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (type === "view") {
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 4);
    ctx.lineTo(cx + 5, cy - 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 5, cy - 5, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const corners = [
      [-10, -10, -3, -10, -10, -3],
      [10, -10, 3, -10, 10, -3],
      [-10, 10, -3, 10, -10, 3],
      [10, 10, 3, 10, 10, 3],
    ];
    corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath();
      ctx.moveTo(cx + x1, cy + y1);
      ctx.lineTo(cx + x2, cy + y2);
      ctx.moveTo(cx + x1, cy + y1);
      ctx.lineTo(cx + x3, cy + y3);
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawRailStack(ctx, hud, width, height) {
  const rail = railStackMetrics(width, height);
  const compact = height < 260 || width < 520;
  const items = [
    { type: "back", label: "返回", active: false },
    { type: "route", label: "路线", active: hud.panel === "route" },
    { type: "layers", label: "图层", active: hud.panel === "layers" },
    { type: "view", label: "视角", active: hud.panel === "view" },
    { type: "reset", label: "总览", active: false },
  ];
  items.forEach((item, index) => {
    const x = rail.x;
    const y = rail.y + index * (rail.buttonH + rail.gap);
    const bg = item.active ? "#0b6cff" : "rgba(255,255,255,0.96)";
    const border = item.active ? "#0b6cff" : "rgba(194,211,232,0.92)";
    fillRoundRect(ctx, x, y, rail.buttonW, rail.buttonH, compact ? 16 : 20, bg);
    strokeRoundRect(ctx, x + 0.5, y + 0.5, rail.buttonW - 1, rail.buttonH - 1, compact ? 16 : 20, border, 1);
    drawRailIcon(ctx, item.type, x + rail.buttonW / 2, y + (compact ? 12 : 20), item.active);
    drawText(ctx, item.label, x + rail.buttonW / 2, y + rail.buttonH - (compact ? 8 : 11), {
      color: item.active ? "#ffffff" : "#20344f",
      size: compact ? 9 : 10,
      weight: 950,
      align: "center",
      maxWidth: rail.buttonW - 8,
    });
  });
}

function drawRailStackLocal(ctx, hud, width, height, metrics) {
  const compact = metrics.buttonH <= 36;
  const items = [
    { type: "back", label: "返回", active: false },
    { type: "route", label: "路线", active: hud.panel === "route" },
    { type: "layers", label: "图层", active: hud.panel === "layers" },
    { type: "view", label: "视角", active: hud.panel === "view" },
    { type: "reset", label: "总览", active: false },
  ];
  items.forEach((item, index) => {
    const x = 0;
    const y = index * (metrics.buttonH + metrics.gap);
    const bg = item.active ? "#0b6cff" : "rgba(255,255,255,0.96)";
    const border = item.active ? "#0b6cff" : "rgba(194,211,232,0.92)";
    fillRoundRect(ctx, x, y, metrics.buttonW, metrics.buttonH, compact ? 16 : 18, bg);
    strokeRoundRect(ctx, x + 0.5, y + 0.5, metrics.buttonW - 1, metrics.buttonH - 1, compact ? 16 : 18, border, 1);
    drawRailIcon(ctx, item.type, x + metrics.buttonW / 2, y + (compact ? 12 : 20), item.active);
    drawText(ctx, item.label, x + metrics.buttonW / 2, y + metrics.buttonH - (compact ? 8 : 11), {
      color: item.active ? "#ffffff" : "#20344f",
      size: compact ? 9 : 10,
      weight: 950,
      align: "center",
      maxWidth: metrics.buttonW - 8,
    });
  });
}

function drawNorthIndicator(ctx) {
  const x = 18;
  const y = 18;
  const w = 76;
  const h = 38;
  fillRoundRect(ctx, x, y, w, h, 19, "rgba(255,255,255,0.94)");
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 19, "rgba(181,202,228,0.86)", 1);
  fillRoundRect(ctx, x + 8, y + 7, 24, 24, 12, "#17253a");
  ctx.save();
  ctx.translate(x + 20, y + 19);
  ctx.rotate(-0.62);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawText(ctx, "真北", x + 40, y + 19, { color: "#20344f", size: 12, weight: 950, maxWidth: 30 });
}

function drawNorthIndicatorLocal(ctx) {
  const x = 0;
  const y = 0;
  const w = 76;
  const h = 38;
  fillRoundRect(ctx, x, y, w, h, 19, "rgba(255,255,255,0.94)");
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 19, "rgba(181,202,228,0.86)", 1);
  fillRoundRect(ctx, x + 8, y + 7, 24, 24, 12, "#17253a");
  ctx.save();
  ctx.translate(x + 20, y + 19);
  ctx.rotate(-0.62);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-5, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawText(ctx, "真北", x + 40, y + 19, { color: "#20344f", size: 12, weight: 950, maxWidth: 30 });
}

function drawFixedHudLocal(ctx, hud, width, height) {
  const safeLeft = Math.max(0, Number(hud.safeInsets?.left || 0));
  const safeTop = Math.max(0, Number(hud.safeInsets?.top || 0));
  const northX = Math.max(18, safeLeft + 14);
  const northY = Math.max(18, safeTop + 10);
  ctx.save();
  ctx.translate(northX, northY);
  drawNorthIndicatorLocal(ctx);
  ctx.restore();
  const guidance = guidanceMetrics(width, height, hud.hasRoute, hud.safeInsets);
  if (guidance) {
    ctx.save();
    ctx.translate(guidance.x, guidance.y);
    drawGuidanceLocal(ctx, hud, guidance.width, guidance.height, width, height);
    ctx.restore();
  }
}

function drawGuidance(ctx, hud, width, height) {
  if (!hud.hasRoute) return;
  const x = 12;
  const compact = height < 260 || width < 520;
  const h = compact ? 48 : 64;
  const y = height - (compact ? 58 : 76);
  const w = compact ? Math.min(198, Math.max(170, width * 0.48)) : Math.min(320, Math.max(224, width - 150));
  const stepSize = compact ? 36 : 42;
  const stepY = y + (h - stepSize) / 2;
  const textBase = y + h / 2;
  fillRoundRect(ctx, x, y, w, h, 18, "rgba(13,43,82,0.95)");
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 18, "rgba(146,202,255,0.52)", 1);
  fillRoundRect(ctx, x + 10, stepY, stepSize, stepSize, stepSize / 2, "#1ac46d");
  drawText(ctx, hud.activeStepLabel || "1/1", x + 10 + stepSize / 2, textBase, { color: "#ffffff", size: compact ? 12 : 13, weight: 950, align: "center" });
  drawText(ctx, "当前位置", x + (compact ? 52 : 62), y + (compact ? 14 : 20), { color: "#cfe0f5", size: compact ? 8 : 10, weight: 850, maxWidth: compact ? 50 : 92 });
  drawText(ctx, hud.currentStepTitle || "当前位置", x + (compact ? 52 : 62), y + (compact ? 31 : 40), { color: "#ffffff", size: compact ? 10 : 13, weight: 950, maxWidth: compact ? 54 : 94 });
  drawText(ctx, "→", x + (compact ? 111 : 166), textBase, { color: "rgba(255,255,255,0.72)", size: compact ? 14 : 18, weight: 950, align: "center" });
  const nextX = compact ? x + 136 : x + 178;
  drawText(ctx, hud.nextStepVerb || "到下一处", compact ? x + 122 : nextX, y + (compact ? 14 : 20), { color: "#cfe0f5", size: compact ? 8 : 10, weight: 850, maxWidth: compact ? 48 : 102 });
  drawText(ctx, hud.nextStepTitle || "选择终点", compact ? x + 122 : nextX, y + (compact ? 31 : 40), { color: "#bfe0ff", size: compact ? 10 : 13, weight: 950, maxWidth: compact ? 50 : 104 });
  if (!compact) {
    fillRoundRect(ctx, x + w - 156, y + 17, 46, 30, 15, "rgba(255,255,255,0.16)");
    drawText(ctx, hud.activeStepDistanceLabel || "--", x + w - 133, y + 32, { color: "#ffffff", size: 12, weight: 950, align: "center" });
  }
  const actionLeft = x + w - (compact ? 70 : 96);
  fillRoundRect(ctx, actionLeft, y + (compact ? 10 : 12), compact ? 36 : 42, compact ? 34 : 38, 19, "rgba(255,255,255,0.16)");
  drawText(ctx, "聚焦", actionLeft + (compact ? 18 : 21), textBase, { color: "#ffffff", size: compact ? 9 : 11, weight: 950, align: "center" });
  fillRoundRect(ctx, actionLeft + (compact ? 38 : 50), y + (compact ? 10 : 12), compact ? 30 : 42, compact ? 34 : 38, 19, "#ffffff");
  drawText(ctx, hud.stepActionLabel || "到达", actionLeft + (compact ? 53 : 71), textBase, { color: "#0d2a45", size: compact ? 9 : 11, weight: 950, align: "center", maxWidth: compact ? 27 : 36 });
}

function drawTile(ctx, x, y, w, h, title, subtitle, active = false) {
  fillRoundRect(ctx, x, y, w, h, 14, active ? "#0b6cff" : "#f4f8fc");
  strokeRoundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 14, active ? "#0b6cff" : "rgba(199,216,236,0.92)", 1);
  drawText(ctx, title, x + 12, y + 16, { color: active ? "#ffffff" : "#17253a", size: 12, weight: 950, maxWidth: w - 24 });
  drawText(ctx, subtitle, x + 12, y + 33, { color: active ? "rgba(255,255,255,0.78)" : "#657990", size: 9, weight: 850, maxWidth: w - 24 });
}

function drawPanel(ctx, hud, width, height) {
  if (!hud.panel || hud.panel === "none") return;
  const panel = panelMetrics(width, height, hud.panel);
  const compact = height < 260 || width < 520;
  fillRoundRect(ctx, panel.x, panel.y, panel.width, panel.height, compact ? 18 : 22, "#ffffff");
  strokeRoundRect(ctx, panel.x + 0.5, panel.y + 0.5, panel.width - 1, panel.height - 1, compact ? 18 : 22, "rgba(201,218,238,0.98)", 1);
  const panelTitle = hud.panel === "layers" ? "图层显示" : hud.panel === "view" ? "视角控制" : hud.panel === "room" ? "空间信息" : "路线引导";
  const meta = hud.panel === "route" ? (hud.routeDistanceLabel || "未选择终点") : hud.panel === "layers" ? "默认全楼" : hud.panel === "view" ? "触控平移缩放" : (hud.selectedFloorLabel || "点击地图房间");
  drawText(ctx, panelTitle, panel.x + 14, panel.y + (compact ? 20 : 24), { color: "#17253a", size: compact ? 13 : 15, weight: 950, maxWidth: panel.width - 90 });
  drawText(ctx, meta, panel.x + panel.width - 52, panel.y + (compact ? 20 : 24), { color: "#657990", size: compact ? 9 : 10, weight: 850, align: "right", maxWidth: 92 });
  fillRoundRect(ctx, panel.x + panel.width - 34, panel.y + (compact ? 9 : 12), compact ? 24 : 28, compact ? 24 : 28, 14, "#eef4fb");
  drawText(ctx, "×", panel.x + panel.width - (compact ? 22 : 24), panel.y + (compact ? 21 : 26), { color: "#2a3f58", size: compact ? 15 : 18, weight: 900, align: "center" });
  const contentY = panel.y + (compact ? 42 : 54);
  if (hud.panel === "layers") {
    const items = [
      ["全楼总览", "上下对应", "allFloors"],
      ["分层总览", "拉开楼层", "exploded"],
      ["一层", "门点走廊", "1F"],
      ["二层", "含承托", "2F"],
      ["202 平台", "平台+下方", "raised202"],
      ["剖切", "看跨层", "section"],
    ];
    const gap = compact ? 6 : 8;
    const tileW = (panel.width - (compact ? 28 : 40) - gap) / 2;
    const tileH = compact ? 32 : 40;
    const stepY = compact ? 36 : 48;
    items.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      drawTile(ctx, panel.x + (compact ? 12 : 16) + col * (tileW + gap), contentY + row * stepY, tileW, tileH, item[0], item[1], hud.layerMode === item[2]);
    });
    if (!compact) drawText(ctx, "202 平台不是空二层；剖切/分层只辅助理解跨层。", panel.x + 16, panel.y + panel.height - 18, { color: "#667990", size: 10, weight: 800, maxWidth: panel.width - 32 });
  } else if (hud.panel === "view") {
    const items = [
      ["总览", "整楼视角", "overview"],
      ["近看", "展开标签", "near"],
      ["路线", "聚焦导引", "route"],
      ["左转", "逆时针", "rotateLeft"],
      ["右转", "顺时针", "rotateRight"],
      ["复位", "回默认", "reset"],
    ];
    const gap = compact ? 6 : 8;
    const tileW = (panel.width - (compact ? 28 : 40) - gap) / 2;
    const tileH = compact ? 32 : 40;
    const stepY = compact ? 36 : 48;
    items.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      drawTile(ctx, panel.x + (compact ? 12 : 16) + col * (tileW + gap), contentY + row * stepY, tileW, tileH, item[0], item[1], hud.viewPreset === item[2]);
    });
    if (!compact) drawText(ctx, "单指旋转，双指缩放/平移；无传感器时显示模拟器提示。", panel.x + 16, panel.y + panel.height - 18, { color: "#667990", size: 10, weight: 800, maxWidth: panel.width - 32 });
  } else if (hud.panel === "room") {
    drawText(ctx, hud.selectedRoomTitle || "点击地图中的房间查看信息", panel.x + 16, contentY + 10, { color: "#17253a", size: 16, weight: 950, maxWidth: panel.width - 32 });
    drawText(ctx, hud.selectedRoomMeta || "路线会从房间中心到门点，再进入走廊或楼梯。", panel.x + 16, contentY + 38, { color: "#657990", size: 11, weight: 850, maxWidth: panel.width - 32 });
    if (hud.selectedRoomId) {
      fillRoundRect(ctx, panel.x + 16, panel.y + panel.height - 54, panel.width - 32, 38, 19, "#0b6cff");
      drawText(ctx, "导航到这里", panel.x + panel.width / 2, panel.y + panel.height - 35, { color: "#ffffff", size: 13, weight: 950, align: "center" });
    }
  } else {
    if (hud.hasRoute) {
      drawTile(ctx, panel.x + 16, contentY, panel.width - 32, 44, `${hud.routeStartLabel || "101"} → ${hud.routeTargetLabel || "终点"}`, hud.routeDistanceLabel || "路线", true);
      drawTile(ctx, panel.x + 16, contentY + 52, panel.width - 32, 44, `${hud.currentStepTitle || "当前位置"} → ${hud.nextStepTitle || "下一处"}`, hud.activeStepDistanceLabel || "--", false);
      const buttonY = contentY + 108;
      const bw = (panel.width - 48) / 3;
      [["上一步", "prev"], ["聚焦", "focus"], [hud.stepActionLabel || "到达", "next"]].forEach((item, index) => {
        drawTile(ctx, panel.x + 16 + index * (bw + 8), buttonY, bw, 38, item[0], "", item[1] === "next");
      });
    } else {
      drawText(ctx, "选择终点后导引", panel.x + 16, contentY + 14, { color: "#17253a", size: 15, weight: 950, maxWidth: panel.width - 32 });
      drawText(ctx, "默认从 101 出发，按门、走廊、楼梯逐段提示。", panel.x + 16, contentY + 38, { color: "#657990", size: 11, weight: 850, maxWidth: panel.width - 32 });
    }
    const targets = [
      ["104", "104-2F01"],
      ["202-5", "202-5"],
      ["108", "108-2F04"],
      ["208", "208"],
    ];
    const quickY = panel.y + panel.height - 54;
    const tw = (panel.width - 40 - 18) / 4;
    targets.forEach((item, index) => {
      drawTile(ctx, panel.x + 16 + index * (tw + 6), quickY, tw, 38, item[0], "", hud.targetRoomId === item[1]);
    });
  }
}

function withOpacity(mat, opacity) {
  mat.transparent = opacity < 1;
  mat.opacity = opacity;
  mat.depthWrite = opacity >= 0.78;
  mat.needsUpdate = true;
  return mat;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const last = polygon[previous];
    const crosses =
      current[1] > point[1] !== last[1] > point[1] &&
      point[0] < ((last[0] - current[0]) * (point[1] - current[1])) / (last[1] - current[1]) + current[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function isRaised202Point(point, floor) {
  return floor === "2F" && pointInPolygon(point, raised202Polygon);
}

function isRaised202Room(roomId) {
  return Boolean(roomId && roomId.startsWith("202"));
}

function polygonCenter(polygon) {
  return polygon.reduce((acc, point) => [acc[0] + point[0] / polygon.length, acc[1] + point[1] / polygon.length], [0, 0]);
}

function boundsFromPolygon(polygon) {
  return polygon.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point[0]),
      maxX: Math.max(acc.maxX, point[0]),
      minY: Math.min(acc.minY, point[1]),
      maxY: Math.max(acc.maxY, point[1]),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function floorBaseY(floor, layerMode) {
  if (layerMode === "single") return floor === "2F" ? FLOOR_HEIGHT : 0.08;
  if (layerMode === "raised202") return FLOOR_HEIGHT;
  if (layerMode === "exploded" && floor === "2F") return FLOOR_HEIGHT + EXPLODE_HEIGHT;
  return floor === "2F" ? FLOOR_HEIGHT : 0.08;
}

function floorOffsetXZ(floor, layerMode) {
  if (layerMode === "exploded") return floor === "2F" ? [-0.46, -0.38] : [0.16, 0.13];
  return [0, 0];
}

function anchoredFloorPoint(point, floor, semanticId = "") {
  if (floor !== "2F" || !semanticId) return point;
  const anchor = semanticAnchors2F.find((candidate) => candidate.match(semanticId));
  return anchor ? [point[0] + anchor.offset[0], point[1] + anchor.offset[1]] : point;
}

function mapPointToModel(point, floor, options = {}) {
  const layerMode = options.layerMode || "allFloors";
  const [offsetX, offsetZ] = floorOffsetXZ(floor, layerMode);
  const anchored = anchoredFloorPoint(point, floor, options.semanticId || "");
  const raisedLift = isRaised202Point(point, floor) ? RAISED_202_HEIGHT : 0;
  return new THREE.Vector3(
    (anchored[0] - MAP_CENTER[0]) * MODEL_SCALE + offsetX,
    floorBaseY(floor, layerMode) + (options.lift || 0) + raisedLift,
    (anchored[1] - MAP_CENTER[1]) * MODEL_SCALE + offsetZ,
  );
}

function shapeFromPolygon(polygon, floor, layerMode, semanticId) {
  const first = mapPointToModel(polygon[0], floor, { layerMode, semanticId });
  const shape = new THREE.Shape();
  shape.moveTo(first.x, first.z);
  polygon.slice(1).forEach((point) => {
    const mapped = mapPointToModel(point, floor, { layerMode, semanticId });
    shape.lineTo(mapped.x, mapped.z);
  });
  shape.closePath();
  return shape;
}

function extrudedPolygonMesh(polygon, floor, layerMode, height, material, lift = 0, semanticId) {
  const geometry = new THREE.ExtrudeGeometry(shapeFromPolygon(polygon, floor, layerMode, semanticId), {
    depth: height,
    bevelEnabled: false,
  });
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = floorBaseY(floor, layerMode) + lift;
  mesh.receiveShadow = true;
  return mesh;
}

function material(options) {
  return new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0.02,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    depthWrite: (options.opacity ?? 1) >= 0.76,
  });
}

function semanticPlaneMaterial(options) {
  return new THREE.MeshBasicMaterial({
    color: options.color,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    depthWrite: (options.opacity ?? 1) >= 0.72,
    side: THREE.DoubleSide,
  });
}

function tubeBetween(a, b, radius, mat) {
  const curve = new THREE.LineCurve3(a, b);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 8, false), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeDisc(position, radius, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.018, 36), mat);
  mesh.position.copy(position);
  mesh.rotation.x = Math.PI / 2;
  mesh.name = "route-ground-disc";
  return mesh;
}

function makeBeaconRing(position, radius, color, opacity = 0.76) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.022, 12, 58),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
  );
  mesh.position.copy(position);
  mesh.rotation.x = Math.PI / 2;
  mesh.name = "route-beacon-ring";
  return mesh;
}

function addPolygonOutline(root, polygon, floor, layerMode, semanticId, lift, radius, mat, name) {
  if (!polygon || polygon.length < 2) return;
  const points = [...polygon, polygon[0]].map((point) => mapPointToModel(point, floor, { layerMode, semanticId, lift }));
  for (let index = 1; index < points.length; index += 1) {
    const edge = tubeBetween(points[index - 1], points[index], radius, mat.clone ? mat.clone() : mat);
    edge.name = `${name || semanticId || "outline"}-${index - 1}`;
    root.add(edge);
  }
}

function addDirectionalArrow(root, from, to, mat, scale = 1) {
  const direction = to.clone().sub(from);
  if (direction.length() < 0.18) return;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.18 * scale, 22), mat);
  cone.position.copy(from.clone().lerp(to, 0.62));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  cone.name = "route-direction-arrow";
  root.add(cone);
}

function orientedBox(center, length, height, width, angle, mat, name) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), mat);
  mesh.position.copy(center);
  mesh.rotation.y = angle;
  mesh.name = name || "";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function stairBasis(a, b) {
  const horizontal = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
  if (horizontal.lengthSq() < 0.0001) horizontal.set(1, 0, 0);
  horizontal.normalize();
  const side = new THREE.Vector3(-horizontal.z, 0, horizontal.x);
  const angle = -Math.atan2(horizontal.z, horizontal.x);
  return { horizontal, side, angle };
}

function addStairPair(root, a, b, active, publicAccess) {
  const { horizontal, side, angle } = stairBasis(a, b);
  const horizontalDistance = Math.max(0.5, new THREE.Vector3(b.x - a.x, 0, b.z - a.z).length());
  const verticalDistance = Math.max(0.32, Math.abs(b.y - a.y));
  const stepCount = publicAccess ? 14 : 10;
  const run = Math.max(0.13, horizontalDistance / stepCount);
  const rise = verticalDistance / stepCount;
  const stairWidth = publicAccess ? 0.74 : 0.54;
  const treadMat = material({
    color: active ? 0xffa000 : publicAccess ? 0x8a9bad : 0xb68b57,
    emissive: active ? 0xb85d00 : 0x000000,
    emissiveIntensity: active ? 0.46 : 0,
    opacity: active ? 1 : 0.76,
  });
  const riserMat = material({ color: active ? 0xd77600 : publicAccess ? 0x6d7f91 : 0x8e6840, opacity: active ? 1 : 0.72 });
  const landingMat = material({ color: active ? 0xffb33c : publicAccess ? 0xb8c4d0 : 0xcaa06a, opacity: active ? 1 : 0.82 });
  const railMat = material({ color: active ? 0xffc45a : publicAccess ? 0x53657a : 0x6d5135, opacity: active ? 1 : 0.7 });
  const center = a.clone().lerp(b, 0.5);
  root.add(orientedBox(a.clone().add(new THREE.Vector3(0, 0.03, 0)), stairWidth * 1.18, 0.07, stairWidth * 0.92, angle, landingMat.clone(), "stair-lower-platform"));
  root.add(orientedBox(b.clone().add(new THREE.Vector3(0, 0.03, 0)), stairWidth * 1.18, 0.07, stairWidth * 0.92, angle, landingMat.clone(), "stair-upper-platform"));
  root.add(orientedBox(center.clone().add(new THREE.Vector3(0, -verticalDistance * 0.18, 0)), horizontalDistance * 1.02, Math.max(0.18, verticalDistance * 0.52), stairWidth * 1.12, angle, material({ color: publicAccess ? 0x526173 : 0x6f4d2e, opacity: active ? 0.82 : 0.42 }), "stair-open-shaft"));
  for (let index = 0; index < stepCount; index += 1) {
    const ratio = (index + 0.5) / stepCount;
    const stepCenter = a.clone().lerp(b, ratio);
    stepCenter.y = Math.min(a.y, b.y) + rise * (index + 0.5);
    root.add(orientedBox(stepCenter.clone().add(new THREE.Vector3(0, 0.018, 0)), run * 0.96, 0.044, stairWidth, angle, treadMat.clone(), `stair-tread-${index}`));
    const riserCenter = stepCenter.clone().sub(horizontal.clone().multiplyScalar(run * 0.45));
    riserCenter.y -= Math.max(0.01, rise * 0.28);
    root.add(orientedBox(riserCenter, 0.018, Math.max(0.035, rise * 0.7), stairWidth * 0.96, angle, riserMat.clone(), `stair-riser-${index}`));
  }
  const railOffset = side.clone().multiplyScalar(stairWidth * 0.58);
  const railLift = new THREE.Vector3(0, 0.22, 0);
  root.add(tubeBetween(a.clone().add(railOffset).add(railLift), b.clone().add(railOffset).add(railLift), active ? 0.026 : 0.018, railMat.clone()));
  root.add(tubeBetween(a.clone().sub(railOffset).add(railLift), b.clone().sub(railOffset).add(railLift), active ? 0.026 : 0.018, railMat.clone()));
}

function supportDeckGeometry(layerMode, deck, mat, edgeMat) {
  const root = new THREE.Group();
  const focused = layerMode === "2F" || layerMode === "exploded";
  const mesh = extrudedPolygonMesh(deck.polygon, "2F", layerMode, focused ? 0.044 : 0.028, mat, SLAB_THICKNESS + 0.006, deck.semanticId);
  mesh.name = deck.id;
  mesh.receiveShadow = true;
  root.add(mesh);
  addPolygonOutline(root, deck.polygon, "2F", layerMode, deck.semanticId, SLAB_THICKNESS + (focused ? 0.08 : 0.055), focused ? 0.012 : 0.008, edgeMat, `${deck.id}-edge`);
  return root;
}

function raisedPlatformRim(layerMode, mat) {
  const root = new THREE.Group();
  const focus = layerMode === "raised202";
  const points = raised202Polygon;
  points.forEach((from, index) => {
    const to = points[(index + 1) % points.length];
    const lower = mapPointToModel(from, "2F", { layerMode, semanticId: "raised-202-rim", lift: SLAB_THICKNESS + 0.04 });
    const upperStart = mapPointToModel(from, "2F", { layerMode, semanticId: "raised-202-rim", lift: SLAB_THICKNESS + RAISED_202_HEIGHT + 0.04 });
    const upperEnd = mapPointToModel(to, "2F", { layerMode, semanticId: "raised-202-rim", lift: SLAB_THICKNESS + RAISED_202_HEIGHT + 0.04 });
    root.add(tubeBetween(upperStart, upperEnd, focus ? 0.018 : 0.012, mat.clone()));
    if (index % 2 === 0 || focus) root.add(tubeBetween(lower, upperStart, focus ? 0.011 : 0.008, mat.clone()));
  });
  return root;
}

function raisedPlatformBoundaryWall(layerMode, mat) {
  const root = new THREE.Group();
  const focus = layerMode === "raised202";
  const height = focus ? 0.18 : 0.13;
  const thickness = focus ? 0.046 : 0.032;
  raised202Polygon.forEach((fromPoint, index) => {
    const toPoint = raised202Polygon[(index + 1) % raised202Polygon.length];
    const from = mapPointToModel(fromPoint, "2F", { layerMode, semanticId: "raised-202-boundary", lift: SLAB_THICKNESS + RAISED_202_HEIGHT + height / 2 });
    const to = mapPointToModel(toPoint, "2F", { layerMode, semanticId: "raised-202-boundary", lift: SLAB_THICKNESS + RAISED_202_HEIGHT + height / 2 });
    const length = from.distanceTo(to);
    if (length < 0.001) return;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), mat.clone());
    wall.position.copy(from.clone().add(to).multiplyScalar(0.5));
    wall.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);
    wall.name = `raised-202-boundary-wall-${index}`;
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);
  });
  return root;
}

function raisedPlatformLowerContext(layerMode) {
  const root = new THREE.Group();
  const detailed = layerMode === "raised202" || layerMode === "exploded" || layerMode === "2F";
  const supportMat = material({ color: detailed ? 0xd5c6ad : 0xc8b89f, opacity: detailed ? 1 : 0.86 });
  const surface = extrudedPolygonMesh(
    raised202Polygon,
    "2F",
    layerMode,
    detailed ? 0.052 : 0.042,
    material({ color: detailed ? 0xe6dac4 : 0xdacdb8, opacity: detailed ? 1 : 0.86 }),
    SLAB_THICKNESS + 0.006,
    "202-lower-context",
  );
  surface.name = "raised-202-lower-context-surface";
  root.add(surface);
  addPolygonOutline(root, raised202Polygon, "2F", layerMode, "202-lower-context", SLAB_THICKNESS + 0.078, detailed ? 0.02 : 0.014, supportMat, "raised-202-lower-context-edge");
  if (!detailed) return root;

  const box = boundsFromPolygon(raised202Polygon);
  const ribMat = withOpacity(supportMat.clone(), 0.72);
  for (let y = box.minY + 44; y < box.maxY - 18; y += 52) {
    const a = mapPointToModel([box.minX + 18, y], "2F", { layerMode, semanticId: "202-lower-context", lift: SLAB_THICKNESS + 0.095 });
    const b = mapPointToModel([box.maxX - 18, y], "2F", { layerMode, semanticId: "202-lower-context", lift: SLAB_THICKNESS + 0.095 });
    root.add(tubeBetween(a, b, 0.011, ribMat.clone()));
  }
  for (let x = box.minX + 64; x < box.maxX - 18; x += 78) {
    const a = mapPointToModel([x, box.minY + 18], "2F", { layerMode, semanticId: "202-lower-context", lift: SLAB_THICKNESS + 0.098 });
    const b = mapPointToModel([x, box.maxY - 18], "2F", { layerMode, semanticId: "202-lower-context", lift: SLAB_THICKNESS + 0.098 });
    root.add(tubeBetween(a, b, 0.008, ribMat.clone()));
  }
  raised202Polygon.forEach((point, index) => {
    if (index % 2 !== 0) return;
    const lower = mapPointToModel(point, "2F", { layerMode, semanticId: "202-lower-context", lift: SLAB_THICKNESS + 0.075 });
    const upper = lower.clone().add(new THREE.Vector3(0, RAISED_202_HEIGHT * 0.72, 0));
    root.add(tubeBetween(lower, upper, 0.017, supportMat.clone()));
  });
  return root;
}

function floorVisible(floor, layerMode) {
  if (layerMode === "raised202") return floor === "2F";
  if (layerMode === "1F") return floor === "1F";
  if (layerMode === "2F") return floor === "2F";
  return true;
}

function semanticRaised(semanticId = "", point, polygon) {
  return (
    semanticId.includes("202") ||
    semanticId.includes("c2-202") ||
    semanticId.includes("2F-corridor-1") ||
    (point && isRaised202Point(point, "2F")) ||
    (polygon && polygon.filter((item) => isRaised202Point(item, "2F")).length / Math.max(1, polygon.length) > 0.65)
  );
}

function visibleForLayer(floor, layerMode, options = {}) {
  if (!floorVisible(floor, layerMode)) return false;
  if (layerMode === "raised202") {
    return floor === "2F" && semanticRaised(options.semanticId || options.roomId || "", options.point, options.polygon);
  }
  return true;
}

function visibleSupportDecksForLayer(layerMode) {
  if (!floorVisible("2F", layerMode)) return [];
  if (layerMode === "raised202" || layerMode === "section") return [];
  if (layerMode === "allFloors") return [];
  return secondFloorSupportDecks;
}

function supportDeckLabel(deck) {
  if (deck.id === "2f-west-support") return "108承托";
  if (deck.id === "2f-public-corridor-support") return "过道承托";
  if (deck.id === "2f-106-support") return "106承托";
  if (deck.id === "2f-104-support") return "104承托";
  if (deck.id === "2f-east-service-support") return "服务承托";
  if (deck.id === "2f-east-connector-support") return "东侧过道";
  return "办公承托";
}

function routePointVisible(point, layerMode) {
  return visibleForLayer(point.floor, layerMode, { point: point.point, semanticId: point.nodeId });
}

function routePointToVector(point, layerMode) {
  const boost = layerMode === "allFloors" ? 0.18 : layerMode === "raised202" ? 0.12 : 0;
  return mapPointToModel(point.point, point.floor, {
    layerMode,
    semanticId: point.nodeId,
    lift: ROUTE_LIFT + boost,
  });
}

function roomLabel(room) {
  if (!room) return "";
  if (room.roomNo === room.name) return room.roomNo;
  return `${room.roomNo} ${room.name}`;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    const mat = child.material;
    const disposeMaterial = (item) => {
      if (!item) return;
      if (item.map && item.map.dispose) item.map.dispose();
      if (item.dispose) item.dispose();
    };
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else disposeMaterial(mat);
  });
}

function createMiniProgramThreeMap(canvas, options = {}) {
  options.onStatus && options.onStatus({ ready: false, text: "初始化 Three 地图…" });
  let renderWidth = Math.max(1, Math.floor(options.width || canvas.width || 844));
  let renderHeight = Math.max(1, Math.floor(options.height || canvas.height || 390));
  const dpr = Math.min(options.pixelRatio || 1, 2);
  const platform = new WechatPlatform(canvas, renderWidth, renderHeight);
  THREE.PLATFORM.set(platform);

  const glContext = options.context || (canvas.getContext ? canvas.getContext("webgl") || canvas.getContext("experimental-webgl") : null);
  const renderer = new THREE.WebGLRenderer({ canvas, context: glContext, antialias: false, alpha: false });
  renderer.autoClear = false;
  renderer.setPixelRatio(dpr);
  renderer.setSize(renderWidth, renderHeight, false);
  renderer.shadowMap.enabled = false;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f9fc);
  scene.fog = new THREE.Fog(0xf7f9fc, 24, 58);
  const camera = new THREE.PerspectiveCamera(34, renderWidth / renderHeight, 0.05, 220);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 1.08;
  controls.panSpeed = 0.96;
  controls.minDistance = 1.35;
  controls.maxDistance = 42;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  scene.add(new THREE.HemisphereLight(0xffffff, 0x879ab2, 1.14));
  const sun = new THREE.DirectionalLight(0xffffff, 0.96);
  sun.position.set(4, 9, 6);
  sun.castShadow = true;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9fc8ff, 0.34);
  fill.position.set(-6, 4, -5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.28);
  rim.position.set(-3, 6, 8);
  scene.add(rim);

  const modelGroup = new THREE.Group();
  modelGroup.name = "mini-runtime-model-root";
  modelGroup.visible = true;
  scene.add(modelGroup);
  let semanticRoot = new THREE.Group();
  let routeRoot = new THREE.Group();
  scene.add(semanticRoot);
  scene.add(routeRoot);
  let state = {
    layerMode: options.layerMode || "allFloors",
    route: options.route || null,
    activeStepIndex: options.activeStepIndex || 0,
    targetRoomId: options.targetRoomId || options.route?.targetRoomId || "",
    panel: options.panel || "none",
    viewPreset: options.viewPreset || "overview",
    sensorHint: options.sensorHint || "模拟器无传感器",
    activeStepLabel: options.activeStepLabel || "1/1",
    currentStepTitle: options.currentStepTitle || "当前位置",
    nextStepVerb: options.nextStepVerb || "下一处",
    nextStepTitle: options.nextStepTitle || "选择终点",
    activeStepDistanceLabel: options.activeStepDistanceLabel || "--",
    stepActionLabel: options.stepActionLabel || "到达",
    routeDistanceLabel: options.routeDistanceLabel || "未选择终点",
    routeStartLabel: options.routeStartLabel || "101",
    routeTargetLabel: options.routeTargetLabel || "未选择",
    selectedRoomId: options.selectedRoomId || "",
    selectedFloorLabel: options.selectedFloorLabel || "点击地图房间",
    safeInsets: options.safeInsets || { left: 0, top: 0, right: 0, bottom: 0 },
  };
  let frame = 0;
  let frameKind = "";
  let running = true;
  let labels = [];
  let interactiveObjects = [];
  let onLabels = options.onLabels;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hudCanvasScale = Math.min(Math.max(dpr, 1), hudPixelRatioLimit);
  let hudWidth = renderWidth;
  let hudHeight = renderHeight;
  let hudScene = new THREE.Scene();
  let hudCamera = new THREE.OrthographicCamera(0, hudWidth, hudHeight, 0, -10, 10);
  let hudWidgets = [];
  let hudCanvas = null;
  let hudCtx = null;
  let hudTexture = null;
  let hudSurface = null;
  let hudCanvasSize = { width: 0, height: 0 };
  let lastHudSignature = "";
  let lastHudCameraSignature = "";
  let lastHudRebuildAt = 0;
  let lastRenderedAt = 0;
  let lastInteractionAt = 0;
  let lastPublishedLabelSignature = "";
  let lastPublishedLabelAt = 0;
  let semanticBounds = null;
  let lastAppliedPreset = "";

  function clearHudWidgets() {
    if (hudSurface) {
      hudScene.remove(hudSurface);
      disposeObject(hudSurface);
    }
    if (hudTexture && hudTexture.dispose) hudTexture.dispose();
    hudWidgets = [];
    hudCanvas = null;
    hudCtx = null;
    hudTexture = null;
    hudSurface = null;
    hudCanvasSize = { width: 0, height: 0 };
  }

  function ensureHudSurface() {
    const width = Math.max(1, Math.round(hudWidth * hudCanvasScale));
    const height = Math.max(1, Math.round(hudHeight * hudCanvasScale));
    if (!hudCanvas || !hudCtx || width !== hudCanvasSize.width || height !== hudCanvasSize.height) {
      if (hudSurface) {
        hudScene.remove(hudSurface);
        disposeObject(hudSurface);
      }
      if (hudTexture && hudTexture.dispose) hudTexture.dispose();
      hudCanvas = createHudCanvas(width, height);
      hudCtx = hudCanvas && hudCanvas.getContext ? hudCanvas.getContext("2d") : null;
      if (!hudCanvas || !hudCtx) {
        hudCanvas = null;
        hudCtx = null;
        hudTexture = null;
        hudSurface = null;
        hudWidgets = [];
        return false;
      }
      hudCanvasSize = { width, height };
      hudTexture = new THREE.CanvasTexture(hudCanvas);
      hudTexture.minFilter = THREE.LinearFilter;
      hudTexture.magFilter = THREE.LinearFilter;
      hudTexture.generateMipmaps = false;
      const material = new THREE.MeshBasicMaterial({
        map: hudTexture,
        transparent: true,
        alphaTest: 0.01,
        depthTest: false,
        depthWrite: false,
      });
      hudSurface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      hudSurface.name = "hud-atlas-surface";
      hudSurface.renderOrder = 10100;
      hudScene.add(hudSurface);
      hudWidgets = [hudSurface];
    }
    hudSurface.visible = true;
    hudSurface.position.set(hudWidth / 2, hudHeight / 2, 0);
    hudSurface.scale.set(hudWidth, hudHeight, 1);
    return true;
  }

  function beginHudFrame() {
    if (!ensureHudSurface()) return false;
    hudCtx.save();
    hudCtx.setTransform(hudCanvasScale, 0, 0, hudCanvasScale, 0, 0);
    hudCtx.clearRect(0, 0, hudWidth, hudHeight);
    hudCtx.restore();
    return true;
  }

  function finishHudFrame() {
    if (hudTexture) hudTexture.needsUpdate = true;
  }

  function addHudWidget(bounds, draw, name, layer = 0) {
    if (!hudCtx) return;
    const x = Math.max(0, Math.floor(bounds.x));
    const y = Math.max(0, Math.floor(bounds.y));
    const w = Math.min(hudWidth - x, Math.ceil(bounds.width));
    const h = Math.min(hudHeight - y, Math.ceil(bounds.height));
    if (w <= 0 || h <= 0) return;
    const ctx = hudCtx;
    ctx.save();
    ctx.setTransform(hudCanvasScale, 0, 0, hudCanvasScale, 0, 0);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    try {
      draw(ctx);
    } catch (error) {
      ctx.restore();
      console.error("[mini-three] HUD widget failed", name || "hud-widget", error);
      return;
    }
    ctx.restore();
  }

  function addLocalHudWidget(bounds, draw, name, layer = 0) {
    if (!hudCtx) return;
    const x = Math.max(0, Math.floor(bounds.x));
    const y = Math.max(0, Math.floor(bounds.y));
    const w = Math.min(hudWidth - x, Math.ceil(bounds.width));
    const h = Math.min(hudHeight - y, Math.ceil(bounds.height));
    if (w <= 0 || h <= 0) return;
    const ctx = hudCtx;
    ctx.save();
    ctx.setTransform(hudCanvasScale, 0, 0, hudCanvasScale, 0, 0);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    try {
      draw(ctx, w, h);
    } catch (error) {
      ctx.restore();
      console.error("[mini-three] local HUD widget failed", name || "hud-widget", error);
      return;
    }
    ctx.restore();
  }

  function hudState() {
    const selectedRoom = mapData.rooms.find((room) => room.id === state.selectedRoomId);
    return {
      hasRoute: Boolean(state.route),
      panel: state.panel || "none",
      layerMode: state.layerMode || "allFloors",
      viewPreset: state.viewPreset || "overview",
      sensorHint: state.sensorHint || "模拟器无传感器",
      activeStepLabel: state.activeStepLabel || "1/1",
      currentStepTitle: state.currentStepTitle || "当前位置",
      nextStepVerb: state.nextStepVerb || "下一处",
      nextStepTitle: state.nextStepTitle || "选择终点",
      activeStepDistanceLabel: state.activeStepDistanceLabel || "--",
      stepActionLabel: state.stepActionLabel || "到达",
      routeDistanceLabel: state.routeDistanceLabel || (state.route ? state.route.distance : "未选择终点"),
      routeStartLabel: state.routeStartLabel || (state.route ? mapRuntime.roomLabel(mapData, state.route.startRoomId) : "101"),
      routeTargetLabel: state.routeTargetLabel || (state.route ? mapRuntime.roomLabel(mapData, state.route.targetRoomId) : "未选择"),
      targetRoomId: state.targetRoomId || state.route?.targetRoomId || "",
      selectedFloorLabel: state.selectedFloorLabel || (selectedRoom ? `${selectedRoom.floor} · ${selectedRoom.roomNo}` : "点击地图房间"),
      selectedRoomId: state.selectedRoomId || "",
      selectedRoomTitle: selectedRoom ? `${selectedRoom.roomNo} · ${selectedRoom.name}` : "",
      selectedRoomMeta: selectedRoom ? `类型：${selectedRoom.area}。路线会从房间中心到门点。` : "",
      safeInsets: state.safeInsets || { left: 0, top: 0, right: 0, bottom: 0 },
    };
  }

  function projectedHudLabels() {
    const compact = hudHeight < 260 || hudWidth < 520;
    return projectLabels().map((label) => {
      const w = compact
        ? label.variant === "route" ? 58 : label.variant === "floor" ? 52 : label.variant === "door" ? 28 : label.variant === "stair" ? 68 : label.variant === "corridor" ? 72 : label.variant === "compact-room" ? 34 : 54
        : label.variant === "route" ? 112 : label.variant === "floor" ? 86 : label.variant === "door" ? 42 : label.variant === "compact-room" ? 52 : 92;
      const h = compact
        ? label.variant === "route" ? 22 : label.variant === "compact-room" ? 18 : 21
        : label.variant === "route" ? 30 : label.variant === "compact-room" ? 24 : 26;
      return { ...label, boxW: w, boxH: h };
    });
  }

  function rebuildHudTexture(force = false) {
    if (state.disableHudForRecovery) {
      if (hudWidgets.length) clearHudWidgets();
      return;
    }
    const hud = hudState();
    const now = Date.now();
    const cameraSignature = [
      Math.round(camera.position.x * 18),
      Math.round(camera.position.y * 18),
      Math.round(camera.position.z * 18),
      Math.round(controls.target.x * 18),
      Math.round(controls.target.y * 18),
      Math.round(controls.target.z * 18),
    ].join(",");
    const cameraChanged = cameraSignature !== lastHudCameraSignature;
    if (!force && cameraChanged && now - lastHudRebuildAt < 520) return;
    lastHudCameraSignature = cameraSignature;
    const labelSnapshot = projectedHudLabels();
    const signature = JSON.stringify({
      revision: hudLayoutRevision,
      width: hudWidth,
      height: hudHeight,
      hud,
      labels: labelSnapshot.map((label) => [label.id, label.text, label.variant, Math.round(label.x), Math.round(label.y)]),
    });
    if (!force && signature === lastHudSignature) return;
    lastHudSignature = signature;
    lastHudRebuildAt = now;
    if (!beginHudFrame()) return;
    labelSnapshot.forEach((label, index) => {
      addHudWidget(
        labelMetrics(label),
        (ctx) => drawLabelPill(ctx, label),
        `hud-label-${label.id || index}`,
        90 + index * 0.001,
      );
    });
    addLocalHudWidget(
      { x: 0, y: 0, width: hudWidth, height: hudHeight },
      (ctx, width, height) => drawFixedHudLocal(ctx, hud, width, height),
      "hud-fixed-controls",
      117,
    );
    if (hud.panel && hud.panel !== "none") {
      addHudWidget(
        panelMetrics(hudWidth, hudHeight, hud.panel),
        (ctx) => drawPanel(ctx, hud, hudWidth, hudHeight),
        `hud-panel-${hud.panel}`,
        118,
      );
    }
    finishHudFrame();
  }

  function applyCameraPreset(preset = "overview") {
    const presetKey = `${state.layerMode || "allFloors"}:${state.route?.id || "no-route"}:${preset}`;
    if (presetKey === lastAppliedPreset) return;
    lastAppliedPreset = presetKey;
    const compact = renderWidth > renderHeight && renderHeight < 430;
    const key = state.layerMode === "raised202" && preset !== "top" ? "raised202" : preset === "route" ? "route" : preset === "near" ? "near" : preset === "top" ? "top" : "overview";
    const config = miniCameraPresets[key] || miniCameraPresets.overview;
    const position = new THREE.Vector3(...(compact ? config.compactPosition : config.regularPosition));
    const target = new THREE.Vector3(...(compact ? config.compactTarget : config.regularTarget));
    const zoomFactor = cameraZoomFactor(key, compact);
    camera.position.copy(target).add(position.sub(target).multiplyScalar(1 / zoomFactor));
    camera.fov = compact ? config.compactFov : config.regularFov;
    camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    controls.update();
  }

  function fitCameraToSemanticBounds(reason = "semantic") {
    if (!semanticBounds || semanticBounds.isEmpty()) return;
    const routeWideOverview =
      state.route &&
      (reason === "semantic-rebuild" || reason === "resize" || String(reason).startsWith("view-route")) &&
      (state.viewPreset === "route" || state.viewPreset === "overview") &&
      (state.layerMode === "allFloors" || state.layerMode === "exploded" || state.layerMode === "section");
    if (routeWideOverview) {
      applyCameraPreset("route");
      return;
    }
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    semanticBounds.getSize(size);
    semanticBounds.getCenter(center);
    const compact = renderWidth > renderHeight && renderHeight < 430;
    const maxSize = Math.max(size.x, size.z, 1.8);
    const distance = maxSize * (state.route ? (compact ? 1.35 : 1.55) : compact ? 1.52 : 1.72);
    const height = Math.max(size.y + 3.2, compact ? 4.8 : 5.4);
    camera.position.set(center.x + distance * 0.72, center.y + height, center.z + distance * 0.92);
    camera.fov = state.route ? (compact ? 35 : 32) : compact ? 33 : 34;
    camera.updateProjectionMatrix();
    controls.target.set(center.x, center.y + Math.min(0.68, size.y * 0.18), center.z);
    controls.update();
    options.onStatus && options.onStatus({
      ready: true,
      text: "",
      debug: `${reason}: ${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`,
    });
  }

  function prepareModel(model, scale) {
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale - 0.015, -center.z * scale);
    model.name = "jingong-glb-model";
    model.visible = true;
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        mat.side = THREE.DoubleSide;
        mat.transparent = true;
        mat.opacity = state.layerMode === "section" ? 0.28 : state.layerMode === "exploded" ? 0.12 : state.layerMode === "2F" || state.layerMode === "1F" ? 0.08 : 0.1;
        mat.depthWrite = false;
        if (mat.color) mat.color.offsetHSL(0, -0.08, 0.08);
        mat.needsUpdate = true;
      });
    });
  }

  function loadModel() {
    const loader = new GLTFLoader();
    loader.setResourcePath("map-models/textures/");
    loader.load(
      "map-models/jingong.glb",
      (gltf) => {
        modelGroup.clear();
        prepareModel(gltf.scene, mapData.calibration?.runtimeFit?.centeredScale || 0.000010638787219624723);
        modelGroup.visible = true;
        modelGroup.add(gltf.scene);
        options.onStatus && options.onStatus({ ready: true, text: "Three/GLB 地图已加载" });
      },
      undefined,
      (error) => {
        options.onStatus && options.onStatus({ ready: false, text: `GLB 加载失败：${error?.message || "未知错误"}` });
      },
    );
  }

  function rebuildSemantic() {
    scene.remove(semanticRoot);
    disposeObject(semanticRoot);
    semanticRoot = new THREE.Group();
    semanticRoot.name = "mini-semantic-building";
    labels = [];
    interactiveObjects = [];
    const layerMode = state.layerMode || "allFloors";
    const routeNodeIds = new Set(state.route?.nodeIds || []);
    const focused = layerMode === "1F" || layerMode === "2F" || layerMode === "raised202";
    const floorMat = {
      "1F": semanticPlaneMaterial({ color: floorShellColor["1F"], opacity: layerMode === "exploded" ? 0.98 : 1 }),
      "2F": semanticPlaneMaterial({ color: floorShellColor["2F"], opacity: layerMode === "allFloors" ? 0.94 : layerMode === "exploded" ? 0.94 : 0.98 }),
    };
    const floorEdgeMat = new THREE.MeshBasicMaterial({ color: 0x48617b, transparent: true, opacity: layerMode === "allFloors" ? 0.88 : 1 });
    const roomEdgeMat = new THREE.MeshBasicMaterial({ color: 0x4f6378, transparent: true, opacity: layerMode === "allFloors" ? 0.76 : 0.9 });
    const corridorEdgeMat = new THREE.MeshBasicMaterial({ color: 0x167fb8, transparent: true, opacity: layerMode === "allFloors" ? 0.86 : 0.96 });
    const centerlineMat = new THREE.MeshBasicMaterial({ color: 0x2878c7, transparent: true, opacity: state.route ? 0.38 : 0.2 });
    const supportDeckMat = material({
      color: layerMode === "2F" ? 0xd0e2ef : 0xd5e4ef,
      opacity: layerMode === "allFloors" ? 0.72 : layerMode === "exploded" ? 0.62 : 0.94,
    });
    const supportDeckEdgeMat = material({
      color: 0x60788d,
      opacity: layerMode === "allFloors" ? 0.54 : 0.78,
    });
    const raisedRimMat = material({
      color: layerMode === "raised202" ? 0x5f768a : 0x7c91a4,
      opacity: layerMode === "raised202" ? 0.96 : 0.72,
    });
    mapData.floors.forEach((floor) => {
      if (!floorVisible(floor.id, layerMode)) return;
      const floorOutline = layerMode === "raised202" && floor.id === "2F" ? raised202Polygon : floor.outline;
      const floorMesh = extrudedPolygonMesh(floorOutline, floor.id, layerMode, SLAB_THICKNESS, floorMat[floor.id].clone(), 0, `floor-${floor.id}`);
      floorMesh.name = `semantic-floor-${floor.id}`;
      semanticRoot.add(floorMesh);
      addPolygonOutline(
        semanticRoot,
        floorOutline,
        floor.id,
        layerMode,
        `floor-${floor.id}`,
        SLAB_THICKNESS + 0.028,
        floor.id === "1F" ? 0.017 : 0.014,
        floorEdgeMat,
        `floor-outline-${floor.id}`,
      );
      labels.push({
        id: `floor-${floor.id}`,
        text: layerMode === "raised202" && floor.id === "2F" ? "202 二层半" : floor.label,
        compactText: layerMode === "raised202" && floor.id === "2F" ? "2.5F" : floor.id,
        fullText: layerMode === "raised202" && floor.id === "2F" ? "202 二层半" : floor.label,
        variant: "floor",
        priority: 20,
        position: mapPointToModel(floorOutline[0], floor.id, { layerMode, lift: 0.16, semanticId: `floor-${floor.id}` }),
      });
    });
    visibleSupportDecksForLayer(layerMode).forEach((deck) => {
      semanticRoot.add(supportDeckGeometry(layerMode, deck, supportDeckMat.clone(), supportDeckEdgeMat.clone()));
      if (layerMode === "2F" || layerMode === "exploded") {
        labels.push({
          id: deck.id,
          text: deck.label,
          compactText: supportDeckLabel(deck),
          fullText: `${deck.label}，表示二层下方仍有实体空间或楼板承托`,
          variant: "note",
          minDensity: "far",
          priority: 44,
          position: mapPointToModel(polygonCenter(deck.polygon), "2F", {
            layerMode,
            semanticId: deck.semanticId,
            lift: SLAB_THICKNESS + 0.18,
          }),
        });
      }
    });
    if (floorVisible("2F", layerMode) && (layerMode === "allFloors" || layerMode === "2F" || layerMode === "raised202" || layerMode === "exploded")) {
      semanticRoot.add(raisedPlatformLowerContext(layerMode));
      if (layerMode === "raised202" || layerMode === "exploded" || layerMode === "2F") {
        labels.push({
          id: "202-lower-context",
          text: "202 投影结构",
          compactText: "202 下方",
          fullText: "202 二层半下方承托与投影结构",
          variant: "note",
          minDensity: layerMode === "allFloors" ? "near" : "far",
          priority: layerMode === "raised202" || layerMode === "2F" ? 86 : 64,
          position: mapPointToModel(polygonCenter(raised202Polygon), "2F", {
            layerMode,
            semanticId: "202-lower-context",
            lift: SLAB_THICKNESS + 0.38,
          }),
        });
      }
      if (layerMode === "raised202" || layerMode === "exploded" || state.route?.targetRoomId?.startsWith("202")) {
        semanticRoot.add(raisedPlatformRim(layerMode, raisedRimMat.clone()));
        semanticRoot.add(raisedPlatformBoundaryWall(layerMode, raisedRimMat.clone()));
      }
    }
    mapData.spaces.forEach((space) => {
      if (space.kind === "room") return;
      if (!visibleForLayer(space.floor, layerMode, { point: space.center, polygon: space.polygon, semanticId: space.id })) return;
      const onRoute = state.route && state.route.points.some((point) => point.floor === space.floor && pointInPolygon(point.point, space.polygon));
      const mat = semanticPlaneMaterial({
        color: onRoute ? 0x78ccff : space.kind === "corridor" ? 0x9ee4ff : spaceColor[space.kind] || spaceColor.room,
          opacity: space.kind === "corridor" ? 1 : focused ? 0.99 : 0.96,
      });
      const mesh = extrudedPolygonMesh(space.polygon, space.floor, layerMode, space.kind === "corridor" ? 0.052 : 0.034, mat, SLAB_THICKNESS + 0.012, space.id);
      mesh.name = `semantic-space-${space.id}`;
      semanticRoot.add(mesh);
      if (space.kind === "corridor") {
        addPolygonOutline(semanticRoot, space.polygon, space.floor, layerMode, space.id, SLAB_THICKNESS + 0.085, 0.012, corridorEdgeMat, `corridor-outline-${space.id}`);
      }
      const shouldLabelSpace = state.route
        ? Boolean(onRoute || (focused && space.kind !== "corridor"))
        : Boolean((space.kind === "corridor" && (focused || layerMode !== "allFloors")) || focused);
      if (shouldLabelSpace) {
        labels.push({
          id: `space-${space.id}`,
          text: space.kind === "corridor" ? "走廊" : space.label,
          variant: space.kind === "corridor" ? "corridor" : "note",
          priority: space.kind === "corridor" ? 46 : 18,
          position: mapPointToModel(space.center, space.floor, { layerMode, lift: 0.22, semanticId: space.id }),
        });
      }
    });
    mapData.rooms.forEach((room) => {
      if (!visibleForLayer(room.floor, layerMode, { roomId: room.id, point: room.center, polygon: room.polygon, semanticId: room.id })) return;
      const onRoute = Boolean(state.route && (state.route.targetRoomId === room.id || routeNodeIds.has(`center-${room.id}`) || routeNodeIds.has(room.doorNodeId)));
      const mesh = extrudedPolygonMesh(
        room.polygon,
        room.floor,
        layerMode,
        0.052,
        semanticPlaneMaterial({
          color: state.route?.targetRoomId === room.id ? 0x0b6cff : state.route?.startRoomId === room.id ? 0x19a15f : onRoute ? 0xdbeafe : roomColor[room.area] || roomColor.other,
          opacity: state.route?.targetRoomId === room.id || state.route?.startRoomId === room.id ? 1 : onRoute ? 1 : room.area === "other" ? 0.98 : 1,
        }),
        SLAB_THICKNESS + 0.018,
        room.id,
      );
      mesh.name = `semantic-room-${room.id}`;
      mesh.userData.roomId = room.id;
      interactiveObjects.push(mesh);
      semanticRoot.add(mesh);
      if (state.route || focused || mapRuntime.overviewLabelRoomIds?.has?.(room.id)) {
        addPolygonOutline(semanticRoot, room.polygon, room.floor, layerMode, room.id, SLAB_THICKNESS + 0.105 + (isRaised202Room(room.id) ? RAISED_202_HEIGHT : 0), 0.008, roomEdgeMat, `room-outline-${room.id}`);
      }
      const keyRoom = mapRuntime.overviewLabelRoomIds?.has?.(room.id);
      const routeEndpointRoom = Boolean(state.route && (state.route.startRoomId === room.id || state.route.targetRoomId === room.id));
      const shouldShowRoomLabel = state.route
        ? Boolean(focused && !routeEndpointRoom && !onRoute)
        : Boolean(focused || keyRoom);
      if (shouldShowRoomLabel) {
        labels.push({
          id: `room-${room.id}`,
          roomId: room.id,
          text: focused ? roomLabel(room) : room.roomNo,
          compactText: room.roomNo,
          fullText: roomLabel(room),
          minDensity: keyRoom ? "far" : focused ? "mid" : "near",
          variant: "room",
          priority: keyRoom ? 62 : 32,
          position: mapPointToModel(room.labelPoint || room.center, room.floor, {
            layerMode,
            lift: 0.28 + (isRaised202Room(room.id) ? RAISED_202_HEIGHT : 0),
            semanticId: room.id,
          }),
        });
      }
    });
    mapData.walls.forEach((wall) => {
      if (!visibleForLayer(wall.floor, layerMode, { point: wall.from, semanticId: wall.id || wall.roomId || "" })) return;
      const from = mapPointToModel(wall.from, wall.floor, { layerMode, lift: SLAB_THICKNESS + (wall.kind === "outer" ? OUTER_WALL_HEIGHT / 2 : WALL_HEIGHT / 2), semanticId: wall.roomId || wall.id });
      const to = mapPointToModel(wall.to, wall.floor, { layerMode, lift: SLAB_THICKNESS + (wall.kind === "outer" ? OUTER_WALL_HEIGHT / 2 : WALL_HEIGHT / 2), semanticId: wall.roomId || wall.id });
      const length = from.distanceTo(to);
      if (length < 0.01) return;
      const angle = -Math.atan2(to.z - from.z, to.x - from.x);
      const wallMesh = orientedBox(
        from.clone().add(to).multiplyScalar(0.5),
        length,
        wall.kind === "outer" ? OUTER_WALL_HEIGHT : wall.kind === "low" ? 0.18 : WALL_HEIGHT,
        wall.kind === "outer" ? 0.054 : 0.036,
        angle,
        material({ color: wall.kind === "outer" ? 0x465b70 : 0x7b8e9f, opacity: focused ? 1 : layerMode === "exploded" ? 0.72 : 0.92 }),
        `wall-${wall.id}`,
      );
      semanticRoot.add(wallMesh);
    });
    mapData.doors.forEach((door) => {
      if (!visibleForLayer(door.floor, layerMode, { point: door.point, semanticId: door.connects?.[0] || door.nodeId })) return;
      const from = mapPointToModel(door.from, door.floor, { layerMode, lift: SLAB_THICKNESS + 0.13, semanticId: door.connects?.[0] || door.nodeId });
      const to = mapPointToModel(door.to, door.floor, { layerMode, lift: SLAB_THICKNESS + 0.13, semanticId: door.connects?.[0] || door.nodeId });
      const active = routeNodeIds.has(door.nodeId);
      const doorMesh = tubeBetween(from, to, active ? 0.04 : 0.027, material({ color: active ? 0x0b6cff : door.source === "inferred" ? 0xffc85a : 0xffffff, emissive: active ? 0x073c9b : 0x9ecfff, emissiveIntensity: active ? 0.28 : 0.16 }));
      doorMesh.name = `door-${door.nodeId}`;
      semanticRoot.add(doorMesh);
      if (active) {
        labels.push({
          id: `door-${door.nodeId}`,
          text: "门",
          variant: "door",
          priority: 116,
          position: mapPointToModel(door.point, door.floor, { layerMode, lift: 0.34, semanticId: door.connects?.[0] || door.nodeId }),
        });
      }
    });
    if (state.route) {
      mapData.centerlines.forEach((line) => {
        const from = mapData.nodes.find((node) => node.id === line.from);
        const to = mapData.nodes.find((node) => node.id === line.to);
        if (!from || !to || from.floor !== to.floor) return;
        if (!visibleForLayer(from.floor, layerMode, { point: from.point, semanticId: line.from }) || !visibleForLayer(to.floor, layerMode, { point: to.point, semanticId: line.to })) return;
        const a = mapPointToModel(from.point, from.floor, {
          layerMode,
          semanticId: line.from,
          lift: SLAB_THICKNESS + 0.125 + (isRaised202Point(from.point, from.floor) ? RAISED_202_HEIGHT : 0),
        });
        const b = mapPointToModel(to.point, to.floor, {
          layerMode,
          semanticId: line.to,
          lift: SLAB_THICKNESS + 0.125 + (isRaised202Point(to.point, to.floor) ? RAISED_202_HEIGHT : 0),
        });
        const onRoute = routeNodeIds.has(line.from) && routeNodeIds.has(line.to);
        semanticRoot.add(tubeBetween(a, b, onRoute ? 0.018 : 0.009, withOpacity(centerlineMat.clone(), onRoute ? 0.42 : 0.16)));
      });
    }
    mapData.stairs.forEach((stair) => {
      const lowerVisible = visibleForLayer(stair.lowerFloor, layerMode, { polygon: stair.lowerLanding, semanticId: stair.lowerNodeId });
      const upperVisible = visibleForLayer(stair.upperFloor, layerMode, { polygon: stair.upperLanding, semanticId: stair.upperNodeId });
      if (!lowerVisible && !upperVisible) return;
      const active = Boolean(state.route?.steps?.some((step) => step.kind.includes("stair") && (step.fromNodeId === stair.lowerNodeId || step.toNodeId === stair.upperNodeId || step.fromNodeId === stair.upperNodeId || step.toNodeId === stair.lowerNodeId)));
      const lower = mapPointToModel(stair.lowerLanding.reduce((acc, point) => [acc[0] + point[0] / stair.lowerLanding.length, acc[1] + point[1] / stair.lowerLanding.length], [0, 0]), stair.lowerFloor, { layerMode, lift: SLAB_THICKNESS + 0.08, semanticId: stair.lowerNodeId });
      const upper = mapPointToModel(stair.upperLanding.reduce((acc, point) => [acc[0] + point[0] / stair.upperLanding.length, acc[1] + point[1] / stair.upperLanding.length], [0, 0]), stair.upperFloor, { layerMode, lift: SLAB_THICKNESS + 0.08, semanticId: stair.upperNodeId });
      addStairPair(semanticRoot, lower, upper, active, stair.id === "stair-public");
      if (active || !state.route) {
        labels.push({
          id: `stair-${stair.id}`,
          text: active ? `${stair.label} · 路线` : stair.label,
          compactText: stair.access === "internal" ? "内梯" : "楼梯",
          variant: "stair",
          priority: active ? 118 : 58,
          position: lower.clone().lerp(upper, 0.52).add(new THREE.Vector3(0, 0.34, 0)),
        });
      }
    });
    scene.add(semanticRoot);
    semanticBounds = new THREE.Box3().setFromObject(semanticRoot);
    if (!semanticBounds.isEmpty()) fitCameraToSemanticBounds("semantic-rebuild");
    publishLabels();
  }

  function rebuildRoute() {
    scene.remove(routeRoot);
    disposeObject(routeRoot);
    routeRoot = new THREE.Group();
    routeRoot.name = "mini-route";
    if (!state.route) {
      scene.add(routeRoot);
      publishLabels();
      return;
    }
    const activeIndex = state.activeStepIndex || 0;
    const routeMat = material({ color: 0x0b6cff, emissive: 0x073c9b, emissiveIntensity: 0.34 });
    const stairMat = material({ color: 0xff9700, emissive: 0xb85d00, emissiveIntensity: 0.52 });
    const outerHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.46 });
    const walkHaloMaterial = new THREE.MeshBasicMaterial({ color: 0x9dccff, transparent: true, opacity: 0.28 });
    const stairHaloMaterial = new THREE.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.34 });
    for (let index = 1; index < state.route.points.length; index += 1) {
      const from = state.route.points[index - 1];
      const to = state.route.points[index];
      if (!routePointVisible(from, state.layerMode) && !routePointVisible(to, state.layerMode)) continue;
      const stair = to.kind.includes("stair") || to.kind === "stair";
      const active = index - 1 === activeIndex;
      const a = routePointToVector(from, state.layerMode);
      const b = routePointToVector(to, state.layerMode);
      const baseMat = stair ? stairMat : routeMat;
      routeRoot.add(tubeBetween(a, b, active ? (stair ? 0.13 : 0.1) : 0.044, withOpacity(outerHaloMaterial.clone(), active ? 0.5 : 0.16)));
      routeRoot.add(tubeBetween(a, b, active ? (stair ? 0.09 : 0.068) : 0.038, withOpacity((stair ? stairHaloMaterial : walkHaloMaterial).clone(), active ? (stair ? 0.4 : 0.34) : 0.2)));
      routeRoot.add(tubeBetween(a, b, active ? (stair ? 0.066 : 0.048) : stair ? 0.032 : 0.03, withOpacity(baseMat.clone(), active ? 1 : 0.76)));
      if (active) {
        addDirectionalArrow(routeRoot, a, b, baseMat.clone(), stair ? 1.7 : 1.22);
      }
    }
    const points = state.route.points;
    [0, Math.min(points.length - 1, activeIndex + 1), points.length - 1].forEach((pointIndex, arrayIndex) => {
      const point = points[pointIndex];
      if (!point || !routePointVisible(point, state.layerMode)) return;
      const first = pointIndex === 0;
      const last = pointIndex === points.length - 1;
      const color = first ? 0x16a060 : last ? 0xff3f6c : 0x0b6cff;
      const base = routePointToVector(point, state.layerMode);
      routeRoot.add(makeDisc(base.clone(), first ? 0.3 : last ? 0.32 : 0.28, new THREE.MeshBasicMaterial({ color: first ? 0xc8f7df : last ? 0xffd5df : 0xdbeafe, transparent: true, opacity: first || last ? 0.74 : 0.52 })));
      routeRoot.add(makeBeaconRing(base.clone(), first ? 0.36 : last ? 0.42 : 0.34, color, first || last ? 0.74 : 0.62));
      routeRoot.add(makeBeaconRing(base.clone().add(new THREE.Vector3(0, 0.04, 0)), first ? 0.5 : last ? 0.56 : 0.46, color, first || last ? 0.28 : 0.22));
      const markerGeometry = last ? new THREE.ConeGeometry(0.18, 0.46, 32) : first ? new THREE.CylinderGeometry(0.095, 0.095, 0.28, 28) : new THREE.SphereGeometry(0.12, 24, 14);
      const marker = new THREE.Mesh(markerGeometry, material({ color, emissive: color, emissiveIntensity: first || last ? 0.42 : 0.28, roughness: 0.34 }));
      marker.position.copy(base.add(new THREE.Vector3(0, first ? 0.19 : last ? 0.16 : 0.12 + arrayIndex * 0.002, 0)));
      routeRoot.add(marker);
      labels.push({
        id: first ? "route-current-location" : last ? "route-target-location" : "route-next-portal",
        text: first ? `现在 ${mapRuntime.roomLabel(mapData, state.route.startRoomId)}` : last ? `终点 ${mapRuntime.roomLabel(mapData, state.route.targetRoomId)}` : "下一处",
        compactText: first ? `现在 ${mapRuntime.roomLabel(mapData, state.route.startRoomId)}` : last ? `终点 ${mapRuntime.roomLabel(mapData, state.route.targetRoomId)}` : "下一处",
        fullText: first ? `现在 ${mapRuntime.roomLabel(mapData, state.route.startRoomId)}` : last ? `终点 ${mapRuntime.roomLabel(mapData, state.route.targetRoomId)}` : "下一处",
        minDensity: "far",
        variant: "route",
        priority: first || last ? 130 : 126,
        start: first,
        target: last,
        position: marker.position.clone().add(new THREE.Vector3(first ? -0.16 : 0.16, 0.24, last ? -0.08 : 0.08)),
      });
    });
    scene.add(routeRoot);
    publishLabels();
  }

  function projectLabels() {
    const compact = renderHeight < 260 || renderWidth < 520;
    const distance = camera.position.distanceTo(controls.target);
    const density = compact
      ? distance <= 4.8 ? "near" : distance <= 7.2 ? "mid" : "far"
      : distance <= 5.8 ? "near" : distance <= 8.8 ? "mid" : "far";
    const projected = labels.map((label) => {
      const vector = label.position.clone().project(camera);
      return {
        ...label,
        text: density === "near" ? (label.fullText || label.text) : (label.compactText || label.text),
        variant: label.variant === "room" && density !== "near" && !label.active ? "compact-room" : label.variant,
        x: Math.round((vector.x * 0.5 + 0.5) * renderWidth),
        y: Math.round((-vector.y * 0.5 + 0.5) * renderHeight),
        visible: vector.z > -1 && vector.z < 1,
      };
    }).sort((a, b) => b.priority - a.priority);
    const occupied = [];
    return projected.map((label) => {
      const required = labelDensityRank[label.minDensity || "far"] || 0;
      const densityValue = labelDensityRank[density] || 0;
      const w = compact
        ? label.variant === "route" ? 58 : label.variant === "floor" ? 52 : label.variant === "door" ? 28 : label.variant === "stair" ? 68 : label.variant === "corridor" ? 72 : label.variant === "compact-room" ? 34 : 54
        : label.variant === "route" ? 112 : label.variant === "floor" ? 86 : label.variant === "door" ? 42 : label.variant === "compact-room" ? 52 : 92;
      const h = compact ? (label.variant === "route" ? 22 : label.variant === "compact-room" ? 18 : 21) : (label.variant === "route" ? 30 : label.variant === "compact-room" ? 24 : 26);
      const box = { x: label.x - w / 2, y: label.y - h / 2, w, h };
      const outside = box.x < 4 || box.y < 4 || box.x + box.w > renderWidth - (compact ? 56 : 64) || box.y + box.h > renderHeight - 4;
      const collides = occupied.some((item) => box.x < item.x + item.w && box.x + box.w > item.x && box.y < item.y + item.h && box.y + box.h > item.y);
      const allowCollision = label.priority >= 126 || (!compact && label.priority >= 110) || (density === "near" && label.variant === "room" && !compact);
      const visible = label.visible && densityValue >= required && !outside && (!collides || allowCollision);
      if (visible && label.priority < 110) occupied.push(box);
      return { ...label, visible };
    }).filter((label) => label.visible);
  }

  function publishLabels() {
    if (!onLabels) return;
    const projected = projectLabels();
    const signature = projected.map((label) => `${label.id || ""}:${label.text || ""}:${label.variant || ""}`).join("|");
    const now = Date.now();
    if (signature === lastPublishedLabelSignature && now - lastPublishedLabelAt < 1200) return;
    lastPublishedLabelSignature = signature;
    lastPublishedLabelAt = now;
    onLabels(projected);
  }

  function animate() {
    if (!running) return;
    try {
      const now = Date.now();
      const activeInteraction = now - lastInteractionAt < 700;
      const frameInterval = activeInteraction ? 18 : 72;
      if (now - lastRenderedAt < frameInterval) {
        scheduleNextFrame(frameInterval - (now - lastRenderedAt), activeInteraction);
        return;
      }
      lastRenderedAt = now;
      controls.update();
      rebuildHudTexture(false);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      if (hudWidgets.length) {
        renderer.clearDepth();
        renderer.render(hudScene, hudCamera);
      }
      publishLabels();
    } catch (error) {
      console.error("[mini-three] render frame failed", error);
      try {
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
      } catch (_) {
        options.onStatus && options.onStatus({ ready: false, text: `地图渲染异常：${error?.message || "未知错误"}` });
      }
    }
    const active = Date.now() - lastInteractionAt < 700;
    scheduleNextFrame(active ? 16 : 96, active);
  }

  function scheduleNextFrame(delay = 16, active = false) {
    if (!running) return;
    if (active && canvas.requestAnimationFrame) {
      frameKind = "raf";
      frame = canvas.requestAnimationFrame(animate);
      return;
    }
    frameKind = "timeout";
    frame = setTimeout(animate, Math.max(32, Math.floor(delay)));
  }

  loadModel();
  applyCameraPreset(options.route ? "route" : "overview");
  rebuildSemantic();
  rebuildRoute();
  options.onStatus && options.onStatus({ ready: true, text: "" });
  animate();

  return {
    update(next = {}) {
      const previousLayer = state.layerMode;
      const previousRouteId = state.route?.id;
      const previousActiveStepIndex = state.activeStepIndex || 0;
      const previousViewPreset = state.viewPreset || "overview";
      state = { ...state, ...next };
      const nextActiveStepIndex = state.activeStepIndex || 0;
      modelGroup.visible = true;
      if (previousLayer !== state.layerMode || previousRouteId !== state.route?.id || previousActiveStepIndex !== nextActiveStepIndex) {
        lastAppliedPreset = "";
        rebuildSemantic();
        rebuildRoute();
      }
      const nextViewPreset = state.viewPreset || "overview";
      if (next.viewPreset && nextViewPreset !== previousViewPreset && !next.preserveCamera) {
        lastAppliedPreset = "";
        applyCameraPreset(nextViewPreset);
        if (nextViewPreset !== "top" && !(state.route && nextViewPreset === "route")) fitCameraToSemanticBounds(`view-${nextViewPreset}`);
      }
      rebuildHudTexture(true);
    },
    setSize(nextWidth, nextHeight, nextDpr = dpr) {
      renderWidth = Math.max(1, Math.floor(nextWidth));
      renderHeight = Math.max(1, Math.floor(nextHeight));
      const aspect = Math.max(0.1, nextWidth / Math.max(1, nextHeight));
      hudWidth = Math.max(1, Math.floor(nextWidth));
      hudHeight = Math.max(1, Math.floor(nextHeight));
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      hudCamera.left = 0;
      hudCamera.right = hudWidth;
      hudCamera.top = hudHeight;
      hudCamera.bottom = 0;
      hudCamera.updateProjectionMatrix();
      clearHudWidgets();
      lastHudSignature = "";
      lastAppliedPreset = "";
      renderer.setPixelRatio(Math.min(nextDpr, 2));
      renderer.setSize(nextWidth, nextHeight, false);
      applyCameraPreset(state.viewPreset || (state.route ? "route" : "overview"));
      if (!state.route || state.layerMode === "1F" || state.layerMode === "2F" || state.layerMode === "raised202") {
        fitCameraToSemanticBounds("resize");
      }
      rebuildHudTexture(true);
    },
    dispatchTouchEvent(event) {
      if (event && (event.type === "touchstart" || event.type === "touchmove")) lastInteractionAt = Date.now();
      if (platform.dispatchTouchEvent) platform.dispatchTouchEvent(event);
    },
    rotate(delta) {
      lastInteractionAt = Date.now();
      controls.rotateLeft(delta);
      controls.update();
    },
    pickRoom(x, y) {
      pointer.set((x / Math.max(1, renderWidth)) * 2 - 1, -(y / Math.max(1, renderHeight)) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactiveObjects, false)[0];
      return hit?.object?.userData?.roomId || "";
    },
    dispose() {
      running = false;
      if (frame && frameKind === "raf" && canvas.cancelAnimationFrame) canvas.cancelAnimationFrame(frame);
      else if (frame) clearTimeout(frame);
      controls.dispose();
      renderer.dispose();
      disposeObject(scene);
      disposeObject(hudScene);
      THREE.PLATFORM.dispose();
    },
  };
}

module.exports = {
  createMiniProgramThreeMap,
};
