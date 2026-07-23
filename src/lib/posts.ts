import postsData from "../data/posts.json";

export type Block = {
  type: string;
  html?: string;
  src?: string;
  caption?: string;
  code?: string;
  language?: string;
  url?: string;
  cells?: string[];
  children?: Block[];
  has_column_header?: boolean;
  has_row_header?: boolean;
};

export type Post = {
  id: number | string;
  notion_id: string | null;
  title: string;
  slug: string;
  date: string | null;
  status: string | null;
  category: string | null;
  series: string | null;
  episode: number | null;
  sub_episode: string | null;
  tags: string[];
  featured: boolean;
  excerpt: string;
  seo_description: string;
  reading_time: number;
  char_count: number;
  image_count: number;
  wp_url: string | null;
  cover: string | null;
  blocks: Block[];
};

const allPosts = postsData as unknown as Post[];

export function getAllPosts(): Post[] {
  return allPosts;
}

export function getPublishedPosts(): Post[] {
  return allPosts.filter((p) => p.status === "Published" || p.status === "Review");
}

export function getPostBySlug(slug: string): Post | undefined {
  return allPosts.find((p) => p.slug === slug);
}

// Path segments on the old qryptraveller.com (WordPress) that are site
// structure, not article slugs -- never rewrite links to these into
// /posts/<slug>/, and never treat them as a "blogcard" article link.
const RESERVED_SLUGS = new Set([
  "about", "archive", "series", "category", "tag", "posts", "rss.xml",
  "sitemap-index.xml", "sitemap-0.xml", "_astro", "favicon.ico", "favicon.svg", "404",
]);

// If `url` points at a single-segment path on qryptraveller.com that
// matches one of our own posts (the old WP site's flat slug structure),
// return that post. Anything else (external sites, the old site's shop/
// category pages, unmigrated slugs) returns null.
export function resolveInternalPost(url: string): Post | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^(www\.)?qryptraveller\.com$/i.test(u.hostname)) return null;
  const segments = u.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const slug = decodeURIComponent(segments[0]);
  if (RESERVED_SLUGS.has(slug)) return null;
  return getPostBySlug(slug) ?? null;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Rewrite any inline `href="https://qryptraveller.com/<slug>/"` that
// resolves to one of our own posts into a same-site /posts/<slug>/ link,
// so cross-references keep working once qryptraveller.com stops pointing
// at the old WordPress site. Links we can't resolve are left untouched.
export function rewriteInternalLinks(html: string): string {
  return html.replace(/href="([^"]*qryptraveller\.com[^"]*)"/gi, (match, url) => {
    const post = resolveInternalPost(url.replace(/&amp;/g, "&"));
    return post ? `href="/posts/${post.slug}/"` : match;
  });
}

// The WordPress "blogcard" shortcode -- `[blogcard url="..."]` -- was
// carried over as literal text into a paragraph block during the WP ->
// Notion migration and was never converted to a real link. Detect a
// paragraph block that consists of nothing but this shortcode and pull
// out its URL (unescaping the `\_` markdown-escape artifacts Notion's
// export adds).
export function extractBlogcardUrl(html: string | undefined): string | null {
  if (!html) return null;
  const m = html.trim().match(/^\[blogcard url="([^"]+)"\]$/);
  return m ? m[1].replace(/\\_/g, "_") : null;
}

// Convert blogcard-shortcode paragraphs into a dedicated "blogcard" block
// type, and rewrite internal-site links (both inline and on bookmark/embed
// blocks) to point at this site instead of the old WordPress domain.
export function preprocessBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type === "paragraph") {
      const url = extractBlogcardUrl(b.html);
      if (url) return { type: "blogcard", url };
      if (b.html) return { ...b, html: rewriteInternalLinks(b.html) };
      return b;
    }
    // Notion's native bookmark/embed blocks are the same "link preview"
    // concept as the blogcard shortcode -- render them the same way.
    if ((b.type === "bookmark" || b.type === "embed") && b.url) {
      return { type: "blogcard", url: b.url };
    }
    if (b.html) return { ...b, html: rewriteInternalLinks(b.html) };
    return b;
  });
}

// A callout block marks the boundary between free and member-only content
// (see MEMBERSHIP_HANDOFF.md §1-9). The callout itself stays visible to
// everyone as the "here's where it gets member-only" signpost.
export function splitMemberContent(blocks: Block[]): {
  freeBlocks: Block[];
  memberBlocks: Block[];
  hasMemberContent: boolean;
} {
  const idx = blocks.findIndex((b) => b.type === "callout");
  if (idx === -1) {
    return { freeBlocks: blocks, memberBlocks: [], hasMemberContent: false };
  }
  return {
    freeBlocks: blocks.slice(0, idx + 1),
    memberBlocks: blocks.slice(idx + 1),
    hasMemberContent: blocks.length > idx + 1,
  };
}

export function getPostsByCategory(category: string): Post[] {
  return getPublishedPosts().filter((p) => p.category === category);
}

export function getPostsBySeries(series: string): Post[] {
  const list = getPublishedPosts().filter((p) => p.series === series);
  // Series with episode numbers: ascending by episode
  if (list.some((p) => p.episode != null)) {
    return list.sort((a, b) => {
      const ea = a.episode ?? 9999;
      const eb = b.episode ?? 9999;
      if (ea !== eb) return ea - eb;
      return (a.date ?? "").localeCompare(b.date ?? "");
    });
  }
  // Otherwise: newest first
  return list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function getPostsByTag(tag: string): Post[] {
  return getPublishedPosts().filter((p) => p.tags.includes(tag));
}

export function getLatestPosts(limit = 10): Post[] {
  return getPublishedPosts().slice(0, limit);
}

export function getSeriesIndex(): { name: string; count: number; latest: Post | undefined; representative: Post | undefined }[] {
  const map = new Map<string, Post[]>();
  for (const p of getPublishedPosts()) {
    if (!p.series) continue;
    if (!map.has(p.series)) map.set(p.series, []);
    map.get(p.series)!.push(p);
  }
  return Array.from(map.entries()).map(([name, posts]) => {
    const sorted = [...posts].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const repr = posts.find((p) => p.cover) ?? sorted[0];
    return {
      name,
      count: posts.length,
      latest: sorted[0],
      representative: repr,
    };
  });
}

export function getCategoryIndex(): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of getPublishedPosts()) {
    if (!p.category) continue;
    map.set(p.category, (map.get(p.category) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}

export function getTagIndex(): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of getPublishedPosts()) {
    for (const t of p.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function getArchiveIndex(): { year: string; posts: Post[] }[] {
  const map = new Map<string, Post[]>();
  for (const p of getPublishedPosts()) {
    const year = (p.date ?? "").slice(0, 4) || "未分類";
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(p);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, posts]) => ({
      year,
      posts: posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    }));
}

export function getSeriesNavigator(post: Post): { prev: Post | null; next: Post | null } {
  if (!post.series) return { prev: null, next: null };
  const list = getPostsBySeries(post.series);
  const idx = list.findIndex((p) => p.id === post.id);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? list[idx - 1] : null,
    next: idx < list.length - 1 ? list[idx + 1] : null,
  };
}

export function getMemberOnlyPosts(limit?: number): Post[] {
  const list = getPublishedPosts().filter((p) => splitMemberContent(p.blocks).hasMemberContent);
  return limit ? list.slice(0, limit) : list;
}

export function getRelatedPosts(post: Post, limit = 3): Post[] {
  // Same series posts first, then same category
  const sameSeries = post.series
    ? getPublishedPosts().filter((p) => p.id !== post.id && p.series === post.series)
    : [];
  const sameCategory = getPublishedPosts().filter(
    (p) => p.id !== post.id && p.category === post.category && p.series !== post.series,
  );
  const tagOverlap = getPublishedPosts().filter(
    (p) => p.id !== post.id && p.tags.some((t) => post.tags.includes(t)),
  );
  const seen = new Set<string | number>();
  const result: Post[] = [];
  for (const list of [sameSeries, sameCategory, tagOverlap]) {
    for (const p of list) {
      if (result.length >= limit) break;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      result.push(p);
    }
    if (result.length >= limit) break;
  }
  return result;
}

export function categoryAccent(category: string | null): string {
  switch (category) {
    case "放浪記": return "wandering";
    case "思想・理論": return "thought";
    case "時事・情報戦": return "current";
    case "エッセイ・その他": return "essay";
    case "ビットコインの真実": return "bitcoin";
    default: return "ink";
  }
}

// Hex equivalents of the tailwind.config.mjs accent colors, for dynamic
// inline-style gradients/dots where Tailwind's static class scanner can't
// see the template-literal class name (e.g. `bg-${accent}`).
export function categoryAccentHex(category: string | null): string {
  switch (category) {
    case "放浪記": return "#846849";
    case "思想・理論": return "#4A5E66";
    case "時事・情報戦": return "#9C5642";
    case "エッセイ・その他": return "#746B5C";
    case "ビットコインの真実": return "#8A6719";
    default: return "#2A1F11";
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function safeSlug(s: string): string {
  // For URL slugs in series/category/tag pages
  return encodeURIComponent(s);
}
