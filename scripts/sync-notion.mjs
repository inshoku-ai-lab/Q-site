/**
 * Sync Notion "Blog Articles" DB → src/data/posts.json
 *
 * Usage:
 *   export NOTION_TOKEN='secret_xxx'
 *   npm run sync
 *
 * Output:
 *   src/data/posts.json         — array of post metadata + body blocks
 *   src/data/sync-state.json    — last sync info
 */
import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "src/data");
const POSTS_JSON = path.join(DATA_DIR, "posts.json");
const STATE_JSON = path.join(DATA_DIR, "sync-state.json");

const DATABASE_ID = "8ec5cc48-52a5-492e-9d0b-377bc4ff3c82";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("ERROR: NOTION_TOKEN 環境変数が必要です。");
  console.error("  export NOTION_TOKEN='secret_xxx'");
  process.exit(1);
}

const notion = new Client({ auth: token });

await fs.mkdir(DATA_DIR, { recursive: true });

// --------------------------------------------------------------
// Property extractors
// --------------------------------------------------------------
function plainText(rich) {
  if (!rich) return "";
  return (Array.isArray(rich) ? rich : [rich]).map((t) => t.plain_text ?? "").join("");
}
const get = {
  title: (p, name) => plainText(p[name]?.title),
  text: (p, name) => plainText(p[name]?.rich_text),
  select: (p, name) => p[name]?.select?.name ?? null,
  multi: (p, name) => (p[name]?.multi_select ?? []).map((o) => o.name),
  number: (p, name) => p[name]?.number ?? null,
  url: (p, name) => p[name]?.url ?? null,
  checkbox: (p, name) => p[name]?.checkbox ?? false,
  date: (p, name) => p[name]?.date?.start ?? null,
};

// --------------------------------------------------------------
// Block normalisation (recursive)
// --------------------------------------------------------------
async function fetchChildren(blockId) {
  const out = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return out;
}

function richToHtml(rich) {
  if (!rich) return "";
  return rich
    .map((r) => {
      let content = escapeHtml(r.plain_text ?? "");
      const a = r.annotations ?? {};
      if (a.code) content = `<code>${content}</code>`;
      if (a.bold) content = `<strong>${content}</strong>`;
      if (a.italic) content = `<em>${content}</em>`;
      if (a.strikethrough) content = `<s>${content}</s>`;
      if (a.underline) content = `<u>${content}</u>`;
      if (r.href) content = `<a href="${escapeAttr(r.href)}" rel="noopener" target="_blank">${content}</a>`;
      return content;
    })
    .join("");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

async function blockToNode(block) {
  const type = block.type;
  const data = block[type] ?? {};
  const node = { type };

  switch (type) {
    case "paragraph":
    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "bulleted_list_item":
    case "numbered_list_item":
    case "quote":
    case "callout":
    case "toggle":
      node.html = richToHtml(data.rich_text);
      break;
    case "code":
      node.code = (data.rich_text ?? []).map((r) => r.plain_text).join("");
      node.language = data.language ?? "plain text";
      break;
    case "image": {
      const src = data.type === "external" ? data.external?.url : data.file?.url;
      node.src = src ?? "";
      node.caption = richToHtml(data.caption);
      break;
    }
    case "video":
    case "embed":
    case "bookmark": {
      node.url = data.url ?? data.external?.url ?? "";
      node.caption = richToHtml(data.caption);
      break;
    }
    case "divider":
      break;
    case "table": {
      // We will recurse and pick up table_row children below
      node.has_column_header = data.has_column_header ?? false;
      node.has_row_header = data.has_row_header ?? false;
      break;
    }
    case "table_row":
      node.cells = (data.cells ?? []).map((c) => richToHtml(c));
      break;
    default:
      node.html = richToHtml(data.rich_text);
  }

  if (block.has_children) {
    const children = await fetchChildren(block.id);
    node.children = [];
    for (const c of children) {
      node.children.push(await blockToNode(c));
    }
  }
  return node;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------
function slugify(s) {
  if (!s) return "untitled";
  // Keep original WP slug if it's URL-safe
  return s.normalize("NFKC");
}
function readingTimeFromBlocks(blocks) {
  let chars = 0;
  const walk = (n) => {
    if (n.html) chars += n.html.replace(/<[^>]+>/g, "").length;
    if (n.code) chars += n.code.length;
    (n.children ?? []).forEach(walk);
  };
  blocks.forEach(walk);
  return Math.max(1, Math.round(chars / 500));
}
function extractCover(blocks) {
  for (const b of blocks) {
    if (b.type === "image" && b.src) return b.src;
    if (b.children) {
      const sub = extractCover(b.children);
      if (sub) return sub;
    }
  }
  return null;
}
function extractExcerpt(blocks, maxLen = 140) {
  let txt = "";
  const walk = (n) => {
    if (txt.length >= maxLen) return;
    if (n.type === "paragraph" && n.html) {
      const plain = n.html.replace(/<[^>]+>/g, "").trim();
      if (plain && txt.length < maxLen) {
        txt += (txt ? " " : "") + plain;
      }
    }
    (n.children ?? []).forEach(walk);
  };
  blocks.forEach(walk);
  return txt.slice(0, maxLen).trim();
}

// Rewrite legacy qryptraveller.com image URLs to local /images/wp/...
function rewriteImageSrc(src) {
  if (!src) return src;
  const m = src.match(/^https?:\/\/(?:www\.)?qryptraveller\.com\/wp-content\/(.+)$/);
  if (m) return `/images/wp/wp-content/${m[1]}`;
  return src;
}
function rewriteBlocks(blocks) {
  for (const b of blocks) {
    if (b.type === "image") b.src = rewriteImageSrc(b.src);
    if (b.children) rewriteBlocks(b.children);
  }
}

// --------------------------------------------------------------
// Main
// --------------------------------------------------------------
async function main() {
  console.log("Notion DB をクエリ中...");
  const allPages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    allPages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
    process.stdout.write(`\r  取得済み: ${allPages.length}件`);
  } while (cursor);
  console.log(`\n計 ${allPages.length} ページ取得しました。`);

  // Filter out Discard / Draft (only Published + Review for now)
  const publishable = allPages.filter((p) => {
    const status = get.select(p.properties, "Status");
    return status === "Published" || status === "Review";
  });
  console.log(`公開対象: ${publishable.length} (Published + Review)`);

  // Sort by date (newest first for processing display)
  publishable.sort((a, b) => {
    const da = get.date(a.properties, "Date") || "";
    const db = get.date(b.properties, "Date") || "";
    return db.localeCompare(da);
  });

  const posts = [];
  let i = 0;
  for (const page of publishable) {
    i++;
    const props = page.properties;
    const wpId = get.number(props, "WP ID");
    const title = get.title(props, "Title") || `(無題-${wpId})`;
    process.stdout.write(`\r  本文取得 [${i}/${publishable.length}] WP${wpId}     `);

    let blocks = [];
    try {
      const raw = await fetchChildren(page.id);
      for (const b of raw) blocks.push(await blockToNode(b));
      rewriteBlocks(blocks);
    } catch (e) {
      console.error(`\nWP${wpId} の本文取得に失敗:`, e.message);
    }

    const slug = get.text(props, "Slug") || slugify(title);
    posts.push({
      id: wpId ?? `notion-${page.id.slice(0, 8)}`,
      notion_id: page.id,
      title,
      slug,
      date: get.date(props, "Date"),
      status: get.select(props, "Status"),
      category: get.select(props, "Category"),
      series: get.select(props, "Series"),
      episode: get.number(props, "Episode #"),
      sub_episode: get.text(props, "Sub Episode"),
      tags: get.multi(props, "Tags"),
      featured: get.checkbox(props, "Featured"),
      excerpt: get.text(props, "Excerpt") || extractExcerpt(blocks),
      seo_description: get.text(props, "SEO Description"),
      reading_time: get.number(props, "Reading Time") || readingTimeFromBlocks(blocks),
      char_count: get.number(props, "Char Count"),
      image_count: get.number(props, "Image Count"),
      wp_url: get.url(props, "WP URL"),
      cover: extractCover(blocks),
      blocks,
    });
  }
  console.log("");

  // Sort final output newest-first
  posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  await fs.writeFile(POSTS_JSON, JSON.stringify(posts, null, 1), "utf-8");
  await fs.writeFile(
    STATE_JSON,
    JSON.stringify(
      {
        synced_at: new Date().toISOString(),
        total_pages: allPages.length,
        published: posts.length,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`\n✓ ${POSTS_JSON} に ${posts.length} 件書き出し完了`);
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
