import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";
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

// Admin sign-in is Google only, but members can also sign in with Facebook
// or LINE, and an account carries whatever address its provider reports.
// So the allowlist is only consulted for an account that has a Google
// identity for that same address which Google itself marked verified --
// otherwise another provider's account bearing the owner's address would
// pass. If admin sign-in ever moves to another provider, extend this check
// rather than dropping it.
export function hasVerifiedGoogleEmail(user: User): boolean {
  const email = user.email?.toLowerCase();
  if (!email) return false;
  return (user.identities ?? []).some(
    (identity) =>
      identity.provider === "google" &&
      String(identity.identity_data?.email ?? "").toLowerCase() === email &&
      identity.identity_data?.email_verified === true
  );
}

export async function requireAdmin(request: Request, cookies: AstroCookies): Promise<AdminAuth> {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { ok: false, reason: "not_logged_in" };

  if (!hasVerifiedGoogleEmail(user) || !(await isAdminEmail(user.email))) return { ok: false, reason: "not_admin" };

  return { ok: true, email: user.email, admin: createSupabaseAdminClient() };
}

export async function logAdminAccess(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  adminEmail: string,
  action: string
) {
  await admin.from("admin_access_log").insert({ admin_email: adminEmail, action });
}
