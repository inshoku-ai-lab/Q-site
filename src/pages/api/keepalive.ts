export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { jsonResponse } from "../../lib/http";

// Supabase pauses a free-plan project after a week with no activity, and
// a paused project takes the 旅路の証人 login and the admin pages down
// with it. Vercel Cron calls this once a day (see
// scripts/add-vercel-crons.mjs) and it runs one trivial query, which is
// enough to count as activity.
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` with cron requests
// when CRON_SECRET is set; with it set, nobody else can trigger this.
export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET ?? process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("admin_allowlist").select("id", { count: "exact", head: true });
  if (error) {
    console.error("keepalive: supabase query failed", error.message);
    return jsonResponse({ ok: false }, 500, { "Cache-Control": "no-store" });
  }
  return jsonResponse({ ok: true }, 200, { "Cache-Control": "no-store" });
};
