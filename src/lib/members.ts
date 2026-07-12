import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMember(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("members")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data;
}

export async function isMember(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return !!(await getMember(supabase, userId));
}
