export const prerender = false;

import type { APIRoute } from "astro";
import { getClientIp, isJsonRequest, isPlainIp, isSameOrigin, jsonResponse } from "../../lib/http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { description: 3000, email: 200, url: 2000, ua: 500, str: 100 };
const MIN_FILL_TIME_MS = 1500;
const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 5;

// Not a secret -- Airtable base/table IDs are only usable together with the
// bearer token below, which is what's actually sensitive.
const AIRTABLE_BASE_ID = "appV3kF3rErRTXyrw";
const AIRTABLE_TABLE_ID = "tblIXgykIKXu2t0Xc";
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

function str(v: unknown, maxLen: number): string {
  return typeof v === "string" ? v.trim().slice(0, maxLen) : "";
}

function int(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

// Unlike the contact form there is no Postgres table to count against, so
// the rate limit is enforced by asking Airtable how many reports this IP
// already filed inside the window. Without it, a script could POST every
// 1.5s and each accepted report fans out into an Airtable write *and* a
// notification email.
//
// Fails open (returns false = "not limited") if Airtable can't be reached:
// losing a genuine bug report is worse than letting a flood through a
// window where our storage backend is already degraded.
async function isRateLimited(ip: string, apiKey: string): Promise<boolean> {
  if (!isPlainIp(ip)) return false;

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();
  const formula = `AND({IP Address}='${ip}', IS_AFTER({Created At}, '${since}'))`;
  const url = `${AIRTABLE_URL}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=${RATE_LIMIT_MAX}&fields%5B%5D=${encodeURIComponent("IP Address")}`;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) {
      console.error(`bug-report rate limit: Airtable API returned ${res.status}`);
      return false;
    }
    const data = (await res.json()) as { records?: unknown[] };
    return (data.records?.length ?? 0) >= RATE_LIMIT_MAX;
  } catch (err) {
    console.error("bug-report rate limit: failed to reach Airtable API", err);
    return false;
  }
}

async function saveToAirtable(fields: Record<string, unknown>, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(AIRTABLE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      console.error(`bug-report: Airtable API returned ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("bug-report: failed to reach Airtable API", err);
    return false;
  }
}

// Best-effort notification via Resend -- failures are logged (visible in
// Vercel's function logs), not surfaced to the reporter, since the report
// is already saved in Airtable regardless of whether this succeeds.
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
  if (!isSameOrigin(request) || !isJsonRequest(request)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const apiKey = import.meta.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    console.error("bug-report: AIRTABLE_API_KEY is not set");
    return jsonResponse({ error: "insert_failed" }, 500);
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
  // human can write a bug description. Report success without saving
  // anything, so scripted submitters get no signal that they were filtered.
  const elapsedMs = typeof body.elapsedMs === "number" ? body.elapsedMs : 0;
  if (elapsedMs < MIN_FILL_TIME_MS) {
    return jsonResponse({ ok: true }, 200);
  }

  const description = str(body.description, MAX_LEN.description);
  const email = str(body.email, MAX_LEN.email);
  if (!description) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }
  if (email && !EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid_email" }, 400);
  }

  const pageUrl = str(body.pageUrl, MAX_LEN.url);
  const deviceType = str(body.deviceType, MAX_LEN.str);
  const browser = str(body.browser, MAX_LEN.str);
  const os = str(body.os, MAX_LEN.str);
  const userAgent = str(body.userAgent, MAX_LEN.ua);
  const viewportWidth = int(body.viewportWidth);
  const viewportHeight = int(body.viewportHeight);
  const ip = getClientIp(request);

  if (ip && (await isRateLimited(ip, apiKey))) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  const fields: Record<string, unknown> = {
    Description: description,
    Status: "new",
    "Created At": new Date().toISOString(),
  };
  if (email) fields.Email = email;
  if (pageUrl) fields["Page URL"] = pageUrl;
  if (deviceType === "mobile" || deviceType === "tablet" || deviceType === "desktop") fields["Device Type"] = deviceType;
  if (browser) fields.Browser = browser;
  if (os) fields.OS = os;
  if (userAgent) fields["User Agent"] = userAgent;
  if (viewportWidth !== null) fields["Viewport Width"] = viewportWidth;
  if (viewportHeight !== null) fields["Viewport Height"] = viewportHeight;
  if (ip) fields["IP Address"] = ip;

  const saved = await saveToAirtable(fields, apiKey);
  if (!saved) {
    return jsonResponse({ error: "insert_failed" }, 500);
  }

  await notifyByEmail(description, pageUrl || "(不明)", `${deviceType} / ${browser} / ${os}`);

  return jsonResponse({ ok: true }, 200);
};
