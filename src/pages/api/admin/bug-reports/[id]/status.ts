export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../../../lib/admin";

const VALID_STATUSES = new Set(["new", "fixed", "needs_review", "wontfix"]);

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const { status, resolutionNote } = await request.json();
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return new Response(JSON.stringify({ error: "invalid_status" }), { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (typeof resolutionNote === "string") update.resolution_note = resolutionNote;

  const { error } = await auth.admin.from("bug_reports").update(update).eq("id", params.id);
  if (error) {
    return new Response(JSON.stringify({ error: "update_failed" }), { status: 500 });
  }

  await logAdminAccess(auth.admin, auth.email, `update_bug_report_status:${params.id}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
