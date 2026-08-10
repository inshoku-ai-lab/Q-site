export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getMember } from "../../../lib/members";
import { safeRedirectPath } from "../../../lib/http";

const VALID_REASONS = ["financial", "referral", "other"];

export const GET: APIRoute = async ({ request, cookies, redirect, url }) => {
  const code = url.searchParams.get("code");
  const agreementReason = url.searchParams.get("agreement_reason");
  // Both of these are attacker-controllable, so they are only ever used
  // through safeRedirectPath() -- never handed to redirect() directly.
  const referrer = url.searchParams.get("ref");

  if (!code) {
    return redirect("/join?error=missing_code");
  }

  const supabase = createSupabaseServerClient(request, cookies);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("auth callback: exchangeCodeForSession failed", error?.message);
    return redirect("/join?error=auth_failed");
  }

  const user = data.session.user;
  const provider = user.app_metadata?.provider ?? "google";
  const providerName = provider === "custom:line" ? "line" : provider;

  const existingMember = await getMember(supabase, user.id);

  if (!existingMember) {
    if (!agreementReason || !VALID_REASONS.includes(agreementReason)) {
      console.error(`auth callback: missing/invalid agreement_reason for a ${providerName} sign-in`);
      return redirect("/join?error=missing_agreement");
    }

    // The referrer is stored as-is for analytics, but it is user input:
    // keep only same-site paths so the admin dashboard can't be fed a
    // link to somewhere else.
    const referrerPath = referrer ? safeRedirectPath(referrer, "") : "";

    const { error: insertError } = await supabase.from("members").insert({
      auth_user_id: user.id,
      email: user.email ?? "",
      display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      provider: providerName,
      agreement_reason: agreementReason,
      referrer_article_slug: referrerPath || null,
      first_read_article_slug: referrerPath || null,
    });

    if (insertError) {
      console.error("auth callback: members insert failed", insertError.message);
      return redirect("/join?error=registration_failed");
    }
  }

  // Prefer the cookie set right before the OAuth redirect over the "ref"
  // query param -- some providers' redirect chains don't reliably carry a
  // query param all the way through provider -> Supabase -> here, but the
  // cookie survives regardless of provider.
  const cookieRedirect = cookies.get("post_login_redirect")?.value;
  cookies.delete("post_login_redirect", { path: "/" });

  // safeRedirectPath rejects absolute URLs, protocol-relative "//host"
  // values and malformed percent-encoding, so a crafted `ref=` or a
  // tampered cookie can only ever land the user back on this site.
  const redirectTarget = safeRedirectPath(cookieRedirect ?? referrer, "/");

  return redirect(redirectTarget);
};
