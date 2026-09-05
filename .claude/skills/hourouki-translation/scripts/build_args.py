#!/usr/bin/env python3
"""次のバッチの Workflow args を組み立てる。

手打ちを無くすためのスクリプト。Ep 103 でペイウォール表示が消えたのは、
私が原文を args に書き写したときの脱落が原因だった。原文はファイルパスで
渡し、メタ情報はこのスクリプトが arc-map.md と episode-index.json から引く。

使い方:
    python3 build_args.py --next 6          # 未訳の先頭6話ぶんを出す
    python3 build_args.py --eps 9,10,11     # 話数を明示して出す
    python3 build_args.py --status          # 進捗だけ表示

出力は Workflow ツールの args にそのまま貼れる JSON。
原文ファイルが未取得の話があれば、取得すべき Notion ID を先に一覧で出す。
"""
import argparse
import json
import os
import re
import sys

ROOT = "/home/user/Q-site"
SKILL = os.path.join(ROOT, ".claude/skills/hourouki-translation")
ARC_MAP = os.path.join(SKILL, "reference/arc-map.md")
INDEX = os.path.join(ROOT, "migration/reports/episode-index.json")
POSTS_EN = os.path.join(ROOT, "migration/posts-en")
JA_SRC = "/tmp/claude-0/-home-user-Q-site/be7f11fc-3367-5f2b-82d5-fe91af67177b/scratchpad/ja-src"

TOTAL = 522  # Episode 0..521


def load_arcs():
    """arc-map.md の表から「話数の範囲 -> 英題」を読む。

    Episode 欄は "000" / "003–004" / "442–489" のいずれか。ダッシュは
    en-dash (–) が使われている点に注意。
    """
    arcs = []
    for line in open(ARC_MAP, encoding="utf-8"):
        cells = [c.strip() for c in line.split("|")]
        if len(cells) < 7:
            continue
        rng, title_en = cells[2], cells[5]
        m = re.fullmatch(r"(\d{3})(?:\s*[–\-—]\s*(\d{3}))?", rng)
        if not m or not title_en:
            continue
        lo = int(m.group(1))
        hi = int(m.group(2)) if m.group(2) else lo
        arcs.append({"lo": lo, "hi": hi, "title_en": title_en})
    if not arcs:
        sys.exit("arc-map.md からアークを読めなかった。表の形式が変わっていないか確認する")
    return arcs


def arc_for(ep, arcs):
    for a in arcs:
        if a["lo"] <= ep <= a["hi"]:
            n = a["hi"] - a["lo"] + 1
            return {
                "arcTitleEn": a["title_en"],
                "arcPart": (ep - a["lo"] + 1) if n > 1 else None,
                "arcTotal": n if n > 1 else None,
            }
    return {"arcTitleEn": None, "arcPart": None, "arcTotal": None}


def done_eps():
    if not os.path.isdir(POSTS_EN):
        return set()
    out = set()
    for f in os.listdir(POSTS_EN):
        m = re.match(r"(\d{3})-.*\.md$", f)
        if m:
            out.add(int(m.group(1)))
    return out


def context_note(ep, arc):
    """アーク単位の短い文脈メモ。詳細な規則は voice bible が持つので、
    ここは「どのアークのどこか」を伝えるだけでよい。"""
    where = f'Part {arc["arcPart"]} of {arc["arcTotal"]} of the arc "{arc["arcTitleEn"]}"' \
        if arc["arcPart"] else f'A standalone episode: "{arc["arcTitleEn"]}"'
    note = (f'{where}. Episode {ep} of 522, so keep continuity with the episodes around it. '
            f'Translate only what is on the page; do not foreshadow later episodes.')
    if arc["arcPart"] and arc["arcPart"] > 1:
        note += " It continues directly from the previous episode, so do not re-introduce people or places " \
                "the reader has already met as though they were new."
    return note


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--next", type=int, metavar="N", help="未訳の先頭N話")
    ap.add_argument("--eps", help="話数をカンマ区切りで指定")
    ap.add_argument("--status", action="store_true", help="進捗のみ表示")
    args = ap.parse_args()

    arcs = load_arcs()
    done = done_eps()

    if args.status or (not args.next and not args.eps):
        remaining = [e for e in range(TOTAL) if e not in done]
        print(f"訳了 {len(done)} / {TOTAL}   残り {len(remaining)}")
        if remaining:
            nxt = remaining[:12]
            print("次に来る話数: " + ", ".join(str(e) for e in nxt) + (" ..." if len(remaining) > 12 else ""))
        return

    if args.eps:
        eps = [int(x) for x in args.eps.split(",") if x.strip()]
    else:
        eps = [e for e in range(TOTAL) if e not in done][: args.next]

    if not eps:
        print("未訳の話は残っていない。全522話が訳了。")
        return

    index = {}
    if os.path.exists(INDEX):
        index = {r["ep"]: r for r in json.load(open(INDEX, encoding="utf-8"))}

    # 原文が未取得なら、翻訳を始める前に取りに行く必要がある
    missing = [e for e in eps if not os.path.exists(os.path.join(JA_SRC, f"ep-{e:03d}.md"))]
    if missing:
        print("=== 原文が未取得。先にこれを Notion から取得すること ===")
        print(f"保存先: {JA_SRC}/ep-<NNN>.md")
        print()
        print("| ep | notion id | title |")
        print("|----|-----------|-------|")
        for e in missing:
            r = index.get(e, {})
            print(f"| {e} | {r.get('notion_id', '???')} | {r.get('title', '?')} |")
        print()
        print("取得後にもう一度このスクリプトを実行する。")
        return

    episodes = []
    for e in eps:
        arc = arc_for(e, arcs)
        if not arc["arcTitleEn"]:
            sys.exit(f"Ep {e} のアークが arc-map.md に無い")
        episodes.append({
            "ep": e,
            "arcTitleEn": arc["arcTitleEn"],
            "arcPart": arc["arcPart"],
            "arcTotal": arc["arcTotal"],
            "sourcePath": os.path.join(JA_SRC, f"ep-{e:03d}.md"),
            "contextNote": context_note(e, arc),
        })

    print(json.dumps({"episodes": episodes}, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
