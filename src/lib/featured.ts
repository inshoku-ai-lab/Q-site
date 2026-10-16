import { createSupabaseAdminClient } from "./supabase/admin";
import { getPublishedPostBySlug } from "./posts";
import type { Post } from "./posts";

// The three 特集 slots (壱・弐・参) on the top page. The owner picks them
// in /admin/featured; until something is saved (or if Supabase can't be
// reached) these defaults are used.
export const FEATURED_SLOTS = 3;

export const DEFAULT_FEATURED_SLUGS = [
  "devolution-theory-an-introduction",
  "satanic-ritual-survivor-turned-genius-trauma-therapist-teal-swans-story",
  "the-inventor-of-bitcoin-is-dr-craig-wright-17-mathematical-proofs-alpha",
];

export async function getFeaturedSlugs(
  admin: ReturnType<typeof createSupabaseAdminClient> = createSupabaseAdminClient(),
): Promise<string[]> {
  const { data, error } = await admin.from("featured_posts").select("slug, position").order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.slug as string);
}

// Saved picks (when there are any) resolved to published posts; otherwise
// the defaults. Never throws: the top page must render without Supabase.
export async function resolveFeaturedPosts(): Promise<Post[]> {
  let slugs: string[] = [];
  try {
    slugs = await getFeaturedSlugs();
  } catch (err) {
    console.error("featured: failed to load, using defaults", err);
  }
  const pick = (list: string[]) =>
    list.map((s) => getPublishedPostBySlug(s)).filter((p): p is Post => Boolean(p)).slice(0, FEATURED_SLOTS);
  const saved = pick(slugs);
  return saved.length > 0 ? saved : pick(DEFAULT_FEATURED_SLUGS);
}
