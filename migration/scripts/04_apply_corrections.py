"""
Phase 2 - Step 1b: Apply manual corrections to enriched_posts.csv
- Revert 8 short Twitter/Facebook Files posts from Discard to Published (group-authored series)
- Add Facebook Files as a sub-series under twitter_files
- Fix id=7339 broken title (CDATA parse damage)
- Recategorize id=10252 (mislabeled as 放浪記)
- Mark id=11099 (English version of silver post) as Discard
"""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "reports" / "enriched_posts.csv"

# IDs to revert from Discard back to Published (group-authored short link posts)
REVERT_TO_PUBLISHED = {
    "9414",   # ツイッターファイル 第22弾
    "10270",  # Twitter Files 24弾
    "10340",  # Facebook Files
    "10345",  # Facebook Files 第2弾
    "10349",  # Facebook Files 第3弾
    "10353",  # Facebook Files 第4弾
    "10418",  # Facebook Files 第5弾
    "10741",  # Twitter Files BRAZIL 第1弾
}

# Explicit overrides for series/episode where auto-detection missed
OVERRIDES = {
    # id=7339: title corrupted by CDATA parse error
    "7339": {
        "title": "北アルプスの山小屋で働く話２６（放浪記４６７）",
        "series": "放浪記",
        "series_key": "wandering_log",
        "episode": "467",
        "new_category": "放浪記",
        "new_category_key": "wandering",
    },
    # id=10252: mislabeled as 放浪記
    "10252": {
        "new_category": "時事・情報戦",
        "new_category_key": "current",
        "series": "",
        "series_key": "none",
    },
    # id=11099: English duplicate of silver post -> Discard
    "11099": {
        "review_status": "Discard",
        "review_reason": "english_duplicate_of:10745",
    },
    # Facebook Files: classify under twitter_files series with sub_episode marker
    "10340": {"series": "ツイッターファイル", "series_key": "twitter_files", "sub_episode": "Facebook 1"},
    "10345": {"series": "ツイッターファイル", "series_key": "twitter_files", "sub_episode": "Facebook 2"},
    "10349": {"series": "ツイッターファイル", "series_key": "twitter_files", "sub_episode": "Facebook 3"},
    "10353": {"series": "ツイッターファイル", "series_key": "twitter_files", "sub_episode": "Facebook 4"},
    "10418": {"series": "ツイッターファイル", "series_key": "twitter_files", "sub_episode": "Facebook 5"},
    "10741": {"series": "ツイッターファイル", "series_key": "twitter_files", "sub_episode": "Brazil 1"},
}

# Try to auto-extract twitter_files episode numbers from these titles
EPISODE_EXTRACT = {
    "9414": "22",
    "10270": "24",
}


def main():
    with CSV_PATH.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fieldnames = list(rows[0].keys())

    changes = []
    for r in rows:
        rid = r["id"]
        if rid in REVERT_TO_PUBLISHED and r["review_status"] == "Discard":
            r["review_status"] = "Published"
            r["review_reason"] = "group_authored_short_post"
            changes.append(f"  [{rid}] Discard -> Published")
        if rid in EPISODE_EXTRACT and not r["episode"]:
            r["episode"] = EPISODE_EXTRACT[rid]
            changes.append(f"  [{rid}] episode -> {EPISODE_EXTRACT[rid]}")
        if rid in OVERRIDES:
            for k, v in OVERRIDES[rid].items():
                old = r.get(k, "")
                r[k] = v
                changes.append(f"  [{rid}] {k}: {old!r} -> {v!r}")

    # Re-write CSV
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"Applied {len(changes)} changes:")
    for c in changes:
        print(c)

    # Also fix the broken markdown file for id=7339
    md_path = ROOT / "posts" / "2022-10-26_stories-of-working-in-a-mountain-hut-in-the-northern-alps26an-autobiography467.md"
    if md_path.exists():
        text = md_path.read_text(encoding="utf-8")
        new_text = text.replace(
            'title: "７）]]>"',
            'title: "北アルプスの山小屋で働く話２６（放浪記４６７）"',
        )
        if new_text != text:
            md_path.write_text(new_text, encoding="utf-8")
            print(f"\nFixed title in {md_path.name}")

    # Final distribution check
    from collections import Counter
    print("\n=== Updated review status distribution ===")
    print(Counter(r["review_status"] for r in rows))
    print("\n=== Updated category distribution ===")
    print(Counter(r["new_category"] for r in rows))
    print("\n=== Updated series distribution ===")
    print(Counter(r["series"] or "(none)" for r in rows))


if __name__ == "__main__":
    main()
