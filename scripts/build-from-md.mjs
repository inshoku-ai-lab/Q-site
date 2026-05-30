/**
 * Build src/data/posts.json from migration/posts/*.md + enriched_posts.csv
 * Use this when you don't have NOTION_TOKEN (or for offline development).
 *
 * Usage:
 *   node scripts/build-from-md.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "migration/posts");
const CSV_PATH = path.join(ROOT, "migration/reports/enriched_posts.csv");
const OUT = path.join(ROOT, "src/data/posts.json");

await fs.mkdir(path.dirname(OUT), { recursive: true });

// CSV parsing (handles quoted fields)
function parseCSV(text) {
  const rows = [];
  let i = 0;
  let row = [];
  let cur = "";
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cur += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(cur); cur = ""; i++; continue; }
    if (c === "\n" || c === "\r") {
      if (cur !== "" || row.length) { row.push(cur); rows.push(row); row = []; cur = ""; }
      if (c === "\r" && text[i + 1] === "\n") i++;
      i++; continue;
    }
    cur += c; i++;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, idx) => [h, r[idx] ?? ""])));
}

function richTextHtml(plain) {
  // Convert [text](url) and **bold** to HTML
  let out = plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const safeUrl = u.replace(/"/g, "&quot;");
    return `<a href="${safeUrl}" rel="noopener" target="_blank">${t}</a>`;
  });
  out = out.replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => {
    const safeUrl = u.replace(/"/g, "&quot;");
    return `<a href="${safeUrl}" rel="noopener" target="_blank">${u}</a>`;
  });
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  return out;
}

function mdToBlocks(md) {
  const blocks = [];
  const lines = md.split("\n");
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let codeLang = "plain text";

  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, "");
    if (line.startsWith("```")) {
      if (!inCode) { inCode = true; codeLang = line.slice(3).trim() || "plain text"; codeBuf = []; }
      else { blocks.push({ type: "code", code: codeBuf.join("\n"), language: codeLang }); inCode = false; }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }
    if (!line.trim()) { i++; continue; }

    // Image
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
    if (img) {
      blocks.push({ type: "image", src: img[2], caption: img[1] || "" });
      i++; continue;
    }

    if (line.startsWith("# ")) blocks.push({ type: "heading_1", html: richTextHtml(line.slice(2).trim()) });
    else if (line.startsWith("## ")) blocks.push({ type: "heading_2", html: richTextHtml(line.slice(3).trim()) });
    else if (line.startsWith("### ")) blocks.push({ type: "heading_3", html: richTextHtml(line.slice(4).trim()) });
    else if (/^####+\s/.test(line)) blocks.push({ type: "heading_3", html: richTextHtml(line.replace(/^#+\s/, "").trim()) });
    else if (line.startsWith("> ")) blocks.push({ type: "quote", html: richTextHtml(line.slice(2).trim()) });
    else if (/^[-*+]\s+/.test(line)) blocks.push({ type: "bulleted_list_item", html: richTextHtml(line.replace(/^[-*+]\s+/, "")) });
    else if (/^\d+\.\s+/.test(line)) blocks.push({ type: "numbered_list_item", html: richTextHtml(line.replace(/^\d+\.\s+/, "")) });
    else if (/^---+\s*$/.test(line)) blocks.push({ type: "divider" });
    else blocks.push({ type: "paragraph", html: richTextHtml(line.trim()) });

    i++;
  }
  return blocks;
}

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

function stripFrontmatter(text) {
  const m = text.match(/^---\n[\s\S]*?\n---\n+([\s\S]*)$/);
  return m ? m[1] : text;
}

function extractCover(blocks) {
  for (const b of blocks) {
    if (b.type === "image" && b.src) return b.src;
  }
  return null;
}

function extractExcerpt(blocks, maxLen = 140) {
  let txt = "";
  for (const b of blocks) {
    if (b.type === "paragraph" && b.html) {
      const plain = b.html.replace(/<[^>]+>/g, "").trim();
      if (plain) txt += (txt ? " " : "") + plain;
      if (txt.length >= maxLen) break;
    }
  }
  return txt.slice(0, maxLen).trim();
}

async function main() {
  const csvText = await fs.readFile(CSV_PATH, "utf-8");
  const rows = parseCSV(csvText);
  console.log(`CSV rows: ${rows.length}`);

  const posts = [];
  let i = 0;
  for (const row of rows) {
    i++;
    if (row.review_status === "Discard" || row.review_status === "Draft") continue;

    // Find MD file
    const datePrefix = (row.date || "").slice(0, 10);
    const slug = row.slug;
    let mdPath = path.join(POSTS_DIR, `${datePrefix}_${slug}.md`);
    try { await fs.access(mdPath); } catch { mdPath = null; }
    if (!mdPath) {
      try {
        const files = await fs.readdir(POSTS_DIR);
        const m = files.find((f) => f.endsWith(`_${slug}.md`));
        if (m) mdPath = path.join(POSTS_DIR, m);
      } catch {}
    }
    let body = "(本文の取得に失敗しました)";
    if (mdPath) {
      try {
        body = stripFrontmatter(await fs.readFile(mdPath, "utf-8"));
      } catch {}
    }

    const blocks = mdToBlocks(body);
    rewriteBlocks(blocks);

    const tags = (row.new_tags || "").split(";").map((t) => t.trim()).filter(Boolean);

    posts.push({
      id: Number(row.id),
      notion_id: null,
      title: row.title || `(無題-${row.id})`,
      slug: slug,
      date: row.date ? row.date.replace(" ", "T") : null,
      status: row.review_status === "Review" ? "Review" : "Published",
      category: row.new_category || null,
      series: row.series || null,
      episode: row.episode ? Number(row.episode) : null,
      sub_episode: row.sub_episode || null,
      tags,
      featured: false,
      excerpt: row.excerpt || extractExcerpt(blocks),
      seo_description: "",
      reading_time: Math.max(1, Math.round((Number(row.char_count) || 0) / 500)) || 1,
      char_count: Number(row.char_count) || 0,
      image_count: Number(row.image_count) || 0,
      wp_url: row.original_url || null,
      cover: extractCover(blocks),
      blocks,
    });

    if (i % 100 === 0) process.stdout.write(`\r  処理済み: ${i}/${rows.length}`);
  }
  process.stdout.write("\n");

  posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  await fs.writeFile(OUT, JSON.stringify(posts, null, 1), "utf-8");
  console.log(`✓ ${OUT} に ${posts.length} 件書き出し完了`);
}

main().catch((e) => { console.error(e); process.exit(1); });
