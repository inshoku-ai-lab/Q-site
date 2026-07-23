export const prerender = false;

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isMember } from "../../../../lib/members";
import { getPostBySlug, splitMemberContent, preprocessBlocks } from "../../../../lib/posts";
import { renderBlocksToHtml } from "../../../../lib/renderBlocksToHtml";

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const post = params.slug ? getPostBySlug(params.slug) : undefined;
  if (!post) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  if (!(await isMember(supabase, user.id))) {
    return new Response(JSON.stringify({ error: "not_a_member" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { memberBlocks } = splitMemberContent(post.blocks);
  const html = renderBlocksToHtml(preprocessBlocks(memberBlocks));

  return new Response(JSON.stringify({ html }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
