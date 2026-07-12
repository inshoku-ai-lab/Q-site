import type { Block } from "./posts";

// Server-side mirror of components/ArticleBody.astro's block rendering,
// used to render the member-only tail of an article as an HTML string for
// the member-content API route (an .astro component can't be invoked
// directly from a plain API route).
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Group = { type: "ul" | "ol" | "single"; items: Block[] };

function groupBlocks(blocks: Block[]): Group[] {
  const out: Group[] = [];
  for (const b of blocks) {
    if (b.type === "bulleted_list_item") {
      const last = out[out.length - 1];
      if (last?.type === "ul") last.items.push(b);
      else out.push({ type: "ul", items: [b] });
    } else if (b.type === "numbered_list_item") {
      const last = out[out.length - 1];
      if (last?.type === "ol") last.items.push(b);
      else out.push({ type: "ol", items: [b] });
    } else {
      out.push({ type: "single", items: [b] });
    }
  }
  return out;
}

export function renderBlocksToHtml(blocks: Block[]): string {
  const parts: string[] = [];

  for (const g of groupBlocks(blocks)) {
    if (g.type === "ul") {
      parts.push(`<ul>${g.items.map((b) => `<li>${b.html ?? ""}</li>`).join("")}</ul>`);
      continue;
    }
    if (g.type === "ol") {
      parts.push(`<ol>${g.items.map((b) => `<li>${b.html ?? ""}</li>`).join("")}</ol>`);
      continue;
    }

    const b = g.items[0];
    switch (b.type) {
      case "paragraph":
        if (b.html?.trim()) parts.push(`<p>${b.html}</p>`);
        break;
      case "heading_1":
      case "heading_2":
        parts.push(`<h2>${b.html ?? ""}</h2>`);
        break;
      case "heading_3":
        parts.push(`<h3>${b.html ?? ""}</h3>`);
        break;
      case "quote":
        parts.push(`<blockquote>${b.html ?? ""}</blockquote>`);
        break;
      case "callout":
        parts.push(
          `<div class="my-6 p-4 rounded-md bg-earth/10 border-l-4 border-earth"><div>${b.html ?? ""}</div></div>`
        );
        break;
      case "code":
        parts.push(
          `<pre><code class="language-${b.language ?? "plain text"}">${escapeHtml(b.code ?? "")}</code></pre>`
        );
        break;
      case "divider":
        parts.push("<hr />");
        break;
      case "image":
        if (b.src) {
          const alt = escapeAttr((b.caption ?? "").replace(/<[^>]+>/g, ""));
          const caption = b.caption
            ? `<figcaption class="text-xs text-ink-muted text-center mt-2">${b.caption}</figcaption>`
            : "";
          parts.push(
            `<figure class="my-8"><img src="${escapeAttr(b.src)}" alt="${alt}" loading="lazy" />${caption}</figure>`
          );
        }
        break;
      case "bookmark":
      case "embed":
        if (b.url) {
          parts.push(
            `<div class="my-6"><a href="${escapeAttr(b.url)}" target="_blank" rel="noopener" class="block p-4 bg-paper-50 border border-paper-300 rounded-md text-sm break-all hover:bg-paper-200">${escapeAttr(b.url)}</a></div>`
          );
        }
        break;
      case "video":
        if (b.url) {
          parts.push(
            `<div class="my-6 aspect-video"><iframe src="${escapeAttr(b.url)}" class="w-full h-full rounded-md" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`
          );
        }
        break;
      default:
        if (b.html) parts.push(`<p>${b.html}</p>`);
    }
  }

  return parts.join("\n");
}
