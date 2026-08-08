export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { name: 100, email: 200, message: 5000 };
const MIN_FILL_TIME_MS = 2000;
const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 3;

// Which form this submission came from -- shared mechanism, see
// src/components/ContactForm.astro. Unrecognized values fall back to
// "general" rather than rejecting the request.
const SOURCES = new Set(["general", "silver"]);
const SOURCE_SUBJECTS: Record<string, string> = {
  general: "【お問い合わせ】",
  silver: "【銀のご購入お問い合わせ】",
};

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  return forwardedFor.split(",")[0].trim() || null;
}

// Skips (returns true) until TURNSTILE_SECRET_KEY is configured in Vercel,
// so the form works before Turnstile is set up and starts enforcing it the
// moment both the site key (client) and secret key (server) are present.
async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = import.meta.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
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
async function notifyByEmail(name: string, email: string, message: string, source: string) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const notifyEmail = import.meta.env.CONTACT_NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) {
    console.error("contact notify: RESEND_API_KEY or CONTACT_NOTIFY_EMAIL is not set");
    return;
  }

  const subjectPrefix = SOURCE_SUBJECTS[source] ?? SOURCE_SUBJECTS.general;
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
        subject: `${subjectPrefix}${name}様より`,
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
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400 });
  }

  // Honeypot: legitimate users never fill this hidden field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Bots that fetch the page and POST immediately submit faster than any
  // human can fill a 3-field form. Report success without saving anything,
  // so scripted submitters get no signal that they were filtered.
  const elapsedMs = typeof body.elapsedMs === "number" ? body.elapsedMs : 0;
  if (elapsedMs < MIN_FILL_TIME_MS) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const source = typeof body.source === "string" && SOURCES.has(body.source) ? body.source : "general";

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400 });
  }
  if (name.length > MAX_LEN.name || email.length > MAX_LEN.email || message.length > MAX_LEN.message) {
    return new Response(JSON.stringify({ error: "too_long" }), { status: 400 });
  }

  const ip = getClientIp(request);
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return new Response(JSON.stringify({ error: "verification_failed" }), { status: 400 });
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
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    }
  }

  const { error } = await admin.from("contact_messages").insert({ name, email, message, ip_address: ip, source });
  if (error) {
    return new Response(JSON.stringify({ error: "insert_failed" }), { status: 500 });
  }

  await notifyByEmail(name, email, message, source);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
