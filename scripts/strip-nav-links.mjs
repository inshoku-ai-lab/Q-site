/**
 * Delete the in-body "前の記事 ｜ 次の記事" navigation from Notion.
 *
 * scripts/sync-notion.mjs already strips this navigation on the way into
 * posts.json, so the site stops rendering it without touching Notion. This
 * script is the permanent fix: it removes the blocks from the Notion pages
 * themselves, so the source articles are clean for the translation
 * pipeline and for anyone reading them in Notion.
 *
 * Usage:
 *   export NOTION_TOKEN='secret_xxx'
 *   node scripts/strip-nav-links.mjs            # dry run (default)
 *   node scripts/strip-nav-links.mjs --apply    # actually delete
 *   node scripts/strip-nav-links.mjs --apply --series 放浪記
 *
 * Every block it deletes is written to migration/reports/nav-link-backup.json
 * first (page id, block id, plain text, and the URLs it linked to), so a
 * mistaken run can be reconstructed.
 */
import { Client } from "@notionhq/client";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isNavOnlyText, isBareArticleUrlBlock } from "./lib/nav-links.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BACKUP = path.join(ROOT, "migration/reports/nav-link-backup.json");
const DATABASE_ID = "8ec5cc48-52a5-492e-9d0b-377bc4ff3c82";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const seriesIdx = args.indexOf("--series");
const SERIES = seriesIdx !== -1 ? args[seriesIdx + 1] : null;

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("ERROR: NOTION_TOKEN 環境変数が必要です。");
  console.error("  export NOTION_TOKEN='secret_xxx'");
  process.exit(1);
}
const notion = new Client({ auth: token });

/** Plain text of a Notion block's rich_text, for nav detection. */
function plainOf(block) {
  const data = block[block.type] ?? {};
  return (data.rich_text ?? []).map((r) => r.plain_text ?? "").join("");
}

/** Shape a raw Notion block into what the nav matcher expects. */
function asNode(block) {
  if (block.type === "bookmark" || block.type === "embed") {
    return { type: block.type, url: block[block.type]?.url ?? "" };
  }
  return { type: block.type, html: plainOf(block) };
}

async function listChildren(blockId) {
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

async function main() {
  console.log(`モード: ${APPLY ? "APPLY (実削除)" : "DRY RUN (削除しません)"}`);
  if (SERIES) console.log(`対象シリーズ: ${SERIES}`);

  const pages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
      ...(SERIES ? { filter: { property: "Series", select: { equals: SERIES } } } : {}),
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
    process.stdout.write(`\r  ページ取得: ${pages.length}件`);
  } while (cursor);
  console.log(`\n計 ${pages.length} ページを走査します。`);

  const removals = [];
  let scanned = 0;
  for (const page of pages) {
    scanned++;
    const title = (page.properties?.Title?.title ?? []).map((t) => t.plain_text).join("");
    process.stdout.write(`\r  走査 [${scanned}/${pages.length}]      `);

    let children;
    try {
      children = await listChildren(page.id);
    } catch (e) {
      console.error(`\n  ${title}: 本文取得に失敗 — ${e.message}`);
      continue;
    }

    for (let i = 0; i < children.length; i++) {
      const b = children[i];
      if (b.type !== "paragraph") continue;
      if (!isNavOnlyText(plainOf(b))) continue;

      const group = [b];
      // A bare article URL right after the nav line is part of the same
      // navigation -- deleting only the text would orphan the link card.
      let j = i + 1;
      while (j < children.length && children[j].type === "paragraph" && !plainOf(children[j]).trim()) j++;
      if (j < children.length && isBareArticleUrlBlock(asNode(children[j]))) {
        group.push(children[j]);
        i = j;
      }

      for (const blk of group) {
        removals.push({
          page_id: page.id,
          page_title: title,
          block_id: blk.id,
          type: blk.type,
          text: plainOf(blk),
          urls: (blk[blk.type]?.rich_text ?? []).map((r) => r.href).filter(Boolean),
        });
      }
    }
  }
  console.log("");

  const pagesTouched = new Set(removals.map((r) => r.page_id)).size;
  console.log(`削除対象: ${removals.length} ブロック / ${pagesTouched} ページ`);

  await fs.mkdir(path.dirname(BACKUP), { recursive: true });
  await fs.writeFile(BACKUP, JSON.stringify(removals, null, 2), "utf-8");
  console.log(`バックアップを書き出しました: ${path.relative(ROOT, BACKUP)}`);

  if (!APPLY) {
    console.log("\nDRY RUN のため削除していません。内容を確認のうえ --apply を付けて再実行してください。");
    for (const r of removals.slice(0, 10)) {
      console.log(`  ${r.page_title} :: ${JSON.stringify(r.text).slice(0, 70)}`);
    }
    if (removals.length > 10) console.log(`  ... 他 ${removals.length - 10} 件`);
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const r of removals) {
    try {
      await notion.blocks.delete({ block_id: r.block_id });
      deleted++;
    } catch (e) {
      failed++;
      console.error(`\n  削除失敗 ${r.page_title} (${r.block_id}): ${e.message}`);
    }
    process.stdout.write(`\r  削除 [${deleted + failed}/${removals.length}]     `);
  }
  console.log(`\n完了: ${deleted} 削除 / ${failed} 失敗`);
}

await main();
