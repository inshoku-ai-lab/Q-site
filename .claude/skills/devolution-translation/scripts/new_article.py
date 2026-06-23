#!/usr/bin/env python3
"""
デボリューション理論 新規記事のフロントマター雛形を生成する。

使い方:
  python3 new_article.py --part 14 --x 1 --y 8 --slug-base devolution-part-14 \
      --date "2026-06-23 09:00:00" --id 990141

出力: フロントマター + 空の本文テンプレを標準出力へ。
ファイル名候補も先頭にコメントで表示する。
"""
import argparse

ZEN = str.maketrans("0123456789", "０１２３４５６７８９")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--part", type=int, required=True, help="パート番号 例: 14")
    ap.add_argument("--x", type=int, required=True, help="サブパート番号(分子)")
    ap.add_argument("--y", type=int, required=True, help="サブパート総数(分母)")
    ap.add_argument("--slug-base", required=True,
                    help="原文slug基。例: devolution-part-14")
    ap.add_argument("--date", required=True, help='"YYYY-MM-DD HH:MM:SS"')
    ap.add_argument("--id", required=True, help="記事ID(既存と衝突しない値)")
    ap.add_argument("--addendum", action="store_true", help="番外編フラグ")
    args = ap.parse_args()

    slug = f"{args.slug_base}-{args.x}-of-{args.y}"
    part_zen = str(args.part).translate(ZEN)
    x_zen = str(args.x).translate(ZEN)
    y_zen = str(args.y).translate(ZEN)
    date_only = args.date.split(" ")[0]
    fname = f"{date_only}_{slug}.md"

    extra_tag = '  - "番外編"\n' if args.addendum else ""

    print(f"# 推奨ファイル名: migration/posts/{fname}")
    print("---")
    print(f'id: {args.id}')
    print(f'title: "パート{part_zen}　{x_zen}/{y_zen}　デボリューション理論"')
    print(f'slug: "{slug}"')
    print(f'date: "{args.date}"')
    print('status: "publish"')
    print(f'original_url: "https://qryptraveller.com/{slug}/"')
    print('featured_image_id: "9965"')
    print('categories:')
    print('  - "デボリューション理論の記事集"')
    print('tags:')
    print('  - "デボリューション"')
    print('  - "デヴォリューション"')
    print('  - "デヴォルーション"')
    print('  - "Devolution"')
    print('  - "Theory"')
    print(f'  - "パート{args.part}"')
    print(extra_tag, end="")
    print('  - "TOPIC_1"')
    print('  - "TOPIC_2"')
    print('  - "TOPIC_3"')
    print('images:')
    print('  - "IMAGE_URL_1"')
    print('excerpt: "150〜220字。固有名詞・出来事・場面を入れ、——と『』を活用"')
    print('flags: ""')
    print("---")
    print()
    print("## 今回の要点とまとめ")
    print()
    print("**ざっくり超要約：** ")
    print()
    print("・")
    print()
    print("## ここからがオリジナルの記事の翻訳になります")
    print()


if __name__ == "__main__":
    main()
