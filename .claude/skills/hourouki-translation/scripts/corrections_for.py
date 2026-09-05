#!/usr/bin/env python3
"""その話の原文に残っている「既知の誤字」を、翻訳エージェントへ渡す文面にして出す。

`migration/proofread/corrections.jsonl` は、以前の校正作業で作られた410件の記録。
**これは WordPress エクスポート側にだけ適用され、Notion 側には反映されていない。**
つまり翻訳の元にしている Notion 原文には、既知の誤字がそのまま残っている。

実際に確認した時点で、訳了済み47話がこの状態の原文から訳されていた。
中には意味が変わるものがある（Ep 56「奔放な姓」＝ surname / 正しくは「性」、
Ep 77「個室は優良」＝ excellent / 正しくは「有料」、
Ep 189「オート・リクシャーに分譲」＝ sell off / 正しくは「分乗」）。

**日本語原文は直さない。**直すのは著者の領分で、こちらは「読み間違えない」ようにするだけ。

使い方:
    python3 corrections_for.py 173          # 1話ぶんの指示文
    python3 corrections_for.py 160 179      # 範囲の一覧（どの話に何件あるか）
"""
import json
import os
import re
import sys

ROOT = "/home/user/Q-site"
JSONL = os.path.join(ROOT, "migration/proofread/corrections.jsonl")
JA_SRC = ("/tmp/claude-0/-home-user-Q-site/be7f11fc-3367-5f2b-82d5-fe91af67177b"
          "/scratchpad/ja-src")


def load():
    """話番号 -> 修正リスト。ファイル名末尾の autobiography-NNN で引く。"""
    by_ep = {}
    for line in open(JSONL, encoding="utf-8"):
        r = json.loads(line)
        m = re.search(r"autobiography-?(\d+)\.md$", r["file"])
        if m:
            by_ep.setdefault(int(m.group(1)), []).append(r)
    return by_ep


def pending(ep, by_ep):
    """その話の原文に**まだ残っている**ものだけ返す。すでに直っていれば黙って落とす。"""
    p = os.path.join(JA_SRC, f"ep-{ep:03d}.md")
    if not os.path.exists(p):
        return None                      # 原文未取得。判定できない
    src = open(p, encoding="utf-8").read()
    return [r for r in by_ep.get(ep, []) if r["old"] in src]


def brief(ep, rows):
    if not rows:
        return ""
    out = ["⚠️ **原文に既知の誤字が残っている。訳す前に必ず読むこと。**",
           "（以前の校正で判明したもの。WordPress側だけ直り、Notion側は未反映のまま）", ""]
    for r in rows:
        out.append(f"- 「{r['old']}」は誤り。**正しくは「{r['new']}」**（{r['reason']}）")
    out += ["", "**正しい意味の方で訳すこと。日本語原文のファイルは修正しないこと。**"]
    return "\n".join(out)


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    by_ep = load()
    if len(a) == 1:
        ep = int(a[0])
        rows = pending(ep, by_ep)
        if rows is None:
            print(f"Ep {ep}: 原文が未取得のため判定できない")
        elif not rows:
            print(f"Ep {ep}: 既知の誤字は残っていない")
        else:
            print(brief(ep, rows))
        return
    lo, hi = int(a[0]), int(a[1])
    total = 0
    for ep in range(lo, hi + 1):
        rows = pending(ep, by_ep)
        if rows:
            total += len(rows)
            print(f"Ep {ep}: {len(rows)}件")
            for r in rows:
                print(f"    「{r['old']}」→「{r['new']}」  {r['reason']}")
    print(f"\n計 {total}件")


if __name__ == "__main__":
    main()
