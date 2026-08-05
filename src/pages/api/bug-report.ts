export const prerender = false;

import type { APIRoute } from "astro";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { description: 3000, email: 200, url: 2000, ua: 500, str: 100 };
const MIN_FILL_TIME_MS = 1500;

// Not a secret -- Airtable base/table IDs are only usable together with the
// bearer token below, which is what's actually sensitive.
const AIRTABLE_BASE_ID = "appV3kF3rErRTXyrw";
const AIRTABLE_TABLE_ID = "tblIXgykIKXu2t0Xc";

function str(v: unknown, maxLen: number): string {
  return typeof v === "string" ? v.trim().slice(0, maxLen) : "";
}

function int(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

async function saveToAirtable(fields: Record<string, unknown>): Promise<boolean> {
  const apiKey = import.meta.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    console.error("bug-report: AIRTABLE_API_KEY is not set");
    return false;
  }

  try {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
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
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() || null : null;

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

  const saved = await saveToAirtable(fields);
  if (!saved) {
    return new Response(JSON.stringify({ error: "insert_failed" }), { status: 500 });
  }

  await notifyByEmail(description, pageUrl || "(不明)", `${deviceType} / ${browser} / ${os}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
