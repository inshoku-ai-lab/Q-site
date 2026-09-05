#!/usr/bin/env python3
"""原文から会員限定マーカーの位置を機械的に読み取り、英語側の想定ブロック添字を出す。
エージェントの目視報告に頼ると位置がずれ、有料記事が無料で表示される。

原文の callout は3行（開始タグ / 本文 / 終了タグ）だが、英語側は1行に畳む。
だから「英語での添字」＝ `<callout` より前にある本文ブロック数。
"""
import re, sys, os, glob
SP = "/tmp/claude-0/-home-user-Q-site/be7f11fc-3367-5f2b-82d5-fe91af67177b/scratchpad/ja-src"
NAV = re.compile(r"^\\?\[\s*(前|次)の記事")

def scan(ep):
    p = os.path.join(SP, f"ep-{ep:03d}.md")
    if not os.path.exists(p):
        return None
    lines = [l.strip() for l in open(p, encoding="utf-8") if l.strip()]
    # 見出し記号だけの行と blogcard 残骸は Notion のゴミで、英語には持ち込まない。
    # ここで落としておかないと会員限定マーカーの想定位置がずれる（Ep 97 で3、Ep 117 で1ずれた）。
    lines = [l for l in lines if not NAV.match(l)
             and not re.fullmatch(r"#+", l) and "blogcard" not in l]
    pw, repro, out = None, False, []
    i = 0
    while i < len(lines):
        l = lines[i]
        if l.startswith("<callout") :
            # callout ブロック全体を1つに畳む
            j = i
            body = []
            while j < len(lines) and "</callout>" not in lines[j]:
                body.append(lines[j]); j += 1
            if j < len(lines):
                body.append(lines[j])
            if any("ここから会員限定" in b for b in body):
                pw = len(out)
                repro = j + 1 < len(lines) and "転載禁止" in lines[j + 1]
            out.append("<CALLOUT>")
            i = j + 1
            continue
        out.append(l); i += 1
    imgs = sum(1 for l in out if re.match(r"!\[[^\]]*\]\(", l))
    return dict(ep=ep, blocks=len(out), pw=pw, repro=repro, imgs=imgs,
                heads=sum(1 for l in out if l.startswith("#")),
                tsuzuku=any("つづく" in l for l in out))

if __name__ == "__main__":
    lo, hi = int(sys.argv[1]), int(sys.argv[2])
    for ep in range(lo, hi + 1):
        r = scan(ep)
        print(f"{ep}: MISSING" if not r else
              f"{ep}: blocks={r['blocks']} pw={r['pw']} repro={r['repro']} "
              f"imgs={r['imgs']} heads={r['heads']} tsuzuku={r['tsuzuku']}")
