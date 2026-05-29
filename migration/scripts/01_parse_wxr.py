"""
Phase 1 - Step 1: Parse WordPress WXR export
- Extracts posts, pages, attachments
- Converts post HTML to Markdown
- Writes per-post .md files with YAML frontmatter
- Outputs CSV of all posts and a JSON manifest of attachments
"""
import csv
import json
import os
import re
from collections import Counter
from pathlib import Path

from lxml import etree
from markdownify import markdownify as md_convert

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "wordpress-export.xml"
POSTS_DIR = ROOT / "posts"
REPORTS_DIR = ROOT / "reports"
POSTS_DIR.mkdir(exist_ok=True)
REPORTS_DIR.mkdir(exist_ok=True)

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
}


def text(el, path, default=""):
    if el is None:
        return default
    v = el.findtext(path, namespaces=NS)
    return v if v is not None else default


def slugify_fallback(s: str) -> str:
    s = re.sub(r"[^\w\-]+", "-", s.strip().lower())
    return s.strip("-")[:80] or "untitled"


def yaml_escape(s: str) -> str:
    if s is None:
        return ""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip()


def extract_images(html: str):
    if not html:
        return []
    urls = set()
    # <img src="...">
    for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.I):
        urls.add(m.group(1))
    # markdown ![](url) - not expected in WP raw but just in case
    for m in re.finditer(r'!\[[^\]]*\]\(([^)\s]+)', html):
        urls.add(m.group(1))
    # WordPress block image attrs
    for m in re.finditer(r'"url":"(https?://[^"]+\.(?:jpe?g|png|gif|webp|svg|avif))"', html, re.I):
        urls.add(m.group(1))
    # srcset
    for m in re.finditer(r'srcset=["\']([^"\']+)["\']', html, re.I):
        for piece in m.group(1).split(","):
            url = piece.strip().split(" ")[0]
            if url:
                urls.add(url)
    return sorted(urls)


def main():
    print(f"Parsing {SRC} ...")
    parser = etree.XMLParser(recover=True, huge_tree=True)
    tree = etree.parse(str(SRC), parser)
    root = tree.getroot()
    items = root.findall(".//item")
    print(f"Total items: {len(items)}")

    posts = []
    attachments = []  # {id, url, title, parent, mime}
    cat_counter = Counter()
    tag_counter = Counter()
    image_urls_global = set()

    for it in items:
        post_type = text(it, "wp:post_type")
        status = text(it, "wp:status")
        post_id = text(it, "wp:post_id")
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        slug = text(it, "wp:post_name") or slugify_fallback(title or f"post-{post_id}")
        pub_date = text(it, "wp:post_date")
        pub_date_gmt = text(it, "wp:post_date_gmt")
        creator = it.findtext("dc:creator", namespaces=NS) or ""
        content = it.findtext("content:encoded", namespaces=NS) or ""
        excerpt = it.findtext("excerpt:encoded", namespaces=NS) or ""
        parent = text(it, "wp:post_parent")

        if post_type == "attachment":
            url = text(it, "wp:attachment_url")
            mime = ""
            for pm in it.findall("wp:postmeta", namespaces=NS):
                k = pm.findtext("wp:meta_key", namespaces=NS) or ""
                if k == "_wp_attached_file":
                    pass
            attachments.append({
                "id": post_id,
                "url": url,
                "title": title,
                "parent": parent,
                "slug": slug,
                "date": pub_date,
            })
            continue

        if post_type != "post":
            continue

        # categories & tags
        cats, tags = [], []
        for c in it.findall("category"):
            domain = c.get("domain", "")
            name = (c.text or "").strip()
            if not name:
                continue
            if domain == "category":
                cats.append(name)
                cat_counter[name] += 1
            elif domain == "post_tag":
                tags.append(name)
                tag_counter[name] += 1

        # Featured image id
        featured_id = ""
        for pm in it.findall("wp:postmeta", namespaces=NS):
            k = pm.findtext("wp:meta_key", namespaces=NS) or ""
            v = pm.findtext("wp:meta_value", namespaces=NS) or ""
            if k == "_thumbnail_id":
                featured_id = v

        # Images in body
        body_images = extract_images(content)
        for u in body_images:
            image_urls_global.add(u)

        # HTML -> Markdown
        # Strip WP block comments first (<!-- wp:... --> and <!-- /wp:... -->)
        clean_html = re.sub(r"<!--\s*/?wp:[^>]*-->", "", content)
        try:
            md_body = md_convert(clean_html, heading_style="ATX", bullets="-", strip=["script", "style"])
        except Exception as e:
            md_body = clean_html
            print(f"  md convert failed for {post_id}: {e}")

        # collapse 3+ blank lines
        md_body = re.sub(r"\n{3,}", "\n\n", md_body).strip()
        char_count = len(re.sub(r"\s+", "", md_body))

        post_row = {
            "id": post_id,
            "slug": slug,
            "title": title,
            "link": link,
            "status": status,
            "date": pub_date,
            "date_gmt": pub_date_gmt,
            "creator": creator,
            "categories": "; ".join(cats),
            "tags": "; ".join(tags),
            "featured_id": featured_id,
            "image_count": len(body_images),
            "char_count": char_count,
            "excerpt": (excerpt or "").strip()[:200],
            "flags": "",
        }

        # quality flags
        flags = []
        if char_count < 200:
            flags.append("short")
        if not body_images:
            flags.append("no-images")
        if status != "publish":
            flags.append(f"status:{status}")
        post_row["flags"] = ";".join(flags)

        posts.append(post_row)

        # Write per-post MD with frontmatter
        safe_slug = slug or f"post-{post_id}"
        # Avoid name collisions if any
        out_path = POSTS_DIR / f"{post_row['date'][:10]}_{safe_slug}.md"
        fm_lines = [
            "---",
            f'id: {post_id}',
            f'title: "{yaml_escape(title)}"',
            f'slug: "{safe_slug}"',
            f'date: "{pub_date}"',
            f'status: "{status}"',
            f'original_url: "{link}"',
            f'featured_image_id: "{featured_id}"',
            "categories:",
        ]
        for c in cats:
            fm_lines.append(f'  - "{yaml_escape(c)}"')
        fm_lines.append("tags:")
        for t in tags:
            fm_lines.append(f'  - "{yaml_escape(t)}"')
        fm_lines.append("images:")
        for u in body_images:
            fm_lines.append(f'  - "{u}"')
        if excerpt:
            fm_lines.append(f'excerpt: "{yaml_escape(excerpt)}"')
        fm_lines.append(f'flags: "{post_row["flags"]}"')
        fm_lines.append("---")
        fm_lines.append("")
        fm_lines.append(md_body)
        out_path.write_text("\n".join(fm_lines), encoding="utf-8")

    # Write posts CSV
    csv_path = REPORTS_DIR / "posts.csv"
    fieldnames = list(posts[0].keys()) if posts else []
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in posts:
            w.writerow(r)
    print(f"Wrote {csv_path} ({len(posts)} posts)")

    # Write attachments manifest
    att_path = REPORTS_DIR / "attachments.json"
    att_path.write_text(json.dumps(attachments, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {att_path} ({len(attachments)} attachments)")

    # Image URLs (body + attachments)
    all_image_urls = set(image_urls_global)
    for a in attachments:
        if a["url"]:
            all_image_urls.add(a["url"])
    img_list_path = REPORTS_DIR / "image_urls.txt"
    img_list_path.write_text("\n".join(sorted(all_image_urls)), encoding="utf-8")
    print(f"Wrote {img_list_path} ({len(all_image_urls)} unique image URLs)")

    # Category / Tag stats
    stats = {
        "totals": {
            "posts": len(posts),
            "attachments": len(attachments),
            "unique_images": len(all_image_urls),
        },
        "status_breakdown": dict(Counter(p["status"] for p in posts)),
        "flag_breakdown": dict(Counter(f for p in posts for f in (p["flags"].split(";") if p["flags"] else []))),
        "categories_top50": cat_counter.most_common(50),
        "tags_top100": tag_counter.most_common(100),
        "categories_total_unique": len(cat_counter),
        "tags_total_unique": len(tag_counter),
        "yearly_distribution": dict(Counter((p["date"] or "")[:4] for p in posts)),
    }
    stats_path = REPORTS_DIR / "stats.json"
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {stats_path}")

    print("\nDONE - summary:")
    print(json.dumps(stats["totals"], indent=2))
    print("Status:", stats["status_breakdown"])
    print("Flags:", stats["flag_breakdown"])
    print("Years:", stats["yearly_distribution"])
    print(f"Unique categories: {stats['categories_total_unique']}")
    print(f"Unique tags: {stats['tags_total_unique']}")


if __name__ == "__main__":
    main()
