export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../../../lib/admin";
import { forbiddenResponse, isJsonRequest, isSameOrigin, jsonResponse } from "../../../../../lib/http";

const VALID_STATUSES = new Set(["new", "read", "replied"]);

export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!isSameOrigin(request) || !isJsonRequest(request)) {
    return forbiddenResponse();
  }

  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return forbiddenResponse();
  }

  let status: unknown;
  try {
    ({ status } = await request.json());
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return jsonResponse({ error: "invalid_status" }, 400);
  }

  const { error } = await auth.admin.from("contact_messages").update({ status }).eq("id", params.id);
  if (error) {
    return jsonResponse({ error: "update_failed" }, 500);
  }

  await logAdminAccess(auth.admin, auth.email, `update_inquiry_status:${params.id}`);

  return jsonResponse({ ok: true }, 200);
};
