import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const source = "src/assets/expressions/jingong-asset-sheet.png";
const outDir = "src/assets/ui";

if (!existsSync(source)) {
  throw new Error(`missing asset sheet: ${source}`);
}

mkdirSync(outDir, { recursive: true });

const script = String.raw`
from PIL import Image, ImageChops
from pathlib import Path

source = Path("src/assets/expressions/jingong-asset-sheet.png")
out_dir = Path("src/assets/ui")
names = [
    "robot-standby",
    "robot-listening",
    "robot-speaking",
    "robot-expert",
    "map-building-pin",
    "route-stairs",
    "room-card",
    "map-layered",
    "robot-calm",
]

img = Image.open(source).convert("RGBA")
w, h = img.size
cell_w, cell_h = w // 3, h // 3

def trim_white(tile):
    bg = Image.new("RGBA", tile.size, (255, 255, 255, 255))
    diff = ImageChops.difference(tile, bg).convert("L")
    bbox = diff.point(lambda p: 255 if p > 14 else 0).getbbox()
    if not bbox:
        return tile
    left, top, right, bottom = bbox
    pad = 22
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(tile.width, right + pad)
    bottom = min(tile.height, bottom + pad)
    return tile.crop((left, top, right, bottom))

for index, name in enumerate(names):
    col = index % 3
    row = index // 3
    tile = img.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
    tile = trim_white(tile)
    canvas = Image.new("RGBA", (512, 512), (255, 255, 255, 0))
    tile.thumbnail((456, 456), Image.Resampling.LANCZOS)
    canvas.alpha_composite(tile, ((512 - tile.width) // 2, (512 - tile.height) // 2))
    canvas.save(out_dir / f"{name}.png")
`;

const result = spawnSync("python3", ["-c", script], { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`sliced ${source} into ${outDir}`);
