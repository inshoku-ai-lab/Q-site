"""
Notion 一括インポートスクリプト (スタンドアロン版)

使い方:
  1. このファイル、enriched_posts.csv、posts/ フォルダを同じディレクトリ階層に置く
       例:
         my-folder/
           06_notion_import.py
           enriched_posts.csv
           posts/
             2021-09-30_xxx.md
             ...

  2. ターミナルで:
       source venv/bin/activate     # 仮想環境 (Phase 1 で作ったもの)
       pip install requests
       export NOTION_TOKEN='secret_xxxxxxxx...'   # あなたのトークン
       python3 06_notion_import.py

  3. 完了後、import_log.csv で結果を確認できます
  4. 中断しても再実行で続きから (resumable)
"""
import csv
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List

import requests

# ============================================================
# 設定
# ============================================================
HERE = Path(__file__).resolve().parent
CSV_PATH = HERE / "enriched_posts.csv"
POSTS_DIR = HERE / "posts"
STATE_PATH = HERE / "import_state.json"
LOG_PATH = HERE / "import_log.csv"

DATABASE_ID = "8ec5cc48-52a5-492e-9d0b-377bc4ff3c82"

TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
if not TOKEN:
    print("ERROR: 環境変数 NOTION_TOKEN を設定してください。")
    print("  例: export NOTION_TOKEN='secret_xxx...'")
    sys.exit(1)

API_BASE = "https://api.notion.com/v1"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}

MAX_WORKERS = 4   # 並列数 (Notion APIのレート制限は3req/sec程度)
RATE_DELAY = 0.35 # リクエスト間隔(秒)
MAX_RICH_TEXT = 2000
MAX_BLOCKS_PER_CALL = 100

CATEGORY_VALUES = {"放浪記", "思想・理論", "時事・情報戦", "エッセイ・その他"}
SERIES_VALUES = {"放浪記", "デボリューション理論", "ツイッターファイル", "ティール・スワン",
                 "真のビットコイン (BSV)", "翻訳記事"}
TAGS_VALUES = {"トランプ", "不正選挙", "情報戦争", "戦争", "クーデター", "検閲",
               "イーロン・マスク", "旅行", "自伝", "Qアノン", "BSV", "ビットコイン",
               "コロナ", "放浪", "陰謀論", "ワクチン", "バイデン", "ディープステート", "ヒッピー"}

# 既にテスト投入済みのWP ID (重複防止)
ALREADY_INSERTED_WP_IDS = {565}


# ============================================================
# Markdown → Notion blocks
# ============================================================
def split_rich_text(text: str) -> List[dict]:
    """Split text into segments with inline annotations (link, bold)."""
    segments = []
    pattern = re.compile(
        r'(\*\*([^*\n]+?)\*\*)'        # **bold**
        r'|(\[([^\]]+?)\]\(([^)\s]+)\))'  # [text](url)
        r'|(<(https?://[^>\s]+)>)'      # <url>
    )
    pos = 0
    for m in pattern.finditer(text):
        if m.start() > pos:
            segments.append(("plain", text[pos:m.start()]))
        if m.group(1):  # bold
            segments.append(("bold", m.group(2)))
        elif m.group(3):  # link
            segments.append(("link", (m.group(4), m.group(5))))
        elif m.group(6):  # autolink
            segments.append(("link", (m.group(7), m.group(7))))
        pos = m.end()
    if pos < len(text):
        segments.append(("plain", text[pos:]))
    if not segments:
        segments = [("plain", text)]

    rich = []
    for kind, val in segments:
        if kind == "plain":
            if not val:
                continue
            for chunk in chunk_text(val, MAX_RICH_TEXT):
                rich.append({"type": "text", "text": {"content": chunk}})
        elif kind == "bold":
            for chunk in chunk_text(val, MAX_RICH_TEXT):
                rich.append({
                    "type": "text",
                    "text": {"content": chunk},
                    "annotations": {"bold": True},
                })
        elif kind == "link":
            txt, url = val
            for chunk in chunk_text(txt, MAX_RICH_TEXT):
                rich.append({
                    "type": "text",
                    "text": {"content": chunk, "link": {"url": url}},
                })
    return rich


def chunk_text(text: str, size: int):
    if not text:
        return []
    return [text[i:i+size] for i in range(0, len(text), size)]


def make_block(block_type: str, text: str = "", **extras) -> dict:
    block = {"object": "block", "type": block_type}
    payload = {}
    if text:
        payload["rich_text"] = split_rich_text(text)
    payload.update(extras)
    block[block_type] = payload
    return block


def md_to_blocks(md: str) -> List[dict]:
    blocks: List[dict] = []
    lines = md.split("\n")
    i = 0
    in_code = False
    code_buf = []
    code_lang = "plain text"

    while i < len(lines):
        line = lines[i].rstrip("\r")

        # Fenced code blocks
        if line.startswith("```"):
            if not in_code:
                in_code = True
                code_lang = line[3:].strip() or "plain text"
                code_buf = []
            else:
                content = "\n".join(code_buf)[:MAX_RICH_TEXT]
                blocks.append({
                    "object": "block",
                    "type": "code",
                    "code": {
                        "rich_text": [{"type": "text", "text": {"content": content}}],
                        "language": code_lang if code_lang in {
                            "abap","arduino","bash","basic","c","clojure","coffeescript","c++","c#",
                            "css","dart","diff","docker","elixir","elm","erlang","flow","fortran","f#",
                            "gherkin","glsl","go","graphql","groovy","haskell","html","java","javascript",
                            "json","julia","kotlin","latex","less","lisp","livescript","lua","makefile",
                            "markdown","markup","matlab","mermaid","nix","objective-c","ocaml","pascal",
                            "perl","php","plain text","powershell","prolog","protobuf","python","r","reason",
                            "ruby","rust","sass","scala","scheme","scss","shell","sql","swift","typescript",
                            "vb.net","verilog","vhdl","visual basic","webassembly","xml","yaml"
                        } else "plain text",
                    },
                })
                in_code = False
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # Empty line
        if not line.strip():
            i += 1
            continue

        # Image: ![alt](url)
        m = re.match(r"!\[([^\]]*)\]\(([^)\s]+)\)", line.strip())
        if m:
            url = m.group(2)
            if url.startswith(("http://", "https://")):
                blocks.append({
                    "object": "block",
                    "type": "image",
                    "image": {"type": "external", "external": {"url": url}},
                })
            i += 1
            continue

        # Headings
        if line.startswith("# "):
            blocks.append(make_block("heading_1", line[2:].strip()))
        elif line.startswith("## "):
            blocks.append(make_block("heading_2", line[3:].strip()))
        elif line.startswith("### "):
            blocks.append(make_block("heading_3", line[4:].strip()))
        elif line.startswith("#### ") or line.startswith("##### ") or line.startswith("###### "):
            # Demote to h3 (Notion only supports h1-h3)
            blocks.append(make_block("heading_3", line.lstrip("#").strip()))
        # Quote
        elif line.startswith("> "):
            blocks.append(make_block("quote", line[2:].strip()))
        # Bullet list
        elif re.match(r"^[-*+]\s+", line):
            blocks.append(make_block("bulleted_list_item", re.sub(r"^[-*+]\s+", "", line)))
        # Numbered list
        elif re.match(r"^\d+\.\s+", line):
            blocks.append(make_block("numbered_list_item", re.sub(r"^\d+\.\s+", "", line)))
        # Horizontal rule
        elif re.match(r"^---+\s*$", line):
            blocks.append({"object": "block", "type": "divider", "divider": {}})
        # Paragraph (single line; markdownify produces line-per-paragraph)
        else:
            blocks.append(make_block("paragraph", line.strip()))
        i += 1

    # Close any unclosed code block
    if in_code and code_buf:
        content = "\n".join(code_buf)[:MAX_RICH_TEXT]
        blocks.append({
            "object": "block",
            "type": "code",
            "code": {
                "rich_text": [{"type": "text", "text": {"content": content}}],
                "language": "plain text",
            },
        })

    return blocks


# ============================================================
# Properties builder
# ============================================================
def build_properties(row: dict) -> dict:
    title = (row["title"] or f"(無題-{row['id']})").strip()
    if len(title) > 1900:
        title = title[:1900] + "…"

    char_count = int(row.get("char_count") or 0)
    reading_time = max(1, round(char_count / 500))

    props = {
        "Title": {"title": [{"type": "text", "text": {"content": title}}]},
        "Status": {"select": {"name": {"Published": "Published", "Draft": "Draft",
                                       "Review": "Review", "Discard": "Discard"}.get(
            row["review_status"], "Review")}},
        "Slug": {"rich_text": [{"type": "text", "text": {"content": row["slug"][:1900]}}]},
        "WP URL": {"url": row["original_url"] or None},
        "WP ID": {"number": int(row["id"])},
        "Char Count": {"number": char_count},
        "Image Count": {"number": int(row.get("image_count") or 0)},
        "Reading Time": {"number": reading_time},
        "Featured": {"checkbox": False},
    }

    if row["new_category"] in CATEGORY_VALUES:
        props["Category"] = {"select": {"name": row["new_category"]}}
    if row["series"] in SERIES_VALUES:
        props["Series"] = {"select": {"name": row["series"]}}
    if row["episode"]:
        try:
            props["Episode #"] = {"number": int(row["episode"])}
        except ValueError:
            pass
    if row["sub_episode"]:
        props["Sub Episode"] = {"rich_text": [{"type": "text",
                                               "text": {"content": row["sub_episode"][:1900]}}]}
    if row["excerpt"]:
        props["Excerpt"] = {"rich_text": [{"type": "text",
                                           "text": {"content": row["excerpt"][:1900]}}]}
    if row["date"]:
        date_iso = row["date"].replace(" ", "T") if "T" not in row["date"] else row["date"]
        props["Date"] = {"date": {"start": date_iso}}

    tags = [t.strip() for t in row["new_tags"].split(";")
            if t.strip() and t.strip() in TAGS_VALUES]
    if tags:
        props["Tags"] = {"multi_select": [{"name": t} for t in tags]}

    return props


# ============================================================
# Content loader
# ============================================================
def find_md_file(slug: str, date: str) -> Path | None:
    if not slug:
        return None
    date_prefix = date[:10] if date else ""
    candidate = POSTS_DIR / f"{date_prefix}_{slug}.md"
    if candidate.exists():
        return candidate
    hits = list(POSTS_DIR.glob(f"*_{slug}.md"))
    return hits[0] if hits else None


def load_body(md_path: Path) -> str:
    if not md_path:
        return "(本文の取得に失敗しました)"
    txt = md_path.read_text(encoding="utf-8")
    m = re.match(r"^---\n.*?\n---\n+(.*)", txt, re.DOTALL)
    return m.group(1) if m else txt


# ============================================================
# Notion API calls
# ============================================================
def post_with_retry(url: str, payload: dict, max_retries: int = 5) -> dict:
    for attempt in range(max_retries):
        try:
            r = requests.post(url, headers=HEADERS, json=payload, timeout=60)
            if r.status_code == 200 or r.status_code == 201:
                return r.json()
            if r.status_code == 429:
                wait = float(r.headers.get("Retry-After", 2))
                time.sleep(wait)
                continue
            if r.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:500]}")
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("Max retries exhausted")


def patch_with_retry(url: str, payload: dict, max_retries: int = 5) -> dict:
    for attempt in range(max_retries):
        try:
            r = requests.patch(url, headers=HEADERS, json=payload, timeout=60)
            if r.status_code in (200, 201):
                return r.json()
            if r.status_code == 429:
                wait = float(r.headers.get("Retry-After", 2))
                time.sleep(wait)
                continue
            if r.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:500]}")
        except requests.RequestException:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("Max retries exhausted")


def create_page(row: dict) -> tuple:
    """Returns (wp_id, notion_page_id or '', status, error_msg)."""
    wp_id = int(row["id"])
    try:
        properties = build_properties(row)
        md_path = find_md_file(row["slug"], row["date"])
        body = load_body(md_path)
        blocks = md_to_blocks(body)
        first_chunk = blocks[:MAX_BLOCKS_PER_CALL]
        rest = blocks[MAX_BLOCKS_PER_CALL:]

        payload = {
            "parent": {"database_id": DATABASE_ID},
            "properties": properties,
            "children": first_chunk,
        }
        res = post_with_retry(f"{API_BASE}/pages", payload)
        page_id = res["id"]

        # Append remaining blocks in chunks of 100
        while rest:
            chunk = rest[:MAX_BLOCKS_PER_CALL]
            rest = rest[MAX_BLOCKS_PER_CALL:]
            patch_with_retry(
                f"{API_BASE}/blocks/{page_id}/children",
                {"children": chunk},
            )
            time.sleep(RATE_DELAY)

        return (wp_id, page_id, "ok", "")
    except Exception as e:
        return (wp_id, "", "error", str(e)[:300])


# ============================================================
# Main
# ============================================================
def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"imported": {}}


def save_state(state: dict):
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    rows = []
    with CSV_PATH.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)

    # Sort by date for chronological insertion
    rows.sort(key=lambda r: r["date"] or "0000")

    state = load_state()
    imported_ids = set(int(k) for k in state["imported"].keys())
    imported_ids.update(ALREADY_INSERTED_WP_IDS)

    pending = [r for r in rows if int(r["id"]) not in imported_ids]
    print(f"全記事: {len(rows)}")
    print(f"既にインポート済み: {len(imported_ids)} (テスト1件 + 過去の実行分)")
    print(f"今回インポート対象: {len(pending)}")
    if not pending:
        print("すべてインポート済みです。完了。")
        return

    print(f"並列数: {MAX_WORKERS}")
    print("開始...\n")

    results = []
    start = time.time()
    done = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(create_page, r): r for r in pending}
        for fut in as_completed(futs):
            wp_id, page_id, status, err = fut.result()
            results.append((wp_id, page_id, status, err))
            done += 1

            if status == "ok":
                state["imported"][str(wp_id)] = page_id
                if done % 5 == 0:
                    save_state(state)

            elapsed = time.time() - start
            rate = done / elapsed if elapsed else 0
            eta = (len(pending) - done) / rate if rate else 0
            mark = "✓" if status == "ok" else "✗"
            print(f"  {mark} [{done}/{len(pending)}]  WP{wp_id}  {rate:.1f}/秒  残り約{eta/60:.1f}分", flush=True)
            if status != "ok":
                print(f"      エラー: {err}")

    # Save final state
    save_state(state)

    # Log
    with LOG_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["wp_id", "notion_page_id", "status", "error"])
        for r in results:
            w.writerow(r)

    from collections import Counter
    statuses = Counter(r[2] for r in results)
    print("\n=== 完了 ===")
    print(f"結果: {dict(statuses)}")
    print(f"成功: {statuses.get('ok', 0)} / {len(results)}")
    print(f"ログ: {LOG_PATH}")
    if statuses.get("error", 0) > 0:
        print("エラーがあった記事は import_log.csv の error 列で確認できます。")
        print("再実行 (python3 06_notion_import.py) すれば、エラー分だけ再試行されます。")


if __name__ == "__main__":
    main()
