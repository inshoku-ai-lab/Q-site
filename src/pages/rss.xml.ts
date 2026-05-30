import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts } from "../lib/posts";

export async function GET(context: APIContext) {
  const posts = getPublishedPosts().slice(0, 30);
  return rss({
    title: "Qryptraveller's Notes",
    description: "地球放浪20年以上の旅人による、旅と思索のアーカイブ。",
    site: context.site ?? "https://qryptraveller.com",
    items: posts.map((p) => ({
      title: p.title,
      pubDate: p.date ? new Date(p.date) : new Date(),
      description: p.excerpt,
      link: `/posts/${p.slug}/`,
      categories: p.category ? [p.category] : [],
    })),
    customData: `<language>ja</language>`,
  });
}
