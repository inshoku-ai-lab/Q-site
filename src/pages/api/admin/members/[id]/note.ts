export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../../../lib/admin";
import { forbiddenResponse, isJsonRequest, isSameOrigin, jsonResponse } from "../../../../../lib/http";

const MAX_NOTE_LEN = 5000;

export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!isSameOrigin(request) || !isJsonRequest(request)) {
    return forbiddenResponse();
  }

  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return forbiddenResponse();
  }

  let note: unknown;
  try {
    ({ note } = await request.json());
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  if (typeof note !== "string") {
    return jsonResponse({ error: "invalid_note" }, 400);
  }
  if (note.length > MAX_NOTE_LEN) {
    return jsonResponse({ error: "too_long" }, 400);
  }

  const { error } = await auth.admin.from("members").update({ admin_note: note }).eq("id", params.id);
  if (error) {
    return jsonResponse({ error: "update_failed" }, 500);
  }

  await logAdminAccess(auth.admin, auth.email, `update_note:${params.id}`);

  return jsonResponse({ ok: true }, 200);
};
