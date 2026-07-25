export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { name: 100, email: 200, message: 5000 };

// Best-effort notification via Resend -- the submission is already saved in
// contact_messages regardless of whether this succeeds, so failures here are
// swallowed rather than surfaced to the visitor. Skips silently until
// RESEND_API_KEY and CONTACT_NOTIFY_EMAIL are configured in Vercel.
async function notifyByEmail(name: string, email: string, message: string) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const notifyEmail = import.meta.env.CONTACT_NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Qryptraveller's Notes <onboarding@resend.dev>",
        to: notifyEmail,
        reply_to: email,
        subject: `【お問い合わせ】${name}様より`,
        text: `お名前: ${name}\nメール: ${email}\n\n${message}`,
      }),
    });
  } catch {
    // Network/API failure -- nothing to do; message is already in the DB.
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400 });
  }
  if (name.length > MAX_LEN.name || email.length > MAX_LEN.email || message.length > MAX_LEN.message) {
    return new Response(JSON.stringify({ error: "too_long" }), { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("contact_messages").insert({ name, email, message });
  if (error) {
    return new Response(JSON.stringify({ error: "insert_failed" }), { status: 500 });
  }

  await notifyByEmail(name, email, message);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
