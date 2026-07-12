export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { getMember } from "../../../lib/members";

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const member = await getMember(supabase, user.id);
  if (!member) {
    return new Response(JSON.stringify({ error: "not_a_member" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: memberRow, error: fetchError } = await supabase
    .from("members")
    .select("provider, agreement_reason, joined_at")
    .eq("auth_user_id", user.id)
    .single();

  if (fetchError || !memberRow) {
    return new Response(JSON.stringify({ error: "fetch_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createSupabaseAdminClient();

  const { error: archiveError } = await admin.from("member_stats_archive").insert({
    provider: memberRow.provider,
    agreement_reason: memberRow.agreement_reason,
    joined_at: memberRow.joined_at,
  });

  if (archiveError) {
    return new Response(JSON.stringify({ error: "archive_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: deleteMemberError } = await admin.from("members").delete().eq("auth_user_id", user.id);
  if (deleteMemberError) {
    return new Response(JSON.stringify({ error: "member_delete_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    return new Response(JSON.stringify({ error: "auth_delete_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  await supabase.auth.signOut();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
