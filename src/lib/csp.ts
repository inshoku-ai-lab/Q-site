// The site's Content-Security-Policy, in one place.
//
// It is delivered two ways, because this site is a mix of statically
// prerendered pages and on-demand ones:
//
//   1. As a <meta http-equiv> tag in Layout.astro -- the only mechanism
//      that reaches CDN-served static pages, since the Vercel adapter
//      writes its own .vercel/output/config.json and Vercel therefore
//      ignores any `headers` block in vercel.json.
//   2. As a real response header in src/middleware.ts for on-demand
//      routes (/admin/*, /account, /api/*), which additionally carries
//      `frame-ancestors` -- a directive browsers ignore in <meta> form,
//      and exactly the one that matters for the admin pages.
//
// `'unsafe-inline'` is present for scripts because migrated article
// markup and several components still rely on inline `onload`/`onerror`
// handlers, which cannot be hashed or nonced. It still buys the main
// protection we're after: no script may be *loaded* from an origin that
// isn't listed here.

// Derived from the configured Supabase URL rather than hardcoded, so a
// project on a custom Supabase domain doesn't silently lose the ability
// to refresh its auth session under this policy.
function supabaseOrigin(): string | null {
  const raw = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

const TURNSTILE = "https://challenges.cloudflare.com";

function buildDirectives(): string[] {
  const supabase = supabaseOrigin();
  const connect = ["'self'", TURNSTILE];
  if (supabase) {
    connect.push(supabase, supabase.replace(/^https:/, "wss:"));
  } else {
    // No Supabase URL at build time (e.g. a preview build without env
    // vars): fall back to the managed-domain wildcard rather than
    // emitting a policy that would break login outright.
    connect.push("https://*.supabase.co", "wss://*.supabase.co");
  }

  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' is required by Pagefind, which runs the search
    // index as WebAssembly -- Chrome blocks WASM instantiation outright
    // under a script-src that doesn't allow it, which would break /search.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${TURNSTILE}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Article bodies embed cover art and OGP thumbnails from arbitrary
    // third-party sites, so external images can't be enumerated.
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    `connect-src ${connect.join(" ")}`,
    // Migrated posts embed YouTube/Vimeo players; Turnstile also frames.
    "frame-src https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
}

/** Policy for the <meta http-equiv> tag (no frame-ancestors: ignored there). */
export function metaCspValue(): string {
  return buildDirectives().join("; ");
}

/** Policy for the real response header, including frame-ancestors. */
export function headerCspValue(): string {
  return [...buildDirectives(), "frame-ancestors 'none'"].join("; ");
}
