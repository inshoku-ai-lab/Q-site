export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { description: 3000, email: 200, url: 2000, ua: 500, str: 100 };
const MIN_FILL_TIME_MS = 1500;
const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 5;

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  return forwardedFor.split(",")[0].trim() || null;
}

function str(v: unknown, maxLen: number): string {
  return typeof v === "string" ? v.trim().slice(0, maxLen) : "";
}

function int(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

// Best-effort notification via Resend -- the report is already saved in
// bug_reports regardless of whether this succeeds. Failures are logged
// (visible in Vercel's function logs), not surfaced to the reporter.
async function notifyByEmail(description: string, pageUrl: string, env: string) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const notifyEmail = import.meta.env.CONTACT_NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) {
    console.error("bug-report notify: RESEND_API_KEY or CONTACT_NOTIFY_EMAIL is not set");
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
        subject: "【バグ報告】新しい報告が届きました",
        text: `${description}\n\nページ: ${pageUrl}\n環境: ${env}`,
      }),
    });
    if (!res.ok) {
      console.error(`bug-report notify: Resend API returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("bug-report notify: failed to reach Resend API", err);
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
  // human can write a bug description. Report success without saving
  // anything, so scripted submitters get no signal that they were filtered.
  const elapsedMs = typeof body.elapsedMs === "number" ? body.elapsedMs : 0;
  if (elapsedMs < MIN_FILL_TIME_MS) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const description = str(body.description, MAX_LEN.description);
  const email = str(body.email, MAX_LEN.email);
  if (!description) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400 });
  }

  const pageUrl = str(body.pageUrl, MAX_LEN.url);
  const deviceType = str(body.deviceType, MAX_LEN.str);
  const browser = str(body.browser, MAX_LEN.str);
  const os = str(body.os, MAX_LEN.str);
  const userAgent = str(body.userAgent, MAX_LEN.ua);
  const viewportWidth = int(body.viewportWidth);
  const viewportHeight = int(body.viewportHeight);

  const ip = getClientIp(request);
  const admin = createSupabaseAdminClient();

  if (ip) {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
    const { count } = await admin
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    }
  }

  const { error } = await admin.from("bug_reports").insert({
    description,
    email: email || null,
    page_url: pageUrl || null,
    device_type: deviceType || null,
    browser: browser || null,
    os: os || null,
    user_agent: userAgent || null,
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    ip_address: ip,
  });
  if (error) {
    return new Response(JSON.stringify({ error: "insert_failed" }), { status: 500 });
  }

  await notifyByEmail(description, pageUrl || "(不明)", `${deviceType} / ${browser} / ${os}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
