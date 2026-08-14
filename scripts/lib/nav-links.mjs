/**
 * Detection of the in-body "previous / next episode" navigation lines.
 *
 * The WordPress articles carried their own navigation at the foot of the
 * body -- `[前の記事102](url)　｜　[次の記事104](url)` -- which the site now
 * renders itself from series/episode metadata. The in-body copy is a
 * duplicate, so it is stripped at sync time (scripts/sync-notion.mjs) and
 * removed from Notion outright (scripts/strip-nav-links.mjs).
 *
 * The matcher is deliberately narrow. A paragraph is nav ONLY when it
 * consists of nothing but nav tokens and separators. Prose that merely
 * *mentions* an earlier episode keeps text once the tokens are removed:
 *
 *   "以前の記事で紹介したホームレスのFさんとCさんだ。"  -> not nav (prose remains)
 *   "その文化については次の記事で紹介したい。"          -> not nav (prose remains)
 *   "[前の記事102](url)　｜　[次の記事104](url)"        -> nav (nothing remains)
 *
 * Getting this wrong deletes article text, so the rule is "remove only
 * what is provably nothing but navigation" rather than "remove anything
 * that looks navigational".
 */

// A nav token: 前/次 の記事, an optional episode number (half- or
// full-width), and an optional trailing connective ("に続く", "はこちら").
const NAV_TOKEN =
  /(?:前|次)の記事(?:[0-9０-９]+)?(?:に続く|へ続く|はこちら(?:です)?|へ)?/g;

// Separators and decorations that legitimately sit between two nav links.
const NAV_SEPARATORS = /[\s　｜|│￨/／・、,．.。\-–—←→⇦⇨<>《》「」【】()（）]/g;

// Some series wrote the navigation as a text line ("次の記事はこちらです。")
// followed by a bare article URL that the site promotes to a link card.
// Dropping only the text would leave the card orphaned, so the URL that
// immediately follows a nav paragraph is removed with it.
const ARTICLE_URL = /^https?:\/\/(?:www\.)?qryptraveller\.com\/[^\s]*$/;

/**
 * True when `text` is nothing but prev/next navigation.
 *
 * @param {string} text Plain text of a single block (HTML already stripped).
 * @returns {boolean}
 */
export function isNavOnlyText(text) {
  if (!text) return false;
  const plain = text.replace(/ /g, " ").trim();
  if (!plain) return false;

  // Must actually be about prev/next articles -- guards against a line of
  // pure punctuation being classified as "nav with everything removed".
  if (!/(?:前|次)の記事/.test(plain)) return false;

  const remainder = plain.replace(NAV_TOKEN, "").replace(NAV_SEPARATORS, "");
  return remainder.length === 0;
}

/** Strip HTML tags and decode the few entities richToHtml() introduces. */
export function htmlToPlain(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/**
 * True when a synced block node is an in-body navigation paragraph.
 * Only paragraphs qualify -- headings and list items that mention an
 * episode are content, not navigation.
 *
 * @param {{type: string, html?: string}} node
 */
export function isNavBlock(node) {
  if (!node || node.type !== "paragraph") return false;
  const plain = htmlToPlain(node.html);
  if (isNavOnlyText(plain)) return true;
  return isContinuationNav(plain, linksFromHtml(node.html));
}

// Some articles close with a "continue reading" link instead of the
// prev/next pair -- episode 0 ends with "続き、、、第一話、生まれて来る前の
// 話。" and the Devolution series with "この記事の続きはこちらになります。".
// Same duplication of the site's own next-article control, so same fate.
const CONTINUATION_LABEL = /^(?:続き|つづき)|続きは?こちら/;

/**
 * True when a block is nothing but a single link to another article whose
 * label reads as "continue reading".
 *
 * Being an actual article link is the load-bearing half of this test. The
 * author writes a bare "つづく。。。" as a closing line in his own voice,
 * with no link on it -- that is prose and stays. Only the linked form is
 * navigation.
 *
 * @param {string} text  plain text of the block
 * @param {string[]} hrefs  every href the block links to
 */
export function isContinuationNav(text, links) {
  const plain = (text ?? "").trim();
  if (!plain) return false;

  // Exactly one link, and it has to point at another article.
  if (!Array.isArray(links) || links.length !== 1) return false;
  const [link] = links;
  if (!ARTICLE_URL.test((link.href ?? "").trim())) return false;

  const label = (link.label ?? "").trim();
  if (!CONTINUATION_LABEL.test(label)) return false;

  // The block must BE the link, not a sentence containing one. Otherwise
  // "この件については[続きはこちら](url)を見てください。" would qualify.
  return plain.replace(label, "").replace(NAV_SEPARATORS, "").length === 0;
}

/** Every link (href + visible label) in a block's rendered HTML. */
export function linksFromHtml(html) {
  return [...(html ?? "").matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis)].map((m) => ({
    href: m[1].replace(/&amp;/g, "&"),
    label: htmlToPlain(m[2]),
  }));
}

/**
 * True when a block is a lone article URL -- the bare-link form the site
 * promotes to a link card.
 *
 * @param {{type: string, html?: string, url?: string}} node
 */
export function isBareArticleUrlBlock(node) {
  if (!node) return false;
  if (node.type === "bookmark" || node.type === "embed") {
    return ARTICLE_URL.test((node.url ?? "").trim());
  }
  if (node.type !== "paragraph") return false;
  return ARTICLE_URL.test(htmlToPlain(node.html).trim());
}

/**
 * Remove navigation paragraphs from a block tree, in place. A bare article
 * URL directly following a nav paragraph is removed with it, so the
 * "次の記事はこちらです。" + URL pairing does not leave a dangling card.
 *
 * @param {Array} blocks
 * @returns {number} how many blocks were removed
 */
export function stripNavBlocks(blocks) {
  let removed = 0;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (isNavBlock(b)) {
      let count = 1;
      // Look past blank paragraphs to the next block with substance.
      let j = i + 1;
      while (j < blocks.length && blocks[j].type === "paragraph" && !htmlToPlain(blocks[j].html).trim()) j++;
      if (j < blocks.length && isBareArticleUrlBlock(blocks[j])) count = j - i + 1;
      blocks.splice(i, count);
      removed += count;
      continue;
    }
    if (b.children?.length) removed += stripNavBlocks(b.children);
  }
  return removed;
}
