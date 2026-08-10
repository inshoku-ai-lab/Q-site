import { defineMiddleware } from "astro:middleware";
import { headerCspValue } from "./lib/csp";

// Security headers for every on-demand response: the admin dashboard,
// the account page and the API routes. Statically prerendered pages are
// served straight off Vercel's CDN and never reach this middleware --
// they carry the <meta> CSP from Layout.astro instead (see lib/csp.ts).
//
// X-Frame-Options / frame-ancestors matter most precisely here: /admin/*
// renders member PII and has one-click state changes, so it must never be
// embeddable in a third-party page.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  try {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(name, value);
    }
    response.headers.set("Content-Security-Policy", headerCspValue());
  } catch {
    // Some responses (certain redirects / streamed bodies) expose
    // immutable headers. A missing header must never turn into a 500 on
    // a page that would otherwise have rendered fine.
  }

  return response;
});
