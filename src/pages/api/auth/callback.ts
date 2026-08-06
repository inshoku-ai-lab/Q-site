export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getMember } from "../../../lib/members";

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
    console.error("auth callback: exchangeCodeForSession failed", error);
    return redirect("/join?error=auth_failed");
  }

  const user = data.session.user;
  const provider = user.app_metadata?.provider ?? "google";
  const providerName = provider === "custom:line" ? "line" : provider;

  const existingMember = await getMember(supabase, user.id);
  console.log(`auth callback: user=${user.id} provider=${providerName} existingMember=${!!existingMember}`);

  if (!existingMember) {
    if (!agreementReason || !VALID_REASONS.includes(agreementReason)) {
      console.error(`auth callback: missing/invalid agreement_reason="${agreementReason}" for user ${user.id}`);
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
      console.error(`auth callback: members insert failed for user ${user.id}`, insertError);
      return redirect("/join?error=registration_failed");
    }
    console.log(`auth callback: created member row for user ${user.id}`);
  }

  // Prefer the cookie set right before the OAuth redirect over the "ref"
  // query param -- some providers' redirect chains don't reliably carry a
  // query param all the way through provider -> Supabase -> here, but the
  // cookie survives regardless of provider.
  const cookieRedirect = cookies.get("post_login_redirect")?.value;
  cookies.delete("post_login_redirect", { path: "/" });
  const redirectTarget = (cookieRedirect ? decodeURIComponent(cookieRedirect) : referrer) || "/";

  return redirect(redirectTarget);
};
