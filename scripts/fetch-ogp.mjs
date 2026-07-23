/**
 * Fetch OGP (title/image) metadata for external links used by blog cards
 * -> src/data/ogp-cache.json
 *
 * Runs after `npm run sync` (see vercel.json's buildCommand) so it has a
 * fresh posts.json to scan. Best-effort: network failures for individual
 * URLs never fail the build -- they just leave that card showing the
 * plain domain/URL fallback (see BlogCard.astro / renderBlocksToHtml.ts).
 *
 * The cache is a plain committed JSON file (unlike posts.json, which is
 * gitignored) so that entries fetched once don't need re-fetching on
 * every deploy -- only URLs not already present get requested.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_JSON = path.join(ROOT, "src/data/posts.json");
const CACHE_JSON = path.join(ROOT, "src/data/ogp-cache.json");

const RESERVED_SLUGS = new Set([
  "about", "archive", "series", "category", "tag", "posts", "rss.xml",
  "sitemap-index.xml", "sitemap-0.xml", "_astro", "favicon.ico", "favicon.svg", "404",
]);

// Mirrors src/lib/posts.ts's blogcard-shortcode + bare-URL extraction.
// Kept as a standalone copy since this is a plain Node script, not part
// of the Astro/TS build graph (see the same pattern in renderBlocksToHtml.ts).
const BLOGCARD_RE =
  /\[{1,2}blogcard url="(?:&lt;)?([^"]*)"?(?:&gt;)?\]{0,2}(?:&gt;)?(?:(?!\[{1,2}blogcard)[[\]) "])*(?:\(https?:\/\/[^)]*\))?/gi;
const BARE_URL_RE = /https?:\/\/[^\s<>"]+/gi;

function cleanUrl(raw) {
  return raw.replace(/\\_/g, "_").replace(/&amp;/g, "&").trim();
}

function isValidUrl(s) {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

function extractCandidateUrls(html) {
  const out = [];
  const stripped = html.replace(/&lt;(https?:\/\/[^\s&]+?)&gt;/gi, "$1");
  BLOGCARD_RE.lastIndex = 0;
  let m;
  while ((m = BLOGCARD_RE.exec(stripped))) {
    const url = cleanUrl(m[1] ?? "");
    if (url) out.push(url);
  }
  const withoutShortcodes = stripped.replace(BLOGCARD_RE, " ");
  BARE_URL_RE.lastIndex = 0;
  while ((m = BARE_URL_RE.exec(withoutShortcodes))) {
    const trimmed = m[0].replace(/[)\].,;:!?、。」]+$/, "");
    out.push(cleanUrl(trimmed));
  }
  return out;
}

function isInternal(url, knownSlugs) {
  try {
    const u = new URL(url);
    if (!/^(www\.)?qryptraveller\.com$/i.test(u.hostname)) return false;
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) return false;
    const slug = decodeURIComponent(segments[0]);
    if (RESERVED_SLUGS.has(slug)) return false;
    return knownSlugs.has(slug);
  } catch {
    return false;
  }
}

function collectExternalUrls(posts) {
  const knownSlugs = new Set(posts.map((p) => p.slug));
  const urls = new Set();
  for (const p of posts) {
    if (p.status !== "Published" && p.status !== "Review") continue;
    for (const b of p.blocks ?? []) {
      if ((b.type === "bookmark" || b.type === "embed") && b.url) {
        if (isValidUrl(b.url) && !isInternal(b.url, knownSlugs)) urls.add(b.url);
        continue;
      }
      if (!b.html) continue;
      for (const url of extractCandidateUrls(b.html)) {
        if (isValidUrl(url) && !isInternal(url, knownSlugs)) urls.add(url);
      }
    }
  }
  return [...urls];
}

function matchMeta(html, prop) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re1) || html.match(re2);
  return m ? m[1] : null;
}

function matchTitleTag(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

const REQUEST_TIMEOUT_MS = 6000;
const MAX_BYTES = 300_000;

async function fetchOgp(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok || !res.body) return { failed: true };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});

    const rawTitle = matchMeta(html, "og:title") || matchTitleTag(html);
    let image = matchMeta(html, "og:image") || matchMeta(html, "twitter:image");
    if (image) {
      try {
        image = new URL(image, res.url || url).href;
      } catch {
        image = null;
      }
    }
    const siteName = matchMeta(html, "og:site_name");
    if (!rawTitle && !image) return { failed: true };
    return {
      title: rawTitle ? decodeEntities(rawTitle).slice(0, 200) : null,
      image: image || null,
      siteName: siteName ? decodeEntities(siteName).slice(0, 100) : null,
    };
  } catch {
    return { failed: true };
  } finally {
    clearTimeout(timer);
  }
}

const CONCURRENCY = 8;

async function main() {
  let posts;
  try {
    posts = JSON.parse(await fs.readFile(POSTS_JSON, "utf-8"));
  } catch {
    console.warn("fetch-ogp: posts.json not found (run `npm run sync` first) -- skipping.");
    return;
  }
  if (!Array.isArray(posts) || posts.length === 0) {
    console.warn("fetch-ogp: posts.json is empty -- skipping.");
    return;
  }

  let cache = {};
  try {
    cache = JSON.parse(await fs.readFile(CACHE_JSON, "utf-8"));
  } catch {
    cache = {};
  }

  const allUrls = collectExternalUrls(posts);
  const toFetch = allUrls.filter((u) => !cache[u] || cache[u].failed);
  console.log(
    `fetch-ogp: ${allUrls.length} external URL(s) referenced, ${Object.keys(cache).length} cached, ${toFetch.length} to fetch.`,
  );

  let fetched = 0;
  let failed = 0;
  let idx = 0;
  async function worker() {
    while (idx < toFetch.length) {
      const url = toFetch[idx++];
      const result = await fetchOgp(url);
      cache[url] = { ...result, fetchedAt: new Date().toISOString() };
      if (result.failed) failed++;
      else fetched++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }, worker));

  await fs.writeFile(CACHE_JSON, JSON.stringify(cache, null, 2) + "\n", "utf-8");
  console.log(`fetch-ogp: done. fetched=${fetched} failed=${failed} cacheSize=${Object.keys(cache).length}`);
}

main().catch((err) => {
  console.error("fetch-ogp: unexpected error (continuing without blocking the build):", err);
});
