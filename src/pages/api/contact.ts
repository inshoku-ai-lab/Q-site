export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { getClientIp, isJsonRequest, isSameOrigin, jsonResponse } from "../../lib/http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { name: 100, email: 200, message: 5000 };
const MIN_FILL_TIME_MS = 2000;
const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 3;

// Enforcement depends on how Turnstile is configured:
//   - no site key and no secret  -> Turnstile isn't set up at all; the
//     honeypot, the fill-time check and the IP rate limit carry the form.
//   - site key set (widget renders) -> the secret MUST be present, and a
//     token MUST verify. Anything else is a misconfiguration that would
//     otherwise silently downgrade the form to no bot protection.
async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY;
  const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;

  if (!secret) {
    if (siteKey) {
      console.error("contact turnstile: PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is not -- rejecting");
      return false;
    }
    return true;
  }
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip) params.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await res.json();
    if (!data.success) {
      console.error("contact turnstile: verification failed", data["error-codes"]);
    }
    return data.success === true;
  } catch (err) {
    console.error("contact turnstile: verification request failed", err);
    return false;
  }
}

// Best-effort notification via Resend -- the submission is already saved in
// contact_messages regardless of whether this succeeds, so failures here
// never fail the request. They ARE logged (visible in Vercel's function
// logs) so a silent delivery gap is diagnosable instead of invisible.
async function notifyByEmail(name: string, email: string, message: string) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const notifyEmail = import.meta.env.CONTACT_NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) {
    console.error("contact notify: RESEND_API_KEY or CONTACT_NOTIFY_EMAIL is not set");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Qryptraveller's Notes <contact@qryptraveller.com>",
        to: notifyEmail,
        reply_to: email,
        subject: `【お問い合わせ】${name}様より`,
        text: `お名前: ${name}\nメール: ${email}\n\n${message}`,
      }),
    });
    if (!res.ok) {
      console.error(`contact notify: Resend API returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("contact notify: failed to reach Resend API", err);
  }
}

export const POST: APIRoute = async ({ request }) => {
  // Cross-site form posts can't set Content-Type: application/json, and a
  // browser always labels a cross-origin fetch with an Origin header --
  // together these keep this endpoint reachable only from our own pages.
  if (!isSameOrigin(request) || !isJsonRequest(request)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  // Honeypot: legitimate users never fill this hidden field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return jsonResponse({ ok: true }, 200);
  }

  // Bots that fetch the page and POST immediately submit faster than any
  // human can fill a 3-field form. Report success without saving anything,
  // so scripted submitters get no signal that they were filtered.
  const elapsedMs = typeof body.elapsedMs === "number" ? body.elapsedMs : 0;
  if (elapsedMs < MIN_FILL_TIME_MS) {
    return jsonResponse({ ok: true }, 200);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid_email" }, 400);
  }
  if (name.length > MAX_LEN.name || email.length > MAX_LEN.email || message.length > MAX_LEN.message) {
    return jsonResponse({ error: "too_long" }, 400);
  }

  const ip = getClientIp(request);
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return jsonResponse({ error: "verification_failed" }, 400);
  }

  const admin = createSupabaseAdminClient();

  if (ip) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
    const { count } = await admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }
  }

  const { error } = await admin.from("contact_messages").insert({ name, email, message, ip_address: ip });
  if (error) {
    return jsonResponse({ error: "insert_failed" }, 500);
  }

  await notifyByEmail(name, email, message);

  return jsonResponse({ ok: true }, 200);
};
