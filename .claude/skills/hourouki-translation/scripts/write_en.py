#!/usr/bin/env python3
"""Workflow の出力 JSON から英語記事ファイルを書き出す。

私が本文を打ち直さないためのスクリプト。フロントマターの日付とタグは
WordPress エクスポートから、Notion ID とスラッグは episode-index.json から
機械的に引く。

使い方:
    python3 write_en.py /path/to/<task-id>.output

画像は原文と突き合わせて、脱落があればその場で復元する（Ep 2・3・6・17 で
実際に計7枚が黙って落ちた）。代替テキストは空のままにする。翻訳エージェントは
画像を見ていないので書かせると捏造する。alt_text.py が後から埋める。
"""
import glob
import json
import os
import re
import sys

ROOT = "/home/user/Q-site"
POSTS_EN = os.path.join(ROOT, "migration/posts-en")
POSTS_JA = os.path.join(ROOT, "migration/posts")
INDEX = os.path.join(ROOT, "migration/reports/episode-index.json")
JA_SRC = "/tmp/claude-0/-home-user-Q-site/be7f11fc-3367-5f2b-82d5-fe91af67177b/scratchpad/ja-src"
BACKTRANS = "/tmp/claude-0/-home-user-Q-site/be7f11fc-3367-5f2b-82d5-fe91af67177b/scratchpad"

IMG = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$")
LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")


def local_url(url):
    """英語版はリポジトリ内の画像を使う（著者決定）。

    ⚠️ Ep 80〜100 の画像URLは Notion 側で **qryptraveler.com（l が1つ）** に
    なっている。綴りが違うだけで、パス以下は同じ。34枚が該当。
    正しい綴りだけを見ていると書き換えが効かず、壊れた外部URLのまま出てしまう。
    両方の綴りを受ける。
    """
    u = re.sub(r"^https?://qryptravell?er\.com/", "/images/wp/", url)
    return u if u.startswith("/images/") else url


NAV_START = re.compile(r"^\\?\[\s*(前|次)の記事")


def strip_trailing_nav(lines):
    """末尾の前後記事ナビを落とす。

    Notionでの持ち方が2通りある。Ep 70以前は1行だが、**Ep 71以降は
    角括弧がエスケープされURLの途中で改行が入り、非空行3行に分かれる**：

        \\[前の記事０７０\\](https://.../070/
        )　｜　\\[次の記事０７２\\](https://.../072/
        )

    1行前提で判定すると3行とも本文として扱われ、行数がずれるうえ
    ナビが英訳に混入する。ナビは必ず記事の最後にあるので、
    「行頭が前／次の記事リンク」の最初の行から末尾までを切る。

    地の文が「次の記事」に言及するだけの行（Ep 4 に実在する）は
    行頭がリンクではないので切られない。全79本で検証済み。
    """
    for i, l in enumerate(lines):
        if NAV_START.match(l.strip()):
            return lines[:i]
    return lines


def export_meta(slug):
    """日付とタグはエクスポートのフロントマターから引く。"""
    g = glob.glob(os.path.join(POSTS_JA, f"*_{slug}.md"))
    if not g:
        return None, []
    fm = open(g[0], encoding="utf-8").read().split("---\n")[1]
    m = re.search(r'^date:\s*"([^"]+)"', fm, re.M)
    date = m.group(1) if m else None
    tags, intags = [], False
    for line in fm.split("\n"):
        if line.startswith("tags:"):
            intags = True
            continue
        if intags:
            mt = re.match(r'\s+-\s+"(.+)"\s*$', line)
            if mt:
                tags.append(mt.group(1))
            elif line.strip() and not line.startswith(" "):
                break
    return date, tags


def y(s):
    return json.dumps(s, ensure_ascii=False)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    results = raw["result"] if isinstance(raw, dict) else raw

    index = {}
    if os.path.exists(INDEX):
        index = {r["ep"]: r for r in json.load(open(INDEX, encoding="utf-8"))}

    written, problems = [], []
    for r in results:
        ep = r["ep"]["ep"]
        if r.get("failed") or not r["final"]["bodyMarkdown"].strip():
            problems.append(f"Ep {ep}: 本文が空。パイプラインが途中で落ちている")
            continue

        meta = index.get(ep, {})
        slug_ja = meta.get("slug", "")
        date, tags = export_meta(slug_ja)

        body = r["final"]["bodyMarkdown"].strip()
        lines = [l for l in body.split("\n") if l.strip()]
        lines = [
            (lambda m: f"![{m.group(1)}]({local_url(m.group(2))})")(IMG.match(l)) if IMG.match(l) else l
            for l in lines
        ]

        # 画像の脱落を原文と突き合わせて復元する
        sp = os.path.join(JA_SRC, f"ep-{ep:03d}.md")
        note = ""
        if os.path.exists(sp):
            src = strip_trailing_nav(
                [l for l in open(sp, encoding="utf-8").read().split("\n") if l.strip()])
            have = {IMG.match(l).group(2) for l in lines if IMG.match(l)}
            restored = 0
            for i, l in enumerate(src):
                m = IMG.match(l)
                if m and local_url(m.group(2)) not in have:
                    lines.insert(i, f"![]({local_url(m.group(2))})")
                    restored += 1
            if restored:
                note = f"  (画像{restored}枚を復元)"
                problems.append(f"Ep {ep}: 翻訳が画像を{restored}枚落としたので復元した")
            if len(src) != len(lines):
                problems.append(f"Ep {ep}: 段落数が原文と違う 原文{len(src)} / 英訳{len(lines)}")

        fname = re.sub(r"-vagabond-chronicles-\d+$", "", r["slug"])
        path = os.path.join(POSTS_EN, f"{ep:03d}-{fname}.md")

        fm = ["---", f"episode: {ep}", 'lang: "en"', 'series: "The Vagabond Chronicles"',
              'series_ja: "放浪記"', f'arc: {y(r["ep"]["arcTitleEn"])}']
        if r["ep"].get("arcPart"):
            fm += [f'arc_part: {r["ep"]["arcPart"]}', f'arc_total: {r["ep"]["arcTotal"]}']
        fm += [f'title: {y(r["title"])}', f'slug: {y(r["slug"])}', f"source_slug: {y(slug_ja)}",
               f'source_notion_id: {y(meta.get("notion_id", ""))}',
               f'date: {y(date or "")}', 'status: "draft"', "tags:"]
        fm += [f"  - {y(t)}" for t in tags]
        fm += [f'excerpt: {y(r["final"].get("excerpt", "").strip())}',
               "member_paywall_after_paragraph: null", "qa:", "  blind_review_rounds: 1",
               '  blind_review_protocol: "v2 mixed panel (US / UK / non-native, majority) -- via Workflow pipeline"',
               '  mechanical_qa: "pending"', "---", ""]

        open(path, "w", encoding="utf-8").write("\n".join(fm) + "\n" + "\n\n".join(lines) + "\n")
        written.append(ep)
        print(f"wrote {os.path.basename(path)}  blocks={len(lines)}{note}")

        bt = r.get("backTranslation", "")
        if bt.strip():
            open(os.path.join(BACKTRANS, f"backtrans-{ep:03d}.md"), "w", encoding="utf-8").write(bt)

    print(f"\n{len(written)}本を書き出した: {written}")
    if problems:
        print("\n=== 要確認 ===")
        for p in problems:
            print("  " + p)


if __name__ == "__main__":
    main()
