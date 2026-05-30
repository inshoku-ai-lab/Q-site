/**
 * Generate Cloudflare Pages _redirects file mapping legacy WordPress
 * root-slug URLs to the new /posts/<slug>/ structure.
 *
 * Run after `npm run build`:
 *   node scripts/generate-redirects.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_JSON = path.join(ROOT, "src/data/posts.json");
const OUT = path.join(ROOT, "dist/_redirects");

// Routes that must NOT be treated as post slugs.
const RESERVED = new Set([
  "about", "archive", "series", "category", "tag", "posts", "rss.xml",
  "sitemap-index.xml", "sitemap-0.xml", "_astro", "favicon.ico", "favicon.svg",
  "404",
]);

const posts = JSON.parse(await fs.readFile(POSTS_JSON, "utf-8"));

const lines = [
  "# Auto-generated WordPress legacy URL redirects",
  "# Format: source destination status",
  "",
];

for (const p of posts) {
  if (!p.slug) continue;
  if (RESERVED.has(p.slug)) continue;
  lines.push(`/${p.slug}/ /posts/${p.slug}/ 301`);
  // Also handle WordPress trailing-slash-less variant
  lines.push(`/${p.slug} /posts/${p.slug}/ 301`);
}

await fs.writeFile(OUT, lines.join("\n") + "\n", "utf-8");
console.log(`✓ ${OUT} に ${posts.length} 記事のリダイレクトを書き出しました。`);
