import dimensionCache from "../data/image-dimensions.json";

const cache = dimensionCache as unknown as Record<string, { width: number; height: number }>;

// Populated by scripts/optimize-images.mjs, keyed by the exact same
// `/images/...` path every component already uses for `src`. Explicit
// width/height lets the browser reserve the image's box before it loads
// -- without them the page reflows every time an image finishes
// fetching. Only covers the locally-hosted (migrated) image set; a miss
// just means no attributes are emitted, same as before this existed.
export function getImageDimensions(src: string): { width: number; height: number } | null {
  return cache[src] ?? null;
}
