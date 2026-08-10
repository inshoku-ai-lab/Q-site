export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isMember } from "../../../../lib/members";
import { getPublishedPostBySlug, splitMemberContent, preprocessBlocks } from "../../../../lib/posts";
import { renderBlocksToHtml } from "../../../../lib/renderBlocksToHtml";

// Per-member content: never store it in a shared cache, and vary on the
// auth cookie so no intermediary can serve one reader's response to
// another.
const PRIVATE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export const GET: APIRoute = async ({ params, request, cookies }) => {
  // Published/Review posts only -- a draft's slug must not expose its
  // member-only tail through this route just because the slug is known.
  const post = params.slug ? getPublishedPostBySlug(params.slug) : undefined;
  if (!post) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: PRIVATE_HEADERS,
    });
  }

  const supabase = createSupabaseServerClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "not_authenticated" }), {
      status: 401,
      headers: PRIVATE_HEADERS,
    });
  }

  if (!(await isMember(supabase, user.id))) {
    return new Response(JSON.stringify({ error: "not_a_member" }), {
      status: 403,
      headers: PRIVATE_HEADERS,
    });
  }

  const { memberBlocks } = splitMemberContent(post.blocks);
  const html = renderBlocksToHtml(preprocessBlocks(memberBlocks));

  return new Response(JSON.stringify({ html }), {
    status: 200,
    headers: PRIVATE_HEADERS,
  });
};
