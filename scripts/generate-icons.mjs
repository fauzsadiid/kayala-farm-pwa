import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svg = readFileSync(join(root, "public", "icon.svg"));
const sizes = [72, 96, 128, 192, 384, 512];

for (const size of sizes) {
  const buf = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(join(root, "public", `icon-${size}.png`), buf);
  console.log(`icon-${size}.png`);
}
