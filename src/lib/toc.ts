import type { Block } from "./posts";

export type TocEntry = { id: string; text: string; level: 2 | 3 };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

export function slugifyHeading(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base ? `${base}-${index}` : `section-${index}`;
}

// Must visit blocks in the same order, counting only heading blocks, as
// components/ArticleBody.astro does when assigning heading ids -- this is
// what keeps the two in sync without passing an id map between them.
export function extractToc(blocks: Block[]): TocEntry[] {
  const toc: TocEntry[] = [];
  let index = 0;
  for (const b of blocks) {
    if (b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3") {
      const text = stripHtml(b.html ?? "");
      index++;
      if (!text) continue;
      const level = b.type === "heading_3" ? 3 : 2;
      toc.push({ id: slugifyHeading(text, index - 1), text, level });
    }
  }
  return toc;
}

// Headings that already carry their own numbering ("１、…", "第2章", "3.")
// skip the automatic kanji numeral the article styles prepend to h2.
const OWN_NUMBER_RE = /^\s*(?:<[^>]+>\s*)*(?:[0-9０-９①-⑳㈠-㈩一二三四五六七八九十]+\s*[、。.．:：)）]|第\s*[0-9０-９一二三四五六七八九十百]+|[（(]\s*[0-9０-９一二三四五六七八九十]+\s*[)）])/;

export function headingHasOwnNumber(html: string | undefined): boolean {
  return OWN_NUMBER_RE.test(html ?? "");
}
