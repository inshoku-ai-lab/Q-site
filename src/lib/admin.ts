import type { AstroCookies } from "astro";
import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";

type AdminAuth = { ok: true; email: string; admin: ReturnType<typeof createSupabaseAdminClient> } | { ok: false };

export async function requireAdmin(request: Request, cookies: AstroCookies): Promise<AdminAuth> {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { ok: false };

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("admin_allowlist").select("email").eq("email", user.email).maybeSingle();
  if (!data) return { ok: false };

  return { ok: true, email: user.email, admin };
}

export async function logAdminAccess(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  adminEmail: string,
  action: string
) {
  await admin.from("admin_access_log").insert({ admin_email: adminEmail, action });
}
