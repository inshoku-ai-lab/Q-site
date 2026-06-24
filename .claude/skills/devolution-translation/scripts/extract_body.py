#!/usr/bin/env python3
"""Extract the verbatim article body from a saved Patel Patriot Substack HTML page.

Usage:
    python3 extract_body.py <input.html> <output.md>

Parses `div.body markup` and emits Markdown that preserves headings, paragraphs,
blockquotes, lists, images and links. Title/author/date are read from the
schema.org NewsArticle JSON-LD embedded in the page. Prints stats (chars, word
count, image count) so you can sanity-check that the whole article was captured.

Requires: beautifulsoup4  (pip install beautifulsoup4)
"""
import json
import re
import sys

from bs4 import BeautifulSoup, NavigableString, Tag


def inline(el):
    out = []
    for c in el.children:
        if isinstance(c, NavigableString):
            out.append(str(c))
        elif isinstance(c, Tag):
            if c.name in ("strong", "b"):
                out.append("**" + inline(c).strip() + "**")
            elif c.name in ("em", "i"):
                out.append("*" + inline(c).strip() + "*")
            elif c.name == "a":
                out.append("[" + inline(c).strip() + "](" + c.get("href", "") + ")")
            elif c.name == "br":
                out.append("\n")
            else:
                out.append(inline(c))
    return "".join(out)


def extract_meta(soup):
    meta = {"title": "", "author": "", "url": "", "published": "", "description": ""}
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for d in items:
            if isinstance(d, dict) and d.get("@type") == "NewsArticle":
                meta["title"] = d.get("headline", "")
                meta["description"] = d.get("description", "")
                meta["url"] = d.get("url", "")
                meta["published"] = (d.get("datePublished", "") or "")[:10]
                auth = d.get("author")
                if isinstance(auth, list) and auth:
                    auth = auth[0]
                if isinstance(auth, dict):
                    meta["author"] = auth.get("name", "")
                return meta
    return meta


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: extract_body.py <input.html> <output.md>")
    src, out = sys.argv[1], sys.argv[2]
    soup = BeautifulSoup(open(src, encoding="utf-8").read(), "html.parser")
    body = soup.find("div", class_="body markup")
    if not body:
        sys.exit("ERROR: <div class='body markup'> not found — page not fully rendered?")

    lines = []

    def emit(s=""):
        lines.append(s)

    def walk(node):
        for el in node.children:
            if isinstance(el, NavigableString):
                t = str(el).strip()
                if t:
                    emit(t)
                    emit()
                continue
            if not isinstance(el, Tag):
                continue
            n = el.name
            if n in ("h1", "h2", "h3", "h4", "h5", "h6"):
                emit("#" * int(n[1]) + " " + inline(el).strip())
                emit()
            elif n == "p":
                txt = inline(el).strip()
                if txt:
                    emit(txt)
                    emit()
            elif n == "blockquote":
                for ln in inline(el).split("\n"):
                    emit("> " + ln.rstrip())
                emit()
            elif n in ("ul", "ol"):
                for i, li in enumerate(el.find_all("li", recursive=False)):
                    emit(("- " if n == "ul" else f"{i + 1}. ") + inline(li).strip())
                emit()
            elif n == "hr":
                emit("---")
                emit()
            elif "image" in (el.get("class") or []) or el.find("img"):
                img = el.find("img")
                if img:
                    emit(f"![]({img.get('src') or img.get('data-src') or ''})")
                    emit()
            else:
                walk(el)

    walk(body)
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() + "\n"

    m = extract_meta(soup)
    fm = (
        "---\n"
        "series: Devolution\n"
        f'title: "{m["title"]}"\n'
        f'subtitle: "{m["description"]}"\n'
        f'author: "{m["author"]}"\n'
        f'source_url: "{m["url"]}"\n'
        f'published: "{m["published"]}"\n'
        'note: "Verbatim source captured from server-rendered HTML. Do not use WebFetch (it summarizes)."\n'
        "---\n\n"
    )
    open(out, "w", encoding="utf-8").write(fm + text)

    words = len(re.findall(r"[A-Za-z']+", text))
    tail = " ".join(text.split()[-12:])
    print(f"saved: {out}")
    print(f"title: {m['title']}  published: {m['published']}")
    print(f"chars: {len(text)}  approx_words: {words}  images: {text.count('![](')}")
    print(f"tail: …{tail}")


if __name__ == "__main__":
    main()
