#!/usr/bin/env python3
"""サブエージェント経路の成果物を、英語記事ファイルに組み立てる。

ワークフローが使えないときの経路（reference/agent-translator-brief.md）。
エージェントは `<scratchpad>/agent-out/ep-NNN.{body.md,excerpt.txt,backtrans.md}`
を書く。このスクリプトがフロントマターを付けて `migration/posts-en/` へ置く。

write_en.py と同じ安全装置を通す:
  - エラー報告や本文なしを記事として書き出さない（looks_like_failure）
  - 画像の脱落を原文と突き合わせて復元
  - 画像URLをリポジトリ内の形式へ（誤記ドメインも受ける）

使い方:
    python3 assemble_en.py 40 41 42
    python3 assemble_en.py --all          # agent-out にあるもの全部
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from write_en import (IMG, local_url, strip_trailing_nav, looks_like_failure,
                      export_meta, y, POSTS_EN, INDEX, JA_SRC, BACKTRANS)

AGENT_OUT = "/tmp/claude-0/-home-user-Q-site/be7f11fc-3367-5f2b-82d5-fe91af67177b/scratchpad/agent-out"
ARC_MAP = "/home/user/Q-site/.claude/skills/hourouki-translation/reference/arc-map.md"


def load_arcs():
    arcs = []
    for line in open(ARC_MAP, encoding="utf-8"):
        c = [x.strip() for x in line.split("|")]
        if len(c) < 7:
            continue
        m = re.fullmatch(r"(\d{3})(?:\s*[–\-—]\s*(\d{3}))?", c[2])
        if not m or not c[5]:
            continue
        lo = int(m.group(1))
        arcs.append({"lo": lo, "hi": int(m.group(2)) if m.group(2) else lo, "t": c[5]})
    return arcs


def arc_for(ep, arcs):
    for a in arcs:
        if a["lo"] <= ep <= a["hi"]:
            n = a["hi"] - a["lo"] + 1
            return a["t"], (ep - a["lo"] + 1 if n > 1 else None), (n if n > 1 else None)
    return None, None, None


def slugify(s):
    s = s.lower()
    s = re.sub(r"['’\"—–,.!?()]", "", s)
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s))


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "--all":
        eps = sorted(int(re.search(r"ep-(\d+)\.body\.md", f).group(1))
                     for f in glob.glob(f"{AGENT_OUT}/ep-*.body.md"))
    else:
        eps = [int(a) for a in args]

    arcs = load_arcs()
    index = {r["ep"]: r for r in json.load(open(INDEX, encoding="utf-8"))}
    written, failed, problems = [], [], []

    for ep in eps:
        bp = f"{AGENT_OUT}/ep-{ep:03d}.body.md"
        if not os.path.exists(bp):
            failed.append(ep)
            problems.append(f"Ep {ep}: 本文ファイルが無い")
            continue
        body = open(bp, encoding="utf-8").read().strip()
        if looks_like_failure(body):
            failed.append(ep)
            problems.append(f"Ep {ep}: 本文がエラー報告か記事の体をなしていない。書き出さない")
            continue

        lines = [l for l in body.split("\n") if l.strip()]
        lines = [(lambda m: f"![{m.group(1)}]({local_url(m.group(2))})")(IMG.match(l))
                 if IMG.match(l) else l for l in lines]

        sp = os.path.join(JA_SRC, f"ep-{ep:03d}.md")
        if os.path.exists(sp):
            src = strip_trailing_nav([l for l in open(sp, encoding="utf-8").read().split("\n")
                                      if l.strip()])
            have = {IMG.match(l).group(2) for l in lines if IMG.match(l)}
            n = 0
            for i, l in enumerate(src):
                m = IMG.match(l)
                if m and local_url(m.group(2)) not in have:
                    lines.insert(i, f"![]({local_url(m.group(2))})")
                    n += 1
            if n:
                problems.append(f"Ep {ep}: 画像{n}枚が落ちていたので復元した")
            # 会員限定マーカーの取りこぼしは有料記事の露出に直結する
            if any("ここから会員限定" in l for l in src) and \
               not any("Members only" in l for l in lines):
                failed.append(ep)
                problems.append(f"Ep {ep}: **原文に会員限定マーカーがあるのに英訳に無い。書き出さない**")
                continue

        title_en, part, total = arc_for(ep, arcs)
        if not title_en:
            failed.append(ep)
            problems.append(f"Ep {ep}: arc-map.md にアークが無い")
            continue
        title = (f"The Vagabond Chronicles #{ep} — {title_en}, Part {part}" if part
                 else f"The Vagabond Chronicles #{ep} — {title_en}")
        base = slugify(title_en) + (f"-{part}" if part else "")
        slug = f"{base}-vagabond-chronicles-{ep:03d}"

        meta = index.get(ep, {})
        date, tags = export_meta(meta.get("slug", ""))
        xp = f"{AGENT_OUT}/ep-{ep:03d}.excerpt.txt"
        excerpt = open(xp, encoding="utf-8").read().strip() if os.path.exists(xp) else ""

        fm = ["---", f"episode: {ep}", 'lang: "en"', 'series: "The Vagabond Chronicles"',
              'series_ja: "放浪記"', f"arc: {y(title_en)}"]
        if part:
            fm += [f"arc_part: {part}", f"arc_total: {total}"]
        fm += [f"title: {y(title)}", f"slug: {y(slug)}", f'source_slug: {y(meta.get("slug",""))}',
               f'source_notion_id: {y(meta.get("notion_id",""))}', f'date: {y(date or "")}',
               'status: "draft"', "tags:"] + [f"  - {y(t)}" for t in tags]
        fm += [f"excerpt: {y(excerpt)}", "member_paywall_after_paragraph: null", "qa:",
               "  blind_review_rounds: 1",
               '  blind_review_protocol: "v2 mixed panel (US / UK / non-native, majority) -- single-agent path"',
               '  mechanical_qa: "pending"', "---", ""]

        open(os.path.join(POSTS_EN, f"{ep:03d}-{base}.md"), "w", encoding="utf-8").write(
            "\n".join(fm) + "\n" + "\n\n".join(lines) + "\n")
        written.append(ep)

        btp = f"{AGENT_OUT}/ep-{ep:03d}.backtrans.md"
        if os.path.exists(btp):
            open(os.path.join(BACKTRANS, f"backtrans-{ep:03d}.md"), "w", encoding="utf-8").write(
                open(btp, encoding="utf-8").read())

    print(f"{len(written)}本を書き出した: {written}")
    if failed:
        print(f"\n書き出さなかった {len(failed)}本: {failed}")
    if problems:
        print("\n=== 要確認 ===")
        for p in problems:
            print("  " + p)


if __name__ == "__main__":
    main()
