export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const VALID_REASONS = ["financial", "referral", "other"];

export const GET: APIRoute = async ({ request, cookies, redirect, url }) => {
  const code = url.searchParams.get("code");
  const agreementReason = url.searchParams.get("agreement_reason");
  const referrer = url.searchParams.get("ref");

  if (!code) {
    return redirect("/join?error=missing_code");
  }

  const supabase = createSupabaseServerClient(request, cookies);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return redirect("/join?error=auth_failed");
  }

  const user = data.session.user;
  const provider = user.app_metadata?.provider ?? "google";
  const providerName = provider === "custom:line" ? "line" : provider;

  const { data: existingMember } = await supabase
    .from("members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!existingMember) {
    if (!agreementReason || !VALID_REASONS.includes(agreementReason)) {
      return redirect("/join?error=missing_agreement");
    }

    const { error: insertError } = await supabase.from("members").insert({
      auth_user_id: user.id,
      email: user.email ?? "",
      display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      provider: providerName,
      agreement_reason: agreementReason,
      referrer_article_slug: referrer || null,
      first_read_article_slug: referrer || null,
    });

    if (insertError) {
      return redirect("/join?error=registration_failed");
    }
  }

  return redirect(referrer || "/");
};
