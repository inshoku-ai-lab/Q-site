/**
 * One-off migration: replace the legacy WordPress "[show_for_guests_and_members]"
 * / "[um_show_content roles='um_custom_role_1']" ... "[/um_show_content]" shortcode
 * wrapper (dead CSS, old membership-join link, old WP prev/next links included)
 * with a single "> 🔒 ここから会員限定" callout marker line, matching what was
 * done by hand for 放浪記039.
 *
 * Usage:
 *   node scripts/migrate-legacy-membership-markers.mjs           (dry run, reports only)
 *   node scripts/migrate-legacy-membership-markers.mjs --apply   (writes changes)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "migration/posts");
const APPLY = process.argv.includes("--apply");

const HEADER_BLOCK_RE =
  /\[show\\_for\\_guests\\_and\\_members\][\s\S]*?\[um\\_show\\_content roles='um\\_custom\\_role\\_1'\]\n*/;
const TRAILING_CLOSE_RE = /\n*\[\/um\\_show\\_content\]\s*$/;

async function main() {
  const files = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  let matched = 0;
  let noHeaderMatch = [];
  let noTrailingMatch = [];
  let changed = 0;

  for (const f of files) {
    const p = path.join(POSTS_DIR, f);
    const original = await fs.readFile(p, "utf-8");
    if (!original.includes("show\\_for\\_guests\\_and\\_members")) continue;

    matched++;
    let text = original;

    if (!HEADER_BLOCK_RE.test(text)) {
      noHeaderMatch.push(f);
      continue;
    }
    text = text.replace(HEADER_BLOCK_RE, "> 🔒 ここから会員限定\n\n");

    if (!TRAILING_CLOSE_RE.test(text)) {
      noTrailingMatch.push(f);
    } else {
      text = text.replace(TRAILING_CLOSE_RE, "\n");
    }

    if (text !== original) {
      changed++;
      if (APPLY) await fs.writeFile(p, text, "utf-8");
    }
  }

  console.log(`対象ファイル(旧ショートコードを含む): ${matched}`);
  console.log(`変換済み: ${changed}`);
  console.log(`ヘッダーブロック不一致(要確認): ${noHeaderMatch.length}`);
  noHeaderMatch.forEach((f) => console.log(`  - ${f}`));
  console.log(`末尾の[/um_show_content]が見つからない(要確認): ${noTrailingMatch.length}`);
  noTrailingMatch.forEach((f) => console.log(`  - ${f}`));
  console.log(APPLY ? "\n書き込み済み(--apply)" : "\nドライランのみ(--applyで実際に書き込み)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
