export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../../../lib/admin";

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const { note } = await request.json();
  if (typeof note !== "string") {
    return new Response(JSON.stringify({ error: "invalid_note" }), { status: 400 });
  }

  const { error } = await auth.admin.from("members").update({ admin_note: note }).eq("id", params.id);
  if (error) {
    return new Response(JSON.stringify({ error: "update_failed" }), { status: 500 });
  }

  await logAdminAccess(auth.admin, auth.email, `update_note:${params.id}`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
