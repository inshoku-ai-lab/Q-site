"""
Phase 2 - Step 1: Enrich post metadata for Notion import
- Map old WP categories to new 4-category system
- Detect series and extract episode numbers from titles
- Apply aggressive tag canonicalization (~25 tags)
- Auto-flag discard candidates (test, duplicates, too short)
- Output: enriched_posts.csv ready for review and Notion import
"""
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_CSV = ROOT / "reports" / "posts.csv"
OUT_CSV = ROOT / "reports" / "enriched_posts.csv"
TAG_REPORT = ROOT / "reports" / "tag_canonicalization.json"
SUMMARY = ROOT / "reports" / "phase2_summary.json"

# ============================================================
# 1. Category mapping: old WP cats → new categories
# ============================================================
NEW_CATEGORIES = {
    "wandering": "放浪記",
    "thought": "思想・理論",
    "current": "時事・情報戦",
    "essay": "エッセイ・その他",
}

OLD_TO_NEW_CATEGORY = {
    "放浪記": "wandering",
    "デボリューション理論の記事集": "thought",
    "ティール・スワンの言葉": "thought",
    "ツイッターファイル全記事": "current",
    "日本人が知っておくべき英文記事の翻訳": "current",
    "DSが潰したい真のビットコインの話": "current",
    "オリジナル記事": "essay",  # default; may be re-routed by series detection
    "ブログ記事": "essay",
}

# ============================================================
# 2. Series detection + episode number extraction
# ============================================================
SERIES = {
    "wandering_log": "放浪記",
    "devolution": "デボリューション理論",
    "twitter_files": "ツイッターファイル",
    "teal_swan": "ティール・スワン",
    "bsv": "真のビットコイン (BSV)",
    "translation": "翻訳記事",
    "none": "",
}

# Full-width digit conversion
FW_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")
# Kanji numerals (basic)
KANJI_NUM = {
    "零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
}


def kanji_to_int(s: str):
    if not s:
        return None
    if s in KANJI_NUM:
        return KANJI_NUM[s]
    # 十一, 二十, 二十三 etc.
    if "十" in s:
        parts = s.split("十")
        left = KANJI_NUM.get(parts[0], 1) if parts[0] else 1
        right = KANJI_NUM.get(parts[1], 0) if len(parts) > 1 and parts[1] else 0
        return left * 10 + right
    return None


def detect_series_and_episode(title: str, old_cats: list):
    """Return (series_key, episode_str, sub_episode_str)."""
    t_norm = title.translate(FW_DIGITS)

    # 放浪記０００ → 放浪記521
    m = re.search(r"放浪記\s*(\d{1,4})", t_norm)
    if m:
        return ("wandering_log", m.group(1).lstrip("0") or "0", "")

    # デボリューション: パート1　1/6
    m = re.search(r"パート\s*([0-9]+)(?:\s*[\s　]?\s*(\d+)\s*/\s*(\d+))?", t_norm)
    if m and ("デボリューション理論の記事集" in old_cats or "デボリューション" in title or "パート" in title):
        ep = m.group(1)
        sub = f"{m.group(2)}/{m.group(3)}" if m.group(2) else ""
        return ("devolution", ep, sub)

    # ツイッターファイル: 第一弾, 第6弾
    if "ツイッターファイル全記事" in old_cats or "ツイッターファイル" in title or "#twitterfiles" in title.lower():
        # 第N弾 (arabic or kanji)
        m_k = re.search(r"第\s*([一二三四五六七八九十]+)\s*弾", title)
        m_a = re.search(r"第\s*(\d+)\s*弾", t_norm)
        ep = ""
        if m_a:
            ep = m_a.group(1)
        elif m_k:
            n = kanji_to_int(m_k.group(1))
            ep = str(n) if n is not None else ""
        sub = "補足" if "補足" in title else ""
        return ("twitter_files", ep, sub)

    # ティール・スワン
    if "ティール・スワンの言葉" in old_cats or "ティール・スワン" in title:
        return ("teal_swan", "", "")

    # BSV
    if "DSが潰したい真のビットコインの話" in old_cats:
        return ("bsv", "", "")

    # Translations
    if "日本人が知っておくべき英文記事の翻訳" in old_cats:
        return ("translation", "", "")

    return ("none", "", "")


# ============================================================
# 3. New category override based on series detection
# ============================================================
SERIES_TO_NEW_CATEGORY = {
    "wandering_log": "wandering",
    "devolution": "thought",
    "teal_swan": "thought",
    "twitter_files": "current",
    "bsv": "current",
    "translation": "current",
    "none": None,  # fall back to old category mapping
}

# ============================================================
# 4. Tag canonicalization rules
# ============================================================

# Tags to merge: old_tag -> canonical_tag (None means drop)
TAG_CANONICAL = {
    # Devolution variants → drop (covered by category/series)
    "デボリューション": None,
    "デボルーション": None,
    "デヴォリューション": None,
    "デヴォルーション": None,
    "Devolution": None,
    "Theory": None,
    "理論": None,
    "権限委譲": None,
    "権限委譲理論": None,

    # Twitter Files variants → drop (covered by series)
    "ツイッターファイル": None,
    "ツイッター": None,
    "twitterfiles": None,
    "twitter": None,
    "files": None,
    "ファイル": None,

    # Wandering variants → drop (covered by series)
    "放浪記": None,
    "Qリプトラベラー": None,
    "クリプトラベラー": None,

    # People - canonical names
    "イーロンマスク": "イーロン・マスク",
    "イーロン・マスク": "イーロン・マスク",
    "Elon Musk": "イーロン・マスク",
    "Trump": "トランプ",
    "ドナルド・トランプ": "トランプ",
    "Q": "Qアノン",
    "Qアノン": "Qアノン",
    "QAnon": "Qアノン",
    "ティール・スワン": None,  # covered by series
    "Teal Swan": None,
    "ティールスワン": None,

    # Themes - canonical
    "DS": "ディープステート",
    "ディープステート": "ディープステート",
    "deep state": "ディープステート",
    "Deep State": "ディープステート",
    "言論統制": "検閲",
    "検閲": "検閲",
    "censorship": "検閲",
    "情報戦": "情報戦争",
    "情報戦争": "情報戦争",

    # Wandering-specific
    "旅行記": "旅行",
    "旅行": "旅行",
    "ヒッピー": "ヒッピー",
    "地球放浪": "放浪",
    "放浪": "放浪",
    "ノマド": "放浪",
    "私小説": "自伝",
    "自叙伝": "自伝",
    "#自伝": "自伝",
}

# Whitelist: only these canonical tags will survive
TAG_WHITELIST = {
    # People
    "トランプ", "イーロン・マスク", "Qアノン", "クレイグ・ライト", "バイデン",
    # Themes - politics/info
    "不正選挙", "情報戦争", "戦争", "クーデター", "検閲", "ディープステート",
    # Themes - health
    "ワクチン", "コロナ", "健康",
    # Themes - crypto
    "ビットコイン", "BSV", "暗号通貨",
    # Themes - philosophy
    "覚醒", "陰謀論", "真実", "スピリチュアル",
    # Wandering-specific
    "旅行", "放浪", "ヒッピー", "自伝",
    # Format
    "翻訳記事",
}


def canonicalize_tags(tags: list) -> list:
    result = []
    seen = set()
    for t in tags:
        t = t.strip()
        if not t:
            continue
        # Apply mapping
        if t in TAG_CANONICAL:
            mapped = TAG_CANONICAL[t]
        else:
            mapped = t  # keep as-is for whitelist check
        if mapped is None:
            continue
        # Whitelist check
        if mapped not in TAG_WHITELIST:
            continue
        if mapped not in seen:
            seen.add(mapped)
            result.append(mapped)
    return result


# ============================================================
# 5. Discard / review flags
# ============================================================
DISCARD_TITLE_PATTERNS = [
    r"^test$",
    r"^テスト",
    r"下書き.*複製して使う",
    r"^11053-2$",  # numeric/slug-like title
]


def review_status(row, char_count):
    """Return ('Published'|'Draft'|'Discard'|'Review', reason)."""
    title = row["title"]
    status = row["status"]

    if status == "draft":
        return ("Draft", "wp:draft")

    for pat in DISCARD_TITLE_PATTERNS:
        if re.search(pat, title, re.I):
            return ("Discard", f"title:{pat}")

    if char_count < 100:
        return ("Discard", "too_short<100")
    if char_count < 300:
        return ("Review", "short<300")

    return ("Published", "")


# ============================================================
# Main
# ============================================================
def main():
    rows_in = []
    with POSTS_CSV.open(encoding="utf-8") as f:
        rows_in = list(csv.DictReader(f))

    print(f"Input: {len(rows_in)} posts")

    enriched = []
    tag_before = Counter()
    tag_after = Counter()
    new_cat_counter = Counter()
    series_counter = Counter()
    status_counter = Counter()

    title_to_ids = defaultdict(list)

    for row in rows_in:
        title = row["title"]
        old_cats = [c.strip() for c in row["categories"].split(";") if c.strip()]
        old_tags = [t.strip() for t in row["tags"].split(";") if t.strip()]

        for t in old_tags:
            tag_before[t] += 1

        # Series detection
        series_key, ep, sub = detect_series_and_episode(title, old_cats)
        series_counter[series_key] += 1

        # New category
        new_cat_key = SERIES_TO_NEW_CATEGORY.get(series_key)
        if not new_cat_key:
            # Fall back to old category mapping
            for oc in old_cats:
                if oc in OLD_TO_NEW_CATEGORY:
                    new_cat_key = OLD_TO_NEW_CATEGORY[oc]
                    break
        if not new_cat_key:
            new_cat_key = "essay"
        new_cat_counter[new_cat_key] += 1

        # Tags
        new_tags = canonicalize_tags(old_tags)
        for t in new_tags:
            tag_after[t] += 1

        # Review status
        char_count = int(row.get("char_count") or 0)
        rev_status, reason = review_status(row, char_count)
        status_counter[rev_status] += 1

        # Duplicate detection prep
        title_to_ids[title.strip()].append(row["id"])

        enriched.append({
            "id": row["id"],
            "slug": row["slug"],
            "title": title,
            "original_url": row["link"],
            "wp_status": row["status"],
            "date": row["date"],
            "new_category": NEW_CATEGORIES[new_cat_key],
            "new_category_key": new_cat_key,
            "series": SERIES[series_key],
            "series_key": series_key,
            "episode": ep,
            "sub_episode": sub,
            "new_tags": "; ".join(new_tags),
            "old_categories": row["categories"],
            "old_tags": row["tags"],
            "char_count": char_count,
            "image_count": row["image_count"],
            "review_status": rev_status,
            "review_reason": reason,
            "featured": "",  # to be filled manually
            "excerpt": row.get("excerpt", ""),
        })

    # Mark duplicates
    dup_count = 0
    for r in enriched:
        ids = title_to_ids[r["title"].strip()]
        if len(ids) > 1:
            if r["review_status"] == "Published":
                # keep first, mark rest as Review
                if r["id"] != ids[0]:
                    r["review_status"] = "Review"
                    r["review_reason"] = (r["review_reason"] + ";duplicate_title").strip(";")
                    dup_count += 1

    # Write CSV
    fieldnames = list(enriched[0].keys())
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in enriched:
            w.writerow(r)

    # Tag canonicalization report
    tag_report = {
        "before_total_unique": len(tag_before),
        "after_total_unique": len(tag_after),
        "after_tags_with_counts": sorted(tag_after.items(), key=lambda x: -x[1]),
        "untouched_old_tags_dropped": sorted(
            [(t, c) for t, c in tag_before.items()
             if t not in TAG_CANONICAL and t not in TAG_WHITELIST],
            key=lambda x: -x[1]
        )[:50],
    }
    TAG_REPORT.write_text(json.dumps(tag_report, ensure_ascii=False, indent=2), encoding="utf-8")

    # Summary
    summary = {
        "total_posts": len(enriched),
        "new_category_distribution": {NEW_CATEGORIES[k]: v for k, v in new_cat_counter.items()},
        "series_distribution": {SERIES[k] or "(none)": v for k, v in series_counter.items()},
        "review_status_distribution": dict(status_counter),
        "tags_before": len(tag_before),
        "tags_after": len(tag_after),
        "tag_reduction_pct": round((1 - len(tag_after) / len(tag_before)) * 100, 1),
        "duplicate_titles_flagged": dup_count,
    }
    SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== Enrichment Summary ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
