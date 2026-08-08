export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../lib/admin";

const FIELDS = ["dealer_fee_pct", "fx_fee_pct", "consumption_tax_pct", "gs_fee_pct"] as const;

function isValidPct(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400 });
  }

  const update: Record<string, number> = {};
  for (const field of FIELDS) {
    const value = (body as Record<string, unknown>)[field];
    if (!isValidPct(value)) {
      return new Response(JSON.stringify({ error: "invalid_value", field }), { status: 400 });
    }
    update[field] = value;
  }

  const { error } = await auth.admin
    .from("silver_price_settings")
    .update({ ...update, updated_at: new Date().toISOString(), updated_by: auth.email })
    .eq("id", 1);
  if (error) {
    return new Response(JSON.stringify({ error: "update_failed" }), { status: 500 });
  }

  await logAdminAccess(auth.admin, auth.email, "update_silver_price_settings");

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
