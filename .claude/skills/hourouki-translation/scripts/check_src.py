#!/usr/bin/env python3
"""取得した原文（ja-src）を WordPress エクスポート（migration/posts）と行単位で突き合わせる。

取得エージェントは Notion の本文を Write で書き写すので、脱落や書き換えが起こりうる。
エクスポート側には校正（corrections.jsonl）が入っているので、1〜2字の差は正常。
一致しない行・片側にしか無い行を出す。ナビ行・画像URLのドメイン差は無視する。

    python3 check_src.py 339 342 343
    python3 check_src.py --range 344 388
"""
import difflib, glob, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sp import SP
ROOT = "/home/user/Q-site"


def norm_lines(text):
    out = []
    for l in text.split("\n"):
        l = l.strip()
        if not l or "前の記事" in l or "次の記事" in l:
            continue
        l = re.sub(r"https?://qryptravel+er\.com", "", l).replace("/images/wp", "")
        l = re.sub(r"[\s　\\]", "", l)
        if l in ("###",):
            continue
        out.append(l)
    return out


def export_for(ep):
    c = [p for p in glob.glob(f"{ROOT}/migration/posts/*autobiography-{ep}.md")]
    c = [p for p in c if re.search(rf"[-_]autobiography-{ep}\.md$", p)]
    return c[0] if c else None


def check(ep):
    src = f"{SP}/ja-src/ep-{ep:03d}.md"
    if not os.path.exists(src):
        print(f"Ep {ep}: 原文未取得"); return False
    ex = export_for(ep)
    if not ex:
        print(f"Ep {ep}: エクスポート無し（照合不能）"); return True
    a = norm_lines(open(src, encoding="utf-8").read())
    b = norm_lines(open(ex, encoding="utf-8").read().split("---\n", 2)[2])
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    bad = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        aa, bb = a[i1:i2], b[j1:j2]
        if op == "replace" and len(aa) == len(bb):
            for x, y in zip(aa, bb):
                r = difflib.SequenceMatcher(None, x, y).ratio()
                if r < 0.9:
                    bad.append(("差", x, y))
                else:
                    bad.append(("微", x, y))
        else:
            for x in aa: bad.append(("原文のみ", x, ""))
            for y in bb: bad.append(("エクスポートのみ", "", y))
    serious = [x for x in bad if x[0] != "微"]
    tag = "OK" if not serious else "要確認"
    print(f"Ep {ep}: {tag}  原文{len(a)}行 / エクスポート{len(b)}行  微差{len(bad)-len(serious)}  重大{len(serious)}")
    for k, x, y in bad:
        if k == "微" and "-v" not in sys.argv:
            continue
        print(f"   [{k}] 原: {x[:70]}\n         出: {y[:70]}")
    return not serious


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "-v"]
    if args and args[0] == "--range":
        eps = range(int(args[1]), int(args[2]) + 1)
    else:
        eps = [int(a) for a in args]
    for e in eps:
        check(e)
