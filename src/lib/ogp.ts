import ogpCacheData from "../data/ogp-cache.json";

export type OgpEntry = {
  title?: string | null;
  image?: string | null;
  siteName?: string | null;
  failed?: boolean;
};

const ogpCache = ogpCacheData as unknown as Record<string, OgpEntry>;

// Looks up pre-fetched OGP metadata (title/image) for an external URL --
// see scripts/fetch-ogp.mjs, which populates src/data/ogp-cache.json as
// part of the build. Returns null if we have no usable metadata for this
// URL (never fetched yet, or the fetch failed), so callers can fall back
// to a plain domain-name card.
export function getOgp(url: string): OgpEntry | null {
  const entry = ogpCache[url];
  if (!entry || entry.failed || (!entry.title && !entry.image)) return null;
  return entry;
}
