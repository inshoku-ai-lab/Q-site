#!/usr/bin/env python3
"""
デボリューション翻訳記事のQAチェック。
- excerpt が存在し60字以上か
- デボリューション5点セット + パートN タグがあるか
- 「今回の要点とまとめ」「ここからがオリジナルの記事の翻訳になります」見出しがあるか

使い方:
  python3 qa_check.py migration/posts/2026-06-23_devolution-part-14-1-of-8.md [...]
"""
import re
import sys

FIVE = ["デボリューション", "デヴォリューション", "デヴォルーション", "Devolution", "Theory"]


def check(path):
    s = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", s, re.S)
    problems = []
    if not m:
        return ["フロントマターが見つからない"]
    fm, body = m.group(1), m.group(2)

    ex = re.search(r'^excerpt:\s*"([^"]*)"', fm, re.M)
    exval = ex.group(1) if ex else ""
    if not exval:
        problems.append("excerpt が空")
    elif len(exval) < 60:
        problems.append(f"excerpt が短い({len(exval)}字)")
    if exval and "——" not in exval:
        problems.append("excerpt に —— が無い(推奨)")

    tags = re.findall(r'^\s*-\s*"([^"]*)"', fm, re.M)
    for t in FIVE:
        if t not in tags:
            problems.append(f"タグ不足: {t}")
    if not any(re.fullmatch(r"パート\d+", t) for t in tags):
        problems.append("タグ不足: パートN")

    if "## 今回の要点とまとめ" not in body:
        problems.append("見出し『今回の要点とまとめ』が無い")
    if "## ここからがオリジナルの記事の翻訳になります" not in body:
        problems.append("見出し『ここからがオリジナルの記事の翻訳になります』が無い")
    return problems


def main():
    if len(sys.argv) < 2:
        print("usage: qa_check.py <file.md> [...]")
        sys.exit(1)
    bad = 0
    for p in sys.argv[1:]:
        probs = check(p)
        if probs:
            bad += 1
            print(f"NG {p}")
            for x in probs:
                print(f"   - {x}")
        else:
            print(f"OK {p}")
    print(f"\n{len(sys.argv)-1} files, {bad} with problems")


if __name__ == "__main__":
    main()
