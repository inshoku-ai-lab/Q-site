export const prerender = false;

import type { APIRoute } from "astro";
import { getRecommendedSlugs, toRecommendedItems } from "../../lib/recommended";
import { jsonResponse } from "../../lib/http";

// Public list behind the "おすすめの記事" sidebars on the (static) pages.
// Cached at Vercel's edge for a minute, so a change in /admin/recommended
// shows up within about a minute and Supabase sees at most one read a
// minute however busy the site is.
export const GET: APIRoute = async () => {
  try {
    const items = toRecommendedItems(await getRecommendedSlugs());
    return jsonResponse({ items }, 200, {
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
    });
  } catch (err) {
    console.error("recommended: failed to load", err);
    return jsonResponse({ items: [] }, 500, { "Cache-Control": "no-store" });
  }
};
