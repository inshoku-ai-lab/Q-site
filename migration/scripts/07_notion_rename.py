"""
Notion 全記事 一括テキスト置換スクリプト

置換ルール:
  「Qリプトラベラー」 → 「クリプトラベラー」
  「Cryptraveler」    → 「Qryptraveller」

対象:
  - 各ページのタイトル (Title プロパティ)
  - 各ページのリッチテキスト系プロパティ (Excerpt, SEO Description, Notes 等)
  - 各ページ本文ブロック (paragraph / headings / list / quote / callout / toggle / code)

使い方:
  cd qryp-notion  (or wherever this file is placed; it doesn't depend on local files)
  source venv/bin/activate
  python3 -m pip install requests   # 既に入っているなら不要
  export NOTION_TOKEN='secret_xxx...'
  python3 07_notion_rename.py

  --dry-run を付けると実際の更新は行わず、何が変わるかだけ表示します:
  python3 07_notion_rename.py --dry-run

  途中で中断しても、再実行すれば未処理ページから再開します (state ファイルで管理)。
"""
import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

# ============================================================
# 設定
# ============================================================
HERE = Path(__file__).resolve().parent
STATE_PATH = HERE / "rename_state.json"
LOG_PATH = HERE / "rename_log.csv"

DATABASE_ID = "8ec5cc48-52a5-492e-9d0b-377bc4ff3c82"

TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
if not TOKEN:
    print("ERROR: 環境変数 NOTION_TOKEN を設定してください。")
    sys.exit(1)

API_BASE = "https://api.notion.com/v1"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}

# 置換ルール - 順序に注意 (先により具体的なものを)
REPLACEMENTS = [
    ("Qリプトラベラー", "クリプトラベラー"),
    ("Cryptraveler", "Qryptraveller"),
]

# 本文ブロックのうち rich_text を持つタイプ
RICHTEXT_BLOCK_TYPES = {
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "to_do",
    "toggle",
    "quote",
    "callout",
    "code",  # code has rich_text too
}

# Page properties (rich_text 型のもの) - DBスキーマと合わせて
RICHTEXT_PROPS = {"Sub Episode", "Slug", "Excerpt", "SEO Description", "Notes"}

MAX_WORKERS = 3
RETRY_MAX = 5


def apply_replacements(text: str) -> tuple[str, int]:
    """戻り値: (置換後文字列, 変更箇所数)"""
    if not text:
        return text, 0
    count = 0
    out = text
    for old, new in REPLACEMENTS:
        if old in out:
            count += out.count(old)
            out = out.replace(old, new)
    return out, count


# ============================================================
# Notion API
# ============================================================
def _request(method: str, url: str, json_data=None):
    for attempt in range(RETRY_MAX):
        r = requests.request(method, url, headers=HEADERS, json=json_data, timeout=60)
        if r.status_code in (200, 201):
            return r.json()
        if r.status_code == 429:
            wait = float(r.headers.get("Retry-After", 2))
            time.sleep(wait)
            continue
        if r.status_code >= 500:
            time.sleep(2 ** attempt)
            continue
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    raise RuntimeError("Max retries")


def query_all_pages():
    pages = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        res = _request("POST", f"{API_BASE}/databases/{DATABASE_ID}/query", body)
        pages.extend(res["results"])
        if not res.get("has_more"):
            break
        cursor = res["next_cursor"]
    return pages


def fetch_block_children(block_id: str):
    out = []
    cursor = None
    while True:
        params = "?page_size=100"
        if cursor:
            params += f"&start_cursor={cursor}"
        res = _request("GET", f"{API_BASE}/blocks/{block_id}/children{params}")
        out.extend(res["results"])
        if not res.get("has_more"):
            break
        cursor = res["next_cursor"]
    return out


def update_block(block_id: str, payload: dict):
    _request("PATCH", f"{API_BASE}/blocks/{block_id}", payload)


def update_page_properties(page_id: str, properties: dict):
    _request("PATCH", f"{API_BASE}/pages/{page_id}", {"properties": properties})


# ============================================================
# Rich text transformation
# ============================================================
def transform_rich_text_array(rich):
    """Returns (new_array, changes_count). Preserves annotations and links."""
    if not rich:
        return rich, 0
    total_changes = 0
    new_arr = []
    for r in rich:
        if r.get("type") != "text":
            new_arr.append(r)
            continue
        original = r.get("text", {}).get("content", "")
        replaced, count = apply_replacements(original)
        if count > 0:
            new_r = json.loads(json.dumps(r))  # deep copy
            new_r["text"]["content"] = replaced
            # plain_text is mirrored (Notion will recompute, but include for safety)
            new_r["plain_text"] = replaced
            new_arr.append(new_r)
            total_changes += count
        else:
            new_arr.append(r)
    return new_arr, total_changes


def build_block_update_payload(block: dict) -> tuple[dict | None, int]:
    """Return (payload, change_count) or (None, 0) if no changes."""
    btype = block.get("type")
    if btype not in RICHTEXT_BLOCK_TYPES:
        return None, 0

    data = block.get(btype, {})
    rich = data.get("rich_text")
    if not rich:
        return None, 0

    new_rich, changes = transform_rich_text_array(rich)
    if changes == 0:
        return None, 0

    # Build the minimal payload (only changed type's rich_text)
    payload = {btype: {"rich_text": new_rich}}
    return payload, changes


# ============================================================
# Per-page worker
# ============================================================
def process_page(page: dict, dry_run: bool) -> tuple[str, int, int, str]:
    """
    Returns (page_id, changes_total, blocks_changed, status_msg).
    """
    page_id = page["id"]
    props = page.get("properties", {})
    wp_id = props.get("WP ID", {}).get("number")
    title_rich = props.get("Title", {}).get("title", [])
    title_plain = "".join(t.get("plain_text", "") for t in title_rich)

    changes_total = 0
    blocks_changed = 0

    # --- 1. Title and rich_text properties
    prop_updates = {}
    new_title, tc = transform_rich_text_array(title_rich)
    if tc > 0:
        prop_updates["Title"] = {"title": new_title}
        changes_total += tc

    for pname in RICHTEXT_PROPS:
        if pname not in props:
            continue
        rich = props[pname].get("rich_text", [])
        if not rich:
            continue
        new_rich, pc = transform_rich_text_array(rich)
        if pc > 0:
            prop_updates[pname] = {"rich_text": new_rich}
            changes_total += pc

    if prop_updates and not dry_run:
        update_page_properties(page_id, prop_updates)

    # --- 2. Block content (recursive)
    try:
        all_block_ops = []
        _collect_block_ops(page_id, all_block_ops)
        for block_id, payload, count in all_block_ops:
            if not dry_run:
                update_block(block_id, payload)
                time.sleep(0.12)  # gentle rate limiting per block
            changes_total += count
            blocks_changed += 1
    except Exception as e:
        return page_id, changes_total, blocks_changed, f"BLOCK_ERR: {str(e)[:200]}"

    return page_id, changes_total, blocks_changed, "ok"


def _collect_block_ops(parent_id: str, out_list: list):
    """Recursively walk blocks, collect (block_id, payload, change_count) for changes."""
    children = fetch_block_children(parent_id)
    for b in children:
        payload, count = build_block_update_payload(b)
        if payload:
            out_list.append((b["id"], payload, count))
        if b.get("has_children"):
            _collect_block_ops(b["id"], out_list)


# ============================================================
# State management (resumable)
# ============================================================
def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"done": {}}


def save_state(state: dict):
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")


# ============================================================
# Main
# ============================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="変更しない、レポートのみ")
    parser.add_argument("--force", action="store_true", help="state を無視して全件再処理")
    args = parser.parse_args()

    print("全ページ取得中...")
    pages = query_all_pages()
    print(f"  取得: {len(pages)} ページ")

    state = load_state()
    done_ids = set() if args.force else set(state["done"].keys())

    pending = [p for p in pages if p["id"] not in done_ids]
    print(f"今回処理: {len(pending)} ページ" + (" [DRY-RUN]" if args.dry_run else ""))
    if args.dry_run:
        print("※ --dry-run モード。実際の更新は行いません。")
    print(f"並列数: {MAX_WORKERS}\n")

    results = []
    start = time.time()
    done = 0
    total_changes = 0
    pages_changed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(process_page, p, args.dry_run): p for p in pending}
        for fut in as_completed(futs):
            done += 1
            try:
                page_id, changes, blocks_changed, status = fut.result()
            except Exception as e:
                page_id = futs[fut]["id"]
                changes = blocks_changed = 0
                status = f"FATAL: {str(e)[:200]}"

            results.append((page_id, changes, blocks_changed, status))
            total_changes += changes
            if changes > 0:
                pages_changed += 1

            if not args.dry_run and status == "ok":
                state["done"][page_id] = {"changes": changes, "blocks": blocks_changed}
                if done % 5 == 0:
                    save_state(state)

            elapsed = time.time() - start
            rate = done / elapsed if elapsed else 0
            eta = (len(pending) - done) / rate if rate else 0
            mark = "✓" if status == "ok" else "✗"
            change_info = f"{changes}箇所" if changes > 0 else "-"
            print(f"  {mark} [{done}/{len(pending)}] {change_info:>10}  {rate:.1f}/秒  残り約{eta/60:.1f}分", flush=True)
            if status != "ok":
                print(f"      → {status}")

    if not args.dry_run:
        save_state(state)

    # Log
    import csv as csvmod
    with LOG_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csvmod.writer(f)
        w.writerow(["page_id", "changes_total", "blocks_changed", "status"])
        for r in results:
            w.writerow(r)

    print("\n=== 完了 ===")
    print(f"処理ページ数: {len(results)}")
    print(f"変更があったページ: {pages_changed}")
    print(f"総置換箇所: {total_changes}")
    print(f"ログ: {LOG_PATH}")
    if args.dry_run:
        print("\n※ DRY-RUN なので Notion は変更されていません。")
        print("   実際に適用するには --dry-run を外して再実行してください。")
    else:
        errors = [r for r in results if r[3] != "ok"]
        if errors:
            print(f"\nエラーがあるページ: {len(errors)}")
            print("再実行 (python3 07_notion_rename.py) でエラー分のみ再試行されます。")
        else:
            print("\n全件成功！")


if __name__ == "__main__":
    main()
