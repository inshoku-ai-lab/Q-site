"""
校正用：指定したMDファイル群の「タイトル＋本文」だけを抜き出して表示する。
フロントマター(URL/タグ/画像リスト等)のノイズを除き、精読に集中するため。

使い方:
  python3 migration/scripts/dump_bodies.py <start> <count>
    file_order.txt の start 行目から count 件を表示
  python3 migration/scripts/dump_bodies.py --files a.md b.md ...
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
POSTS = ROOT / "migration" / "posts"
ORDER = ROOT / "migration" / "proofread" / "file_order.txt"


def split_front(text):
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            fm = text[3:end]
            body = text[end + 4:]
            title = ""
            for line in fm.splitlines():
                if line.strip().startswith("title:"):
                    title = line.split("title:", 1)[1].strip().strip('"')
                    break
            return title, body.strip()
    return "", text.strip()


def main():
    args = sys.argv[1:]
    if args and args[0] == "--files":
        files = args[1:]
    else:
        start = int(args[0]) if args else 1
        count = int(args[1]) if len(args) > 1 else 10
        order = ORDER.read_text(encoding="utf-8").splitlines()
        files = order[start - 1: start - 1 + count]

    for fn in files:
        p = POSTS / fn
        if not p.exists():
            print(f"\n!!! NOT FOUND: {fn}")
            continue
        title, body = split_front(p.read_text(encoding="utf-8"))
        print("\n" + "=" * 70)
        print(f"FILE: {fn}")
        print(f"TITLE: {title}")
        print("-" * 70)
        print(body)


if __name__ == "__main__":
    main()
