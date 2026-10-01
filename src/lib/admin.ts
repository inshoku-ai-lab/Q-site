import type { AstroCookies } from "astro";
import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";

type AdminAuth =
  | { ok: true; email: string; admin: ReturnType<typeof createSupabaseAdminClient> }
  | { ok: false; reason: "not_logged_in" | "not_admin" };

// admin_allowlist is service-role only (no RLS policies), so the check
// always goes through the admin client.
export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("admin_allowlist").select("email").eq("email", email).maybeSingle();
  return Boolean(data);
}

export async function requireAdmin(request: Request, cookies: AstroCookies): Promise<AdminAuth> {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { ok: false, reason: "not_logged_in" };

  if (!(await isAdminEmail(user.email))) return { ok: false, reason: "not_admin" };

  return { ok: true, email: user.email, admin: createSupabaseAdminClient() };
}

export async function logAdminAccess(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  adminEmail: string,
  action: string
) {
  await admin.from("admin_access_log").insert({ admin_email: adminEmail, action });
}
