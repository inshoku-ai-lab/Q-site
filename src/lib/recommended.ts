import { createSupabaseAdminClient } from "./supabase/admin";
import { getPublishedPostBySlug, formatDateShort } from "./posts";

// Articles the owner picks in /admin/recommended for the "おすすめの記事"
// lists. Stored in Supabase (recommended_posts, service-role only) so a
// change shows up without rebuilding the site.
export const MAX_RECOMMENDED = 12;

export type RecommendedItem = { slug: string; title: string; date: string; category: string | null };

export async function getRecommendedSlugs(
  admin: ReturnType<typeof createSupabaseAdminClient> = createSupabaseAdminClient(),
): Promise<string[]> {
  const { data, error } = await admin.from("recommended_posts").select("slug, position").order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.slug as string);
}

// Slugs -> display rows, dropping anything no longer published.
export function toRecommendedItems(slugs: string[]): RecommendedItem[] {
  const items: RecommendedItem[] = [];
  for (const slug of slugs) {
    const post = getPublishedPostBySlug(slug);
    if (!post) continue;
    items.push({ slug: post.slug, title: post.title, date: formatDateShort(post.date), category: post.category });
  }
  return items;
}
