import type { Block } from "./posts";
import { resolveInternalPost, domainOf, categoryAccentHex, formatDateShort } from "./posts";
import { getOgp } from "./ogp";

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

// Mirrors components/BlogCard.astro -- kept as a plain string builder since
// this module renders to a raw HTML string for the API route, not through
// Astro's component pipeline.
function renderBlogCard(url: string): string {
  const post = resolveInternalPost(url);
  if (post) {
    const accentHex = categoryAccentHex(post.category);
    const thumb = post.cover
      ? `<img src="${escapeAttr(post.cover)}" alt="" loading="lazy" class="w-28 md:w-36 aspect-[4/3] object-cover flex-shrink-0" />`
      : `<div class="w-28 md:w-36 aspect-[4/3] flex-shrink-0 flex items-center justify-center" style="background:linear-gradient(135deg, ${accentHex}38, ${accentHex}0d)">${
          post.category
            ? `<span class="text-[10px] uppercase tracking-widest font-medium text-center px-1" style="color:${accentHex}">${escapeHtml(post.category)}</span>`
            : ""
        }</div>`;
    return `<a href="/posts/${post.slug}/" class="my-6 flex gap-3.5 items-center no-underline group bg-paper-50 border border-paper-200 rounded-lg overflow-hidden card-hover">${thumb}<div class="py-3 pr-4 min-w-0"><div class="text-[10px] uppercase tracking-widest text-ink-muted mb-1">Qryptraveller's Notes</div><div class="font-serif text-sm md:text-base leading-snug text-ink group-hover:text-moss-dark line-clamp-2">${escapeHtml(post.title)}</div>${
      post.date ? `<div class="text-[11px] text-ink-muted font-mono mt-1">${escapeHtml(formatDateShort(post.date))}</div>` : ""
    }</div></a>`;
  }

  const ogp = getOgp(url);
  const externalIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></svg>`;

  if (ogp) {
    const thumb = ogp.image
      ? `<img src="${escapeAttr(ogp.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" class="w-28 md:w-36 aspect-[4/3] object-cover flex-shrink-0" onerror="this.style.display='none'" />`
      : `<div class="w-28 md:w-36 aspect-[4/3] flex-shrink-0 flex items-center justify-center bg-paper-200 text-ink-muted">${externalIcon}</div>`;
    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="my-6 flex gap-3.5 items-center no-underline group bg-paper-50 border border-paper-200 rounded-lg overflow-hidden card-hover">${thumb}<div class="py-3 pr-4 min-w-0"><div class="text-[10px] uppercase tracking-widest text-ink-muted mb-1">${escapeHtml(ogp.siteName || domainOf(url))}</div><div class="font-serif text-sm md:text-base leading-snug text-ink group-hover:text-moss-dark line-clamp-2">${escapeHtml(ogp.title || domainOf(url))}</div><div class="text-[11px] text-ink-muted truncate mt-1">${escapeHtml(domainOf(url))}</div></div></a>`;
  }

  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="my-6 flex items-center gap-3 no-underline group bg-paper-50 border border-paper-200 rounded-lg px-4 py-3.5 card-hover"><span class="w-8 h-8 rounded-full border border-paper-300 flex items-center justify-center flex-shrink-0 text-ink-muted group-hover:border-moss group-hover:text-moss transition-colors">${externalIcon}</span><div class="min-w-0"><div class="text-sm text-ink group-hover:text-moss-dark truncate">${escapeHtml(domainOf(url))}</div><div class="text-[11px] text-ink-muted truncate">${escapeAttr(url)}</div></div></a>`;
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
      case "blogcard":
      case "bookmark":
      case "embed":
        if (b.url) parts.push(renderBlogCard(b.url));
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
