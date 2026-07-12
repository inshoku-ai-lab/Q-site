export const prerender = false;

import type { APIRoute } from "astro";
import { requireAdmin, logAdminAccess } from "../../../lib/admin";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const auth = await requireAdmin(request, cookies);
  if (!auth.ok) {
    return new Response("Forbidden", { status: 403 });
  }
  await logAdminAccess(auth.admin, auth.email, "export_csv");

  const providerFilter = url.searchParams.get("provider") ?? "";
  const reasonFilter = url.searchParams.get("reason") ?? "";
  const fromFilter = url.searchParams.get("from") ?? "";
  const toFilter = url.searchParams.get("to") ?? "";

  let query = auth.admin
    .from("members")
    .select("email, display_name, provider, agreement_reason, joined_at, referrer_article_slug, first_read_article_slug")
    .order("joined_at", { ascending: false });

  if (providerFilter) query = query.eq("provider", providerFilter);
  if (reasonFilter) query = query.eq("agreement_reason", reasonFilter);
  if (fromFilter) query = query.gte("joined_at", fromFilter);
  if (toFilter) query = query.lte("joined_at", toFilter);

  const { data, error } = await query;
  if (error) {
    return new Response("Failed to fetch members", { status: 500 });
  }

  const header = ["email", "display_name", "provider", "agreement_reason", "joined_at", "referrer_article_slug", "first_read_article_slug"];
  const rows = (data ?? []).map((m) =>
    [m.email, m.display_name, m.provider, m.agreement_reason, m.joined_at, m.referrer_article_slug, m.first_read_article_slug]
      .map(csvEscape)
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
