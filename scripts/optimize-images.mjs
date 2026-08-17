/**
 * One-time (re-runnable) pass over the migrated WordPress images in
 * public/images/ -- most were never resized or recompressed on the way
 * out of WordPress, so a handful run 1-3MB for what renders at a few
 * hundred CSS pixels wide, and none carry width/height, so the browser
 * can't reserve space for them before they load (layout shift).
 *
 * This script does two things, in place, at the exact same path every
 * image is already referenced by (so nothing elsewhere -- posts.json,
 * component src attributes -- needs to change):
 *   1. Downscale anything wider than MAX_WIDTH and recompress at a
 *      quality that's visually lossless at blog-post display sizes.
 *   2. Record every image's final pixel dimensions into
 *      src/data/image-dimensions.json (a committed cache, same pattern
 *      as src/data/ogp-cache.json) so components can emit width/height
 *      attributes without re-reading image files at render/build time.
 *
 * Usage: node scripts/optimize-images.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMAGES_DIR = path.join(ROOT, "public/images");
const CACHE_PATH = path.join(ROOT, "src/data/image-dimensions.json");

// Wider than this is wasted bytes: the article column tops out at 42rem
// (~672px) and even a full-bleed hero on a 2x/retina display rarely
// exceeds this.
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 82;
const PNG_COMPRESSION_LEVEL = 9;

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

function toUrlPath(absPath) {
  return "/" + path.relative(path.join(ROOT, "public"), absPath).split(path.sep).join("/");
}

async function main() {
  const allFiles = await walk(IMAGES_DIR);
  const targets = allFiles.filter((f) => /\.(jpe?g|png)$/i.test(f));
  console.log(`対象ファイル: ${targets.length} 件`);

  let cache = {};
  try {
    cache = JSON.parse(await fs.readFile(CACHE_PATH, "utf-8"));
  } catch {
    cache = {};
  }

  let processed = 0;
  let skippedAlreadySmall = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  let failed = [];

  for (let i = 0; i < targets.length; i++) {
    const file = targets[i];
    const urlPath = toUrlPath(file);
    const before = (await fs.stat(file)).size;
    bytesBefore += before;

    try {
      const img = sharp(file, { failOn: "none" });
      const meta = await img.metadata();
      const needsResize = (meta.width ?? 0) > MAX_WIDTH;
      const isJpeg = /\.jpe?g$/i.test(file);

      // Recompressing a file that's already small rarely helps and costs
      // a re-encode generation for no benefit -- only touch files that
      // are either oversized in pixels or still fairly heavy in bytes.
      if (!needsResize && before < 150_000) {
        skippedAlreadySmall++;
        cache[urlPath] = { width: meta.width, height: meta.height };
        bytesAfter += before;
        continue;
      }

      let pipeline = img.rotate(); // apply EXIF orientation, then strip it
      if (needsResize) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      pipeline = isJpeg
        ? pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        : pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL, effort: 10 });

      const outBuffer = await pipeline.toBuffer();
      const outMeta = await sharp(outBuffer).metadata();

      // Guard against the rare case a recompress comes out larger
      // (already-optimal source) -- never make a file bigger.
      if (outBuffer.length < before) {
        await fs.writeFile(file, outBuffer);
        bytesAfter += outBuffer.length;
      } else {
        bytesAfter += before;
      }
      cache[urlPath] = { width: outMeta.width, height: outMeta.height };
      processed++;
    } catch (err) {
      failed.push({ file: urlPath, error: err.message });
      bytesAfter += before;
    }

    if ((i + 1) % 200 === 0) {
      console.log(`  ${i + 1}/${targets.length} 処理済み...`);
    }
  }

  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 1), "utf-8");

  console.log("");
  console.log(`再圧縮/リサイズ: ${processed} 件`);
  console.log(`既に十分軽量でスキップ: ${skippedAlreadySmall} 件`);
  console.log(`失敗: ${failed.length} 件`);
  failed.forEach((f) => console.log(`  - ${f.file}: ${f.error}`));
  console.log(`合計サイズ: ${(bytesBefore / 1024 / 1024).toFixed(1)}MB -> ${(bytesAfter / 1024 / 1024).toFixed(1)}MB`);
  console.log(`寸法キャッシュ: ${Object.keys(cache).length} 件 -> ${CACHE_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
