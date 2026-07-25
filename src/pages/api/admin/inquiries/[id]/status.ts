export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../../../lib/admin";

const VALID_STATUSES = new Set(["new", "read", "replied"]);

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const { status } = await request.json();
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return new Response(JSON.stringify({ error: "invalid_status" }), { status: 400 });
  }

  const { error } = await auth.admin.from("contact_messages").update({ status }).eq("id", params.id);
  if (error) {
    return new Response(JSON.stringify({ error: "update_failed" }), { status: 500 });
  }

  await logAdminAccess(auth.admin, auth.email, `update_inquiry_status:${params.id}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
