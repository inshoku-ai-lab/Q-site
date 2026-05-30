"""
Phase 2 - Step 2: Prepare Notion page payloads from enriched posts + MD files.
Outputs JSON batches of ~80 pages each (Notion API limit is 100/call).
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "reports" / "enriched_posts.csv"
POSTS_DIR = ROOT / "posts"
BATCH_DIR = ROOT / "reports" / "notion_batches"
BATCH_DIR.mkdir(exist_ok=True)

CONTENT_MAX = 14000  # Cap per-page content; longer ones logged for follow-up
SKIP_FIRST_N = 1  # Skip first page (already inserted as test)
TARGET_BATCH_BYTES = 18_000  # Keep small so Read can fully load each batch
MAX_PAGES_PER_BATCH = 100  # Notion API hard limit

CATEGORY_VALUES = {"放浪記", "思想・理論", "時事・情報戦", "エッセイ・その他"}
SERIES_VALUES = {"放浪記", "デボリューション理論", "ツイッターファイル", "ティール・スワン",
                 "真のビットコイン (BSV)", "翻訳記事"}
TAGS_VALUES = {"トランプ", "不正選挙", "情報戦争", "戦争", "クーデター", "検閲",
               "イーロン・マスク", "旅行", "自伝", "Qアノン", "BSV", "ビットコイン",
               "コロナ", "放浪", "陰謀論", "ワクチン", "バイデン", "ディープステート", "ヒッピー"}

# Map review_status to Notion Status value
STATUS_MAP = {
    "Published": "Published",
    "Draft": "Draft",
    "Review": "Review",
    "Discard": "Discard",
}


def md_body_only(md_path: Path) -> str:
    """Strip YAML frontmatter, return body markdown."""
    txt = md_path.read_text(encoding="utf-8")
    m = re.match(r"^---\n.*?\n---\n+(.*)", txt, re.DOTALL)
    return m.group(1) if m else txt


def find_md_file(slug: str, date: str) -> Path | None:
    date_prefix = date[:10] if date else ""
    candidate = POSTS_DIR / f"{date_prefix}_{slug}.md"
    if candidate.exists():
        return candidate
    # Fallback: search by slug
    hits = list(POSTS_DIR.glob(f"*_{slug}.md"))
    return hits[0] if hits else None


def build_page(row: dict) -> dict:
    title = row["title"].strip() or f"(無題-{row['id']})"
    # Notion title length limit is 2000
    if len(title) > 1900:
        title = title[:1900] + "…"

    date_iso = row["date"]
    if date_iso:
        # Convert "2022-10-26 08:39:00" -> "2022-10-26T08:39:00"
        date_iso = date_iso.replace(" ", "T") if "T" not in date_iso else date_iso

    char_count = int(row.get("char_count") or 0)
    reading_time = max(1, round(char_count / 500))  # ~500 chars/min for Japanese

    # Properties
    props = {
        "Title": title,
        "Status": STATUS_MAP.get(row["review_status"], "Review"),
        "Slug": row["slug"],
        "WP URL": row["original_url"],
        "WP ID": int(row["id"]),
        "Char Count": char_count,
        "Image Count": int(row.get("image_count") or 0),
        "Reading Time": reading_time,
        "Featured": "__NO__",
    }

    if row["new_category"] in CATEGORY_VALUES:
        props["Category"] = row["new_category"]
    if row["series"] in SERIES_VALUES:
        props["Series"] = row["series"]
    if row["episode"]:
        try:
            props["Episode #"] = int(row["episode"])
        except ValueError:
            pass
    if row["sub_episode"]:
        props["Sub Episode"] = row["sub_episode"]
    if row["excerpt"]:
        props["Excerpt"] = row["excerpt"][:1900]
    if date_iso:
        props["date:Date:start"] = date_iso
        props["date:Date:is_datetime"] = 1

    # Tags: must be JSON array string
    tags = [t.strip() for t in row["new_tags"].split(";") if t.strip() and t.strip() in TAGS_VALUES]
    if tags:
        props["Tags"] = json.dumps(tags, ensure_ascii=False)

    # Content
    md_path = find_md_file(row["slug"], row["date"])
    if md_path:
        content = md_body_only(md_path)
    else:
        content = "(本文の取得に失敗しました)"

    if len(content) > CONTENT_MAX:
        content = content[:CONTENT_MAX] + "\n\n…(中略 - 本文が長すぎるため自動切詰)"

    return {"properties": props, "content": content}


def main():
    with CSV_PATH.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    pages = [build_page(r) for r in rows]
    print(f"Total pages prepared: {len(pages)}")

    # Sort by date so insertion is chronological
    def sort_key(p):
        return p["properties"].get("date:Date:start", "0000")
    pages.sort(key=sort_key)

    # Skip the first N (already inserted)
    if SKIP_FIRST_N:
        pages = pages[SKIP_FIRST_N:]
        print(f"Skipping first {SKIP_FIRST_N} (already inserted as test)")

    # Clean existing batches
    for old in BATCH_DIR.glob("batch_*.json"):
        old.unlink()

    # Adaptive batching: keep each batch JSON under TARGET_BATCH_BYTES
    batches = []
    current = []
    current_size = 2  # for [] brackets
    for p in pages:
        page_size = len(json.dumps(p, ensure_ascii=False)) + 1  # comma
        if (current and (current_size + page_size > TARGET_BATCH_BYTES
                          or len(current) >= MAX_PAGES_PER_BATCH)):
            batches.append(current)
            current = []
            current_size = 2
        current.append(p)
        current_size += page_size
    if current:
        batches.append(current)

    truncated_pages = []
    for i, batch in enumerate(batches):
        batch_path = BATCH_DIR / f"batch_{i:03d}.json"
        # Pretty print so Read tool can paginate by lines
        batch_path.write_text(json.dumps(batch, ensure_ascii=False, indent=1), encoding="utf-8")
        for p in batch:
            if "中略 - 本文が長すぎるため自動切詰" in p["content"]:
                truncated_pages.append({
                    "wp_id": p["properties"]["WP ID"],
                    "title": p["properties"]["Title"],
                    "batch": batch_path.name,
                })
    print(f"Total batches: {len(batches)}")

    if truncated_pages:
        trunc_path = BATCH_DIR / "_truncated_pages.json"
        trunc_path.write_text(json.dumps(truncated_pages, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Truncated pages logged: {len(truncated_pages)} -> {trunc_path}")

    # Total content size sanity check
    total_chars = sum(len(p["content"]) for p in pages)
    print(f"\nTotal content chars: {total_chars:,}")
    print(f"Avg per page: {total_chars // len(pages):,}")
    longest = max(pages, key=lambda p: len(p["content"]))
    print(f"Longest page: {len(longest['content']):,} chars - {longest['properties']['Title'][:60]}")


if __name__ == "__main__":
    main()
