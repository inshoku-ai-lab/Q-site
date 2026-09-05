#!/usr/bin/env python3
"""
The Vagabond Chronicles 英訳記事の機械QA。

人間が読まなくても落とせる欠陥だけを、決定的に検出する。
文体や自然さは検出できない（それはブラインド査読の仕事）。

使い方:
  python3 qa_check.py <英語md> --source <日本語md>
  python3 qa_check.py migration/posts-en/*.md --source-dir migration/posts

終了コード: 0 = 問題なし / 1 = ERROR あり
"""
import argparse
import glob
import os
import re
import sys

# ---------------------------------------------------------------------------
# 検出パターン
# ---------------------------------------------------------------------------

# 日本語話者の英訳に出る直訳癖。詳細は reference/translationese.md。
# ここに載っていても常に誤りではない -- 「出たら疑え」の警告。
TRANSLATIONESE = [
    (r"\bI thought that\b", "〜と思う の直訳。多くは断定でよい"),
    (r"\bIt was that\b", "〜のだ の直訳"),
    (r"\bas expected\b", "やっぱり の直訳。sure enough / of course"),
    (r"\bfor the time being\b", "とりあえず の直訳。for now / anyway"),
    (r"\bwas able to\b", "〜ことができる の直訳。could で足りる"),
    (r"\bended up\b", "〜てしまう の直訳。単なる過去形で足りることが多い"),
    (r"\bI felt like that\b", "〜ような気がする の直訳"),
    (r"\bregarding\b", "〜に関して の直訳。about / on"),
    (r"\bAnd then,", "そして／それから の連鎖"),
    (r"\bvery very\b", "とても の重ね"),
    (r"\bsomehow\b", "なんとなく の直訳。for some reason か、訳さない"),
    (r"\bafter all\b", "結局 の直訳。in the end / eventually"),
    (r"\bby the way\b", "ちなみに の直訳。多くは削る"),
    (r"\bhilariously\b|\bamazingly\b|\bshockingly\b", "原文にない感情の指示"),
    (r"\bMr\. [A-Z]\b", "イニシャル匿名に敬称。M / C のように英字だけ"),
    (r"\bcy-?trance\b", "psytrance の綴り誤り"),
]

# 本文に入ってはいけないもの
FORBIDDEN = [
    (r"\[?(?:Previous|Next) (?:article|episode)\]?", "前後記事ナビリンクは本文に入れない"),
    (r"(?:前|次)の記事", "日本語のナビリンクが残っている"),
    (r"^\s*(?:Translator'?s note|訳注)", "訳注ブロックは使わない"),
]

PAYWALL_EN = "Members only from here"
PAYWALL_JA = "ここから会員限定"

# 日本語版の文字数に対する英語語数の期待比。
# 実測: 放浪記の平均1,557字 -> おおよそ 1字 = 0.45 語。
# 大きく外れたら段落の落としか水増しを疑う。
WORDS_PER_JA_CHAR = 0.45
RATIO_TOLERANCE = 0.30


def split_front_matter(text):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return None, text
    return m.group(1), m.group(2)


def fm_value(fm, key):
    if not fm:
        return None
    m = re.search(rf'^{re.escape(key)}:\s*"?(.*?)"?\s*$', fm, re.M)
    return m.group(1) if m else None


# The Japanese sources still carry their "前の記事 ｜ 次の記事" footer until the
# Notion cleanup runs (scripts/strip-nav-links.mjs). It is never translated, so
# leaving it in would make every article look short and would report the
# neighbouring episode numbers as dropped. Mirrors scripts/lib/nav-links.mjs --
# narrow on purpose, so prose that merely mentions another episode survives.
NAV_TOKEN = re.compile(r"(?:前|次)の記事(?:[0-9０-９]+)?(?:に続く|へ続く|はこちら(?:です)?|へ)?")
NAV_SEPARATORS = re.compile(r"[\s　｜|│￨/／・、,．.。\-–—←→⇦⇨<>《》「」【】()（）]")
MD_LINK = re.compile(r"\\?\[([^\]]*)\\?\]\([^)]*\)")
CONTINUATION = re.compile(r"^(?:続き|つづき)|続きは?こちら")


def is_nav_line(line):
    """True when a source line is nothing but prev/next or continue navigation."""
    plain = MD_LINK.sub(r"\1", line).replace("\\", "").strip()
    if not plain:
        return False
    if re.search(r"(?:前|次)の記事", plain):
        return not NAV_SEPARATORS.sub("", NAV_TOKEN.sub("", plain))
    # A continue-reading link: the line must BE the link, so that the author's
    # unlinked "つづく。。。" closing line is kept as the prose it is.
    if CONTINUATION.search(plain) and re.search(r"\]\(https?://", line):
        return not NAV_SEPARATORS.sub("", CONTINUATION.sub("", plain))
    return False


NAV_START = re.compile(r"^\\?\[\s*(前|次)の記事")


def strip_nav(body):
    """末尾ナビを落とす。

    Ep 71以降のNotionはナビをURLの途中で改行して**非空行3行**で持っており、
    1行目はリンクが閉じていないので1行ずつの判定では落とせない。
    ナビは必ず記事末尾にあるので、行頭がナビリンクの最初の行から末尾までを
    先に切る。「次の記事」に言及するだけの地の文は行頭がリンクではないため残る。
    """
    lines = body.split("\n")
    for i, l in enumerate(lines):
        if NAV_START.match(l.strip()):
            lines = lines[:i]
            break
    return "\n".join(l for l in lines if not is_nav_line(l))


def paragraphs(body):
    """段落に割る。見出しと callout も1段落として数える。

    英訳ファイルは空行区切り。一方 Notion から取った原文は1行1文で空行が無く、
    空行だけで割ると「全体で1段落」になってしまう（実際に誤検知を出した）。
    空行が実質的に無ければ、非空行そのものを段落として数える。
    """
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    lines = [l.strip() for l in body.split("\n") if l.strip()]
    if len(paras) <= 1 and len(lines) > 1:
        return lines
    return paras


def paywall_index(paras, marker):
    for i, p in enumerate(paras):
        if marker in p:
            return i
    return None


def check(path, source_path):
    problems = []   # (level, message)
    text = open(path, encoding="utf-8").read()
    fm, body = split_front_matter(text)

    if fm is None:
        return [("ERROR", "YAMLフロントマターが無い")]

    # --- フロントマター必須項目 ------------------------------------------
    for key in ("episode", "title", "slug", "excerpt", "arc"):
        if not fm_value(fm, key):
            problems.append(("ERROR", f"フロントマター欠落: {key}"))

    if fm_value(fm, "lang") != "en":
        problems.append(("ERROR", 'lang が "en" でない'))

    title = fm_value(fm, "title") or ""
    if title and not title.startswith("The Vagabond Chronicles #"):
        problems.append(("ERROR", f"タイトル形式が規約外: {title}"))

    slug = fm_value(fm, "slug") or ""
    if slug and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*-vagabond-chronicles-\d{3}", slug):
        problems.append(("ERROR", f"スラッグ形式が規約外: {slug}"))

    excerpt = fm_value(fm, "excerpt") or ""
    words = len(excerpt.split())
    if excerpt and not (25 <= words <= 60):
        problems.append(("WARN", f"excerpt が {words} 語（推奨30〜50語）"))
    if "!" in excerpt:
        problems.append(("WARN", "excerpt に感嘆符"))

    # --- 本文 -------------------------------------------------------------
    # 画像の URL には日本語のファイル名が入っている（例 旅行記004-1.jpg）。
    # これは訳し残しではないので、URL を除いてから地の文だけを見る。
    prose = re.sub(r"\]\([^)]*\)", "]()", body)
    stray = re.findall(r"[぀-ヿ一-鿿]+", prose)
    # 1〜2文字の連なりは「その文字自体を話題にしている」引用であることが多い。
    # Ep 67 は包装の「糖」の字を見分ける場面で、字を消すと場面が成立しない
    # （英語には "the character 糖 — sugar" と註が付いている）。
    # 訳し残しの地の文は必ずもっと長くなるので、3文字以上をERRORとする。
    long_runs = [s for s in stray if len(s) >= 3]
    short_runs = [s for s in stray if len(s) < 3]
    if long_runs:
        problems.append(("ERROR", f"日本語が残っている: {' '.join(long_runs[:5])}"))
    if short_runs:
        problems.append(("WARN", f"日本語の文字が地の文にある（字そのものを論じているなら可）: "
                                 f"{' '.join(short_runs[:5])}"))

    # 画像は英語版サイトの方針が2点ある（著者が決定済み）。
    #   1. URL はリポジトリ内の /images/wp/... を使う（WordPress停止でも壊れないため）
    #   2. 代替テキストは英語で必ず付ける（読み上げソフトとSEOのため）
    for alt, url in re.findall(r"!\[([^\]]*)\]\(([^)]+)\)", body):
        name = url.rsplit("/", 1)[-1]
        if not url.startswith("/images/wp/"):
            problems.append(("ERROR", f"画像URLが /images/wp/... 形式でない: {url}"))
        if not alt.strip():
            problems.append(("WARN", f"画像の代替テキストが空: {name}"))

    for pat, msg in FORBIDDEN:
        if re.search(pat, body, re.M | re.I):
            problems.append(("ERROR", msg))

    for pat, msg in TRANSLATIONESE:
        hits = re.findall(pat, body, re.I)
        if hits:
            problems.append(("WARN", f"訳文くささ: {hits[0]!r} — {msg}"))

    en_paras = paragraphs(body)
    en_words = len(re.findall(r"[A-Za-z']+", body))

    # --- 原文との突き合わせ ------------------------------------------------
    if source_path and os.path.exists(source_path):
        src = open(source_path, encoding="utf-8").read()
        _, src_body = split_front_matter(src)
        src_body = strip_nav(src_body)
        src_paras = paragraphs(src_body)
        src_chars = len(re.sub(r"\s", "", src_body))

        expected = src_chars * WORDS_PER_JA_CHAR
        if expected > 0:
            ratio = en_words / expected
            if ratio < 1 - RATIO_TOLERANCE:
                problems.append((
                    "ERROR",
                    f"英語が短すぎる（期待の{ratio:.0%}）。段落の脱落を疑う "
                    f"[原文{src_chars}字 / 英訳{en_words}語]",
                ))
            elif ratio > 1 + RATIO_TOLERANCE:
                problems.append((
                    "WARN",
                    f"英語が長すぎる（期待の{ratio:.0%}）。説明の足しすぎを疑う "
                    f"[原文{src_chars}字 / 英訳{en_words}語]",
                ))

        # 段落数はリズムの指標。原文の1文1段落を保っているかを見る。
        if src_paras and abs(len(en_paras) - len(src_paras)) > max(3, len(src_paras) * 0.15):
            problems.append((
                "WARN",
                f"段落数の乖離: 原文{len(src_paras)} / 英訳{len(en_paras)}",
            ))

        # 画像 -- Ep 6 で画像が1枚まるごと落ちたのに、他のチェックが全て通ってしまった。
        # 枚数と URL を突き合わせる。位置は段落数がずれるので割合で見る。
        img_re = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
        src_imgs = img_re.findall(src_body)
        en_imgs = img_re.findall(body)
        if len(src_imgs) != len(en_imgs):
            problems.append((
                "ERROR",
                f"画像の枚数が違う: 原文{len(src_imgs)}枚 / 英訳{len(en_imgs)}枚。脱落を疑う",
            ))
        else:
            def basename(u):
                return u.rsplit("/", 1)[-1]
            for s, e in zip(src_imgs, en_imgs):
                if basename(s) != basename(e):
                    problems.append((
                        "ERROR",
                        f"画像の順序かファイル名が違う: 原文 {basename(s)} / 英訳 {basename(e)}",
                    ))

        # 会員限定マーカー -- ずれると有料記事が無料で出る
        src_i = paywall_index(src_paras, PAYWALL_JA)
        en_i = paywall_index(en_paras, PAYWALL_EN)
        if src_i is not None and en_i is None:
            problems.append(("ERROR", "原文に会員限定マーカーがあるのに英訳に無い"))
        elif src_i is None and en_i is not None:
            problems.append(("ERROR", "原文に無い会員限定マーカーが英訳にある"))
        elif src_i is not None and en_i is not None:
            # 段落数がずれるので位置は割合で比較する
            src_pos = src_i / len(src_paras)
            en_pos = en_i / len(en_paras)
            if abs(src_pos - en_pos) > 0.08:
                problems.append((
                    "ERROR",
                    f"会員限定マーカーの位置がずれている（原文{src_pos:.0%} / 英訳{en_pos:.0%}）",
                ))

        # 数字は翻訳で変わらないはず。金額・年・距離の取り違えを拾う。
        src_nums = set(re.findall(r"\d+", src_body.translate(
            str.maketrans("０１２３４５６７８９", "0123456789"))))
        en_nums = set(re.findall(r"\d+", body))
        # 3桁以上の数字だけ見る（1〜2桁は語り口で表記が変わる）
        missing = {n for n in src_nums if len(n) >= 3} - en_nums
        if missing:
            problems.append((
                "WARN",
                f"原文にある数字が英訳に見当たらない: {', '.join(sorted(missing)[:6])}"
                "（英字表記かドル換算なら問題なし）",
            ))
    elif source_path:
        problems.append(("WARN", f"原文が見つからない: {source_path}"))

    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--source", help="対応する日本語mdファイル")
    ap.add_argument("--source-dir", help="日本語mdのディレクトリ（source_slug で照合）")
    ap.add_argument("--ja-src-dir",
                    help="Notionから取得した原文のディレクトリ（ep-NNN.md で照合）。"
                         "こちらが正本なので --source-dir より優先する")
    args = ap.parse_args()

    paths = []
    for f in args.files:
        paths.extend(sorted(glob.glob(f)) or [f])

    total_err = total_warn = 0
    for path in paths:
        source = args.source
        fm = None
        # Notion から取得した原文が正本。エクスポートは移行時の古いスナップショットで、
        # Ep 103 では会員限定マーカーの有無が実際に食い違っていた。あるならこちらを使う。
        if not source and args.ja_src_dir:
            fm, _ = split_front_matter(open(path, encoding="utf-8").read())
            ep = fm_value(fm, "episode")
            if ep and ep.strip().isdigit():
                cand = os.path.join(args.ja_src_dir, f"ep-{int(ep):03d}.md")
                source = cand if os.path.exists(cand) else None
        if not source and args.source_dir:
            if fm is None:
                fm, _ = split_front_matter(open(path, encoding="utf-8").read())
            src_slug = fm_value(fm, "source_slug")
            if src_slug:
                hits = glob.glob(os.path.join(args.source_dir, f"*{src_slug}.md"))
                source = hits[0] if hits else None

        problems = check(path, source)
        errs = [p for p in problems if p[0] == "ERROR"]
        warns = [p for p in problems if p[0] == "WARN"]
        total_err += len(errs)
        total_warn += len(warns)

        if problems:
            print(f"\n{path}")
            for level, msg in problems:
                print(f"  [{level}] {msg}")
        else:
            print(f"{path}: OK")

    print(f"\n=== {len(paths)}ファイル / ERROR {total_err} / WARN {total_warn} ===")
    if total_err:
        print("ERROR があります。公開してはいけません。")
    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main())
