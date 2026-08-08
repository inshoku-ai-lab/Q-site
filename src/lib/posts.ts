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

// Notion's markdown export backslash-escapes underscores and asterisks
// (so they survive round-tripping without being read as emphasis
// markup) -- e.g. a tweeted @handle like "@paulsperry_" comes through as
// "@paulsperry\_". That backslash was never meant to be visible; strip it
// wherever it shows up, in block text as well as excerpt/description text.
function unescapeMarkdown(text: string): string {
  return text.replace(/\\([_*])/g, "$1");
}

// One-off content bugs found in specific articles' source content, not
// systemic enough to warrant a general rule -- keyed by the exact broken
// substring so a fix is a no-op (not a silent wrong-match) once the
// underlying Notion content is corrected upstream.
const CONTENT_FIXUPS: Record<string, string> = {
  // A duplicated/interleaved copy of the same RedState URL landed in the
  // <a> href (the correct URL is visible in the plain text right before
  // it in the source), producing a non-existent path.
  "https://redstate.com/bonchie/2020/02/10/the-boom-is-lowered-as-trump-cuts-70-positiohttps://redstate.com/bonchie/2020/02/10/the-boom-is-lowered-as-trump-cuts-70-positions-from-the-nsc-n128173ns-from-the-nsc-n128173":
    "https://redstate.com/bonchie/2020/02/10/the-boom-is-lowered-as-trump-cuts-70-positions-from-the-nsc-n128173",
  // "Twitter" was typed in Japanese katakana instead of the actual domain.
  "https://ツイッター.com/tracybeanz/status/13269816006896": "https://twitter.com/tracybeanz/status/13269816006896",
};

function applyContentFixups(text: string): string {
  let out = text;
  for (const [broken, fixed] of Object.entries(CONTENT_FIXUPS)) {
    if (out.includes(broken)) out = out.split(broken).join(fixed);
  }
  return out;
}

// Excerpt/SEO-description are plain-text Notion properties (used for
// <meta description>, OG/Twitter tags, RSS, and listing-page blurbs) that
// can carry the same WP "blogcard" shortcode artifact as body paragraphs
// (see preprocessBlocks below) -- strip it out here so it never leaks
// into a page's meta tags or a card's excerpt text.
function cleanExcerptText(text: string): string {
  if (!text) return text;
  let out = text;
  if (/\[{1,2}blogcard url="/i.test(out)) {
    out = out.replace(/\[{1,2}blogcard url="[^"]*"?\]{0,2}/gi, "").replace(/\s{2,}/g, " ").trim();
  }
  return unescapeMarkdown(out);
}

const allPosts = (postsData as unknown as Post[]).map((p) => ({
  ...p,
  excerpt: cleanExcerptText(p.excerpt),
  seo_description: cleanExcerptText(p.seo_description),
}));

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

function decodeSlugSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// A handful of migrated posts kept their original WordPress permalink,
// which for a non-ASCII (Japanese) title was never romanized and is
// still percent-encoded in `slug` (e.g. "%e7%9f%b3%e5%9e%a3..."), unlike
// the rest of the corpus where `slug` is a plain ASCII string. Index by
// the *decoded* form of every slug once so a decoded incoming URL segment
// matches regardless of which form the stored slug happens to be in --
// decoding an ASCII slug is a no-op, so this doesn't affect the majority.
const postsByDecodedSlug = new Map<string, Post>(allPosts.map((p) => [decodeSlugSafe(p.slug), p]));

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
  const slug = decodeSlugSafe(segments[0]);
  if (RESERVED_SLUGS.has(slug)) return null;
  return postsByDecodedSlug.get(slug) ?? null;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// The old WordPress site's taxonomy pages have no direct route on this
// site -- map the handful that are actually linked from article content
// to their closest modern equivalent (a series index page).
const LEGACY_CATEGORY_LINKS: Record<string, string> = {
  "/category/information-blog/twitterfiles": "/series/ツイッターファイル/",
  "/category/information-blog/tealswan": "/series/ティール・スワン/",
  "/category/information-blog/devolution": "/series/デボリューション理論/",
};

// Shared by rewriteInternalLinks (inline <a> tags) and BlogCard.astro
// (bare-URL blogcard blocks) -- both need to catch a qryptraveller.com
// link to an old taxonomy page before falling back to treating it as an
// unresolvable/external URL.
export function resolveLegacyCategoryLink(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, "");
    return LEGACY_CATEGORY_LINKS[pathname] ?? null;
  } catch {
    return null;
  }
}

// Rewrite any inline `href="https://qryptraveller.com/<slug>/"` that
// resolves to one of our own posts into a same-site /posts/<slug>/ link,
// so cross-references keep working once qryptraveller.com stops pointing
// at the old WordPress site. Also rewrites known old-taxonomy-page links
// (see LEGACY_CATEGORY_LINKS). Links we can't resolve are left untouched.
export function rewriteInternalLinks(html: string): string {
  return html.replace(/href="([^"]*qryptraveller\.com[^"]*)"/gi, (match, rawUrl) => {
    const url = rawUrl.replace(/&amp;/g, "&");
    const legacyTarget = resolveLegacyCategoryLink(url);
    if (legacyTarget) return `href="${legacyTarget}"`;
    const post = resolveInternalPost(url);
    return post ? `href="/posts/${post.slug}/"` : match;
  });
}

// The WordPress "blogcard" shortcode -- `[blogcard url="..."]` -- was
// carried over as literal text into paragraph blocks during the WP ->
// Notion migration and was never converted to a real link. The migration
// left behind several malformed variants of this shortcode, not just the
// clean form: URLs wrapped in HTML-entity-escaped angle brackets
// (`[blogcard url="&lt;https://...&gt;"]`), a missing closing `"]` where
// the shortcode runs to the end of the paragraph, doubled/nested brackets
// from markdown-link auto-wrapping (`[[blogcard url="..."]](url)`), and
// paragraphs containing more than one shortcode and/or leading prose text
// before the shortcode. This pattern matches all of those variants; the
// captured group is the raw URL, which still needs cleanUrl().
const BLOGCARD_RE =
  /\[{1,2}blogcard url="(?:&lt;)?([^"]*)"?(?:&gt;)?\]{0,2}(?:&gt;)?(?:(?!\[{1,2}blogcard)[[\]) "])*(?:\(https?:\/\/[^)]*\))?/gi;

// A bare http(s) URL sitting as plain, unlinked text -- the other common
// migration artifact. WordPress auto-linked (or auto-embedded) plain URLs
// on the fly; Notion's import just kept the literal text.
const BARE_URL_RE = /https?:\/\/[^\s<>"]+/gi;

// Japanese prose butting directly against a URL with no separating space
// (Japanese doesn't put spaces between words) or a literal "(LINK)" marker
// sometimes survives migration glued onto the end of it -- a real URL is
// plain ASCII (any non-ASCII content in it is percent-encoded), so
// anything from the first such character onward was never part of the URL.
function truncateAtProse(s: string): string {
  const idx = s.search(/\(LINK\)|[぀-ヿ一-鿿]/);
  return idx === -1 ? s : s.slice(0, idx);
}

// A URL immediately followed by `<...>` autolink syntax in the original
// markdown sometimes survives migration with only the closing bracket --
// as the HTML entity `&gt;` -- still attached, since BARE_URL_RE doesn't
// treat `&`/`;` as URL-terminating characters. Strip it here, the one
// place both the blogcard and bare-link paths funnel every extracted URL
// through.
function cleanUrl(raw: string): string {
  return truncateAtProse(raw).replace(/\\_/g, "_").replace(/&amp;/g, "&").replace(/&gt;$/, "").trim();
}

function isValidUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// `&lt;https://...&gt;` is the auto-link syntax `<https://...>` surviving
// as literal, HTML-entity-escaped text -- strip the escaped brackets so
// the URL underneath can be detected/linkified normally.
function stripEntityAngleBrackets(html: string): string {
  return html.replace(/&lt;(https?:\/\/[^\s&]+?)&gt;/gi, "$1");
}

// Turn any bare (not already inside an <a>) URL in a text chunk into a
// real link. Skips chunks that already contain an <a> tag entirely, to
// avoid ever wrapping an already-linked URL a second time.
function linkifyBareUrls(html: string): string {
  if (/<a[\s>]/i.test(html)) return html;
  return html.replace(BARE_URL_RE, (raw) => {
    const trimmed = truncateAtProse(raw).replace(/[)\].,;:!?、。」]+$/, "");
    const url = cleanUrl(trimmed);
    if (!isValidUrl(url)) return raw;
    // `raw.slice(trimmed.length)` -- not just the punctuation stripped
    // above but also any glued-on prose truncateAtProse cut off -- stays
    // as plain text right after the link instead of being swallowed into
    // the href or the visible link text.
    const trailing = raw.slice(trimmed.length);
    return `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener">${trimmed}</a>${trailing}`;
  });
}

// A chunk of paragraph text (either the whole paragraph, or the prose
// before/between/after a blogcard shortcode). If it's nothing but a bare
// URL, promote it to its own "blogcard" block instead of a plain link --
// mirroring how the shortcode form is handled -- otherwise just linkify
// any bare URLs and rewrite internal links within the remaining prose.
function textChunkToBlocks(b: Block, rawText: string): Block[] {
  if (!rawText.trim()) return [];
  const text = stripEntityAngleBrackets(rawText);
  const tagless = text.replace(/<[^>]+>/g, "").trim();
  // Only promote to a standalone blogcard if the chunk is truly nothing
  // but a URL -- if truncateAtProse would cut something off, this is a
  // URL with glued-on prose, not a bare link, and needs the mixed-content
  // path below so the prose doesn't get silently discarded.
  if (/^https?:\/\/\S+$/i.test(tagless) && truncateAtProse(tagless) === tagless) {
    const url = cleanUrl(tagless);
    if (isValidUrl(url)) return [{ type: "blogcard", url }];
  }
  return [{ ...b, html: rewriteInternalLinks(linkifyBareUrls(text)) }];
}

// Split a paragraph block's html on any embedded blogcard shortcode(s),
// turning prose before/between/after the shortcode(s) into paragraph
// block(s) (with any bare URLs in that prose linkified) and each
// shortcode into its own "blogcard" block. A paragraph with no shortcode
// (the common case) just goes straight through textChunkToBlocks.
function paragraphBlocks(b: Block): Block[] {
  const html = b.html ?? "";
  if (!/\[{1,2}blogcard url="/i.test(html)) {
    return textChunkToBlocks(b, html);
  }
  const out: Block[] = [];
  let lastIndex = 0;
  BLOGCARD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOGCARD_RE.exec(html))) {
    out.push(...textChunkToBlocks(b, html.slice(lastIndex, match.index)));
    const url = cleanUrl(match[1] ?? "");
    if (url) out.push({ type: "blogcard", url });
    lastIndex = match.index + match[0].length;
  }
  out.push(...textChunkToBlocks(b, html.slice(lastIndex)));
  return out;
}

// Convert blogcard-shortcode paragraphs (and bare-URL-only paragraphs)
// into dedicated "blogcard" blocks, linkify remaining bare URLs, and
// rewrite internal-site links (both inline and on bookmark/embed blocks)
// to point at this site instead of the old WordPress domain.
export function preprocessBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((rawBlock) => {
    const b = rawBlock.html ? { ...rawBlock, html: applyContentFixups(unescapeMarkdown(rawBlock.html)) } : rawBlock;
    if (b.type === "paragraph") {
      return paragraphBlocks(b);
    }
    // Notion's native bookmark/embed blocks are the same "link preview"
    // concept as the blogcard shortcode -- render them the same way.
    if ((b.type === "bookmark" || b.type === "embed") && b.url) {
      return [{ type: "blogcard", url: b.url }];
    }
    if (b.html) {
      return [{ ...b, html: rewriteInternalLinks(linkifyBareUrls(stripEntityAngleBrackets(b.html))) }];
    }
    return [b];
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
    case "スピリチュアリティ": return "spirituality";
    case "資産防衛": return "silver";
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
    case "スピリチュアリティ": return "#6F5791";
    case "資産防衛": return "#5C6670";
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
