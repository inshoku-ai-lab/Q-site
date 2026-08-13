// Shared request-hardening helpers for the API routes.
//
// Every endpoint under src/pages/api/ that reads a client IP, mutates
// state, or redirects somewhere the client asked for goes through this
// module, so the rules live in exactly one place.

// `x-forwarded-for` is a client-supplied header: anything already in it
// when the request reaches Vercel was written by the caller, and Vercel
// appends rather than replaces, so its *first* entry is attacker
// controlled. `x-vercel-forwarded-for` and `x-real-ip` are both set by
// Vercel's edge from the real socket peer and cannot be spoofed -- prefer
// those, and fall back to the LAST `x-forwarded-for` entry (the one the
// closest trusted proxy appended) rather than the first.
export function getClientIp(request: Request): string | null {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) return firstEntry(vercelForwarded);

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  const parts = forwardedFor.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

function firstEntry(value: string): string | null {
  return value.split(",")[0].trim() || null;
}

// An IP goes straight into an Airtable filterByFormula string literal, so
// reject anything that isn't plausibly an IPv4/IPv6 address before it can
// break out of the quotes it's interpolated into.
export function isPlainIp(ip: string): boolean {
  return /^[0-9a-fA-F.:]{3,45}$/.test(ip);
}

// CSRF defence for cookie-authenticated state changes. Browsers always
// attach `Origin` to a cross-origin POST (and to same-origin POSTs in
// every browser we support), so an Origin that doesn't match this site is
// a forged request. `Referer` is the fallback for the rare client that
// omits Origin; a request with neither is not a browser form/fetch and is
// rejected.
//
// Deliberately does NOT compare against `new URL(request.url).origin`:
// behind Vercel's proxy, the scheme/host Astro sees on the internal
// request can differ from the public host the browser actually connected
// to (this broke every POST endpoint in production -- Turnstile would
// verify client-side, then the very first line of the handler 403'd the
// request before ever looking at the token). `Host` / `X-Forwarded-Host`
// reflects what the browser dialed regardless of internal routing, so
// comparing the Origin/Referer's *host* against that is the proxy-safe
// version of the same check.
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return false;
}

// A cross-site HTML form can only send a small set of Content-Types, none
// of which is application/json -- so requiring JSON is a second, cheap
// barrier against form-based CSRF on top of the Origin check above.
export function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.split(";")[0].trim().toLowerCase() === "application/json";
}

export function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function forbiddenResponse(): Response {
  return jsonResponse({ error: "forbidden" }, 403);
}

// Post-login redirect targets come from a query param and a cookie, both
// fully attacker-controlled -- a raw redirect to them turns our OAuth
// callback into an open redirect that lends this domain's credibility to
// a phishing page. Only same-site absolute paths are allowed through:
// must start with a single "/" (so "//evil.com" and "https://evil.com"
// are rejected) and must not smuggle in a scheme or a backslash-based
// path separator that some browsers normalise to "/".
export function safeRedirectPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;

  let candidate = raw.trim();
  if (!candidate) return fallback;

  // A value round-tripped through a cookie is percent-encoded; decoding a
  // malformed value throws, which must not take the whole callback down.
  if (candidate.includes("%")) {
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      return fallback;
    }
  }

  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\")) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(candidate)) return fallback;

  return candidate;
}

// Only ever emit http(s) links/embeds from migrated content. Article HTML
// is built by our own sync script (which escapes all text), but the URLs
// inside it come from years of WordPress content, so a `javascript:` or
// `data:` URL surviving migration would otherwise be rendered as a live
// href/iframe src.
export function isSafeHttpUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
