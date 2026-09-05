#!/usr/bin/env python3
"""画像の英語代替テキストを、全英語記事に適用する。

対応表は migration/reports/image-alt.json（ファイル名 -> 英語の説明文）。
翻訳エージェントは画像を見ていないので、書かせると必ず捏造する。実際に
`Blog7-1` のようなファイル名の流用が混入した。だから代替テキストは、
画像ファイルを実際に開いたエージェントが対応表に書き、このスクリプトが貼る。

使い方:
    python3 alt_text.py --missing     # 説明文が未登録の画像を一覧（これを埋める）
    python3 alt_text.py --apply       # 対応表を全記事に適用
"""
import argparse
import glob
import json
import os
import re

ROOT = "/home/user/Q-site"
POSTS_EN = os.path.join(ROOT, "migration/posts-en")
ALT_JSON = os.path.join(ROOT, "migration/reports/image-alt.json")
IMG = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def load_alts():
    if os.path.exists(ALT_JSON):
        return json.load(open(ALT_JSON, encoding="utf-8"))
    return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--missing", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    alts = load_alts()
    files = sorted(glob.glob(os.path.join(POSTS_EN, "*.md")))

    if args.missing or not args.apply:
        seen, missing = set(), []
        for p in files:
            body = open(p, encoding="utf-8").read().split("---\n", 2)[2]
            for _, url in IMG.findall(body):
                name = url.rsplit("/", 1)[-1]
                if name in seen:
                    continue
                seen.add(name)
                if not alts.get(name, "").strip():
                    missing.append((name, url, os.path.basename(p)))
        if not missing:
            print(f"未登録の画像は無い（登録済み {len(alts)} 件 / 出現 {len(seen)} 件）")
            return
        print(f"説明文が未登録の画像 {len(missing)} 件。実物を Read で見てから書くこと。")
        print(f"対応表: {ALT_JSON}\n")
        for name, url, f in missing:
            print(f"  public{url}")
            print(f"      key={name}   ({f})")
        return

    changed = 0
    for p in files:
        raw = open(p, encoding="utf-8").read()
        head, body = raw.split("---\n", 2)[1], raw.split("---\n", 2)[2]

        def sub(m):
            name = m.group(2).rsplit("/", 1)[-1]
            a = alts.get(name, "").strip()
            return f"![{a or m.group(1)}]({m.group(2)})"

        new = IMG.sub(sub, body)
        if new != body:
            open(p, "w", encoding="utf-8").write("---\n" + head + "---\n" + new)
            changed += 1
    print(f"{changed}ファイルを更新した")


if __name__ == "__main__":
    main()
