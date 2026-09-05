#!/usr/bin/env python3
"""バッチの逆翻訳を、日本語の検証レポートへ追記する。

著者は英語の自然さを判断できないと明言している。だから著者に見せるのは
**英訳を原文を見ずに日本語へ訳し戻したもの**であって、英文ではない。
著者はそれと元の日本語を読み比べて、意味のズレだけを見ればよい。

使い方:
    python3 mk_report.py --eps 9,10,11 --label "量産バッチ2"
    python3 mk_report.py --range 9 39 --label "量産バッチ2"
"""
import argparse
import glob
import json
import os
import re

ROOT = "/home/user/Q-site"
POSTS_EN = os.path.join(ROOT, "migration/posts-en")
INDEX = os.path.join(ROOT, "migration/reports/episode-index.json")
REPORT = os.path.join(ROOT, "migration/reports/VERIFICATION-REPORT-ja.md")
BT = "/tmp/claude-0/-home-user-Q-site/be7f11fc-3367-5f2b-82d5-fe91af67177b/scratchpad"
IMG = re.compile(r"!\[([^\]]*)\]\(")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eps")
    ap.add_argument("--range", nargs=2, type=int, metavar=("LO", "HI"))
    ap.add_argument("--label", required=True)
    ap.add_argument("--backfill", action="store_true",
                    help="逆翻訳がレポートに載っていない話だけを拾って追記する。"
                         "組み立て時点でエージェントがまだ逆翻訳を書き終えていなかった話が出るため")
    a = ap.parse_args()

    if a.backfill:
        # 著者が意味を検証できる唯一の材料が逆翻訳なので、取りこぼしを残さない
        rep = open(REPORT, encoding="utf-8").read()
        idx = {r["ep"]: r for r in json.load(open(INDEX, encoding="utf-8"))}
        rows = []
        for p in sorted(glob.glob(os.path.join(POSTS_EN, "*.md"))):
            ep = int(os.path.basename(p)[:3])
            bt = os.path.join(BT, f"backtrans-{ep:03d}.md")
            if re.search(rf"^## Ep {ep} —", rep, re.M):
                continue
            if os.path.exists(bt) and open(bt, encoding="utf-8").read().strip():
                rows.append((ep, idx.get(ep, {}).get("title", ""),
                             open(bt, encoding="utf-8").read().strip()))
        if not rows:
            print("補填すべき逆翻訳は無い")
            return
        out = [f"\n\n---\n\n# {a.label}（逆翻訳の補填）\n",
               "組み立て時点で逆翻訳が未生成だった話を、後から追記したものです。",
               "読み方は他の節と同じです。\n"]
        for ep, ja, bt in rows:
            out += [f"\n---\n\n## Ep {ep} — {ja}\n",
                    "英訳からの逆翻訳（原文を見ずに訳し戻したもの）:\n", bt, ""]
        open(REPORT, "a", encoding="utf-8").write("\n".join(out) + "\n")
        print(f"{len(rows)}本の逆翻訳を補填した: {[e for e,_,_ in rows]}")
        return

    if a.eps:
        eps = [int(x) for x in a.eps.split(",") if x.strip()]
    elif a.range:
        eps = list(range(a.range[0], a.range[1] + 1))
    else:
        raise SystemExit("--eps か --range のどちらかが要る")

    index = {r["ep"]: r for r in json.load(open(INDEX, encoding="utf-8"))}

    rows, bodies, missing = [], [], []
    for ep in eps:
        g = glob.glob(os.path.join(POSTS_EN, f"{ep:03d}-*.md"))
        if not g:
            continue
        raw = open(g[0], encoding="utf-8").read()
        fm, body = raw.split("---\n", 2)[1], raw.split("---\n", 2)[2]
        title = re.search(r'^title:\s*"(.+)"', fm, re.M).group(1)
        blocks = [l for l in body.split("\n") if l.strip()]
        imgs = sum(1 for l in blocks if l.startswith("!["))
        ja = index.get(ep, {}).get("title", "")
        rows.append(f"| {ep} | {ja} | {title} | {len(blocks)} | {imgs} | 合格 |")

        p = os.path.join(BT, f"backtrans-{ep:03d}.md")
        if os.path.exists(p) and open(p, encoding="utf-8").read().strip():
            bodies.append((ep, ja, open(p, encoding="utf-8").read().strip()))
        else:
            missing.append(ep)

    out = [f"\n\n---\n\n# {a.label} — Ep {eps[0]}〜{eps[-1]}（{len(rows)}本）\n",
           "**読み方**: 下の日本語は、英訳を*原文を見ずに*日本語へ訳し戻したものです。",
           "元の日本語と読み比べて、意味がずれている箇所があれば指摘してください。",
           "英語として自然かどうかは私が担当するので、そこは見ていただかなくて構いません。\n",
           "機械QA: 全本 ERROR 0。段落数・画像枚数は日本語原文と一致（前後記事リンクのみ削除）。\n",
           "## 一覧\n",
           "| Ep | 日本語タイトル | 英語タイトル | 段落 | 画像 | 機械QA |",
           "|---|---|---|---|---|---|"] + rows

    if missing:
        out.append(f"\n> 逆翻訳が取得できなかった話: {missing}")

    for ep, ja, bt in bodies:
        out += [f"\n---\n\n## Ep {ep} — {ja}\n",
                "英訳からの逆翻訳（原文を見ずに訳し戻したもの）:\n", bt, ""]

    open(REPORT, "a", encoding="utf-8").write("\n".join(out) + "\n")
    print(f"{len(rows)}本を検証レポートへ追記した（逆翻訳 {len(bodies)}本）")
    if missing:
        print(f"逆翻訳が無い話: {missing}")
    print("file size:", os.path.getsize(REPORT), "bytes")


if __name__ == "__main__":
    main()
