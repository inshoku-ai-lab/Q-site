export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../lib/admin";
import { forbiddenResponse, isJsonRequest, isSameOrigin, jsonResponse } from "../../../lib/http";
import { getPublishedPostBySlug } from "../../../lib/posts";
import { MAX_RECOMMENDED } from "../../../lib/recommended";

// Replaces the whole おすすめ list with the given slugs, in order.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOrigin(request) || !isJsonRequest(request)) {
    return forbiddenResponse();
  }

  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return forbiddenResponse();
  }

  let slugs: unknown;
  try {
    ({ slugs } = await request.json());
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  if (!Array.isArray(slugs) || !slugs.every((s) => typeof s === "string")) {
    return jsonResponse({ error: "invalid_slugs" }, 400);
  }

  const unique = [...new Set(slugs as string[])];
  if (unique.length > MAX_RECOMMENDED) {
    return jsonResponse({ error: "too_many" }, 400);
  }
  if (unique.some((s) => !getPublishedPostBySlug(s))) {
    return jsonResponse({ error: "unknown_post" }, 400);
  }

  const { error: deleteError } = await auth.admin.from("recommended_posts").delete().neq("slug", "");
  if (deleteError) {
    return jsonResponse({ error: "save_failed" }, 500);
  }
  if (unique.length > 0) {
    const rows = unique.map((slug, position) => ({ slug, position }));
    const { error: insertError } = await auth.admin.from("recommended_posts").insert(rows);
    if (insertError) {
      return jsonResponse({ error: "save_failed" }, 500);
    }
  }

  await logAdminAccess(auth.admin, auth.email, `update_recommended:${unique.length}`);

  return jsonResponse({ ok: true }, 200);
};
