export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { isSameOrigin } from "../../../lib/http";

// POST-only on purpose. As a GET this was a state change reachable from
// any third-party page (`<img src="/api/auth/logout">` would silently
// sign a reader out); the same-origin check closes the equivalent
// cross-site form submission.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isSameOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const supabase = createSupabaseServerClient(request, cookies);
  await supabase.auth.signOut();
  // 303 so the browser re-requests the home page with GET rather than
  // replaying the POST.
  return redirect("/", 303);
};
