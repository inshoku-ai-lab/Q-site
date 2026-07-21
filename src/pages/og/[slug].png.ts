export const prerender = true;

import type { APIRoute } from "astro";
import { ImageResponse } from "@vercel/og";
import { getPublishedPosts, categoryAccent } from "../../lib/posts";

// Only generate a card for posts without their own cover photo -- posts.astro
// falls back to a real photo when one exists, which reads better than a
// generated card.
export async function getStaticPaths() {
  return getPublishedPosts()
    .filter((post) => !post.cover)
    .map((post) => ({ params: { slug: post.slug } }));
}

const ACCENT_HEX: Record<string, string> = {
  wandering: "#A6845F",
  thought: "#4A5E66",
  current: "#9C5642",
  essay: "#7A7060",
  ink: "#4F6B43",
};

let fontPromise: Promise<ArrayBuffer> | null = null;

// Google's CSS endpoint serves a TTF (not woff2) when the request looks like
// an old browser that doesn't support woff2 -- this is the standard trick
// used to get a satori-compatible font file out of Google Fonts.
async function loadFont(): Promise<ArrayBuffer> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const cssRes = await fetch(
        "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700&display=swap",
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" } }
      );
      const css = await cssRes.text();
      const match = css.match(/src: url\(([^)]+)\) format\('truetype'\)/);
      if (!match) throw new Error("Could not find TTF url in Google Fonts CSS");
      const fontRes = await fetch(match[1]);
      return fontRes.arrayBuffer();
    })();
  }
  return fontPromise;
}

export const GET: APIRoute = async ({ params }) => {
  const post = getPublishedPosts().find((p) => p.slug === params.slug);
  if (!post) return new Response("Not found", { status: 404 });

  const accent = ACCENT_HEX[categoryAccent(post.category)] ?? ACCENT_HEX.ink;
  const fontData = await loadFont();

  return new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#F6EFDC",
          fontFamily: "Zen Kaku Gothic New",
        },
        children: [
          post.category
            ? {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: "28px",
                    color: accent,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  },
                  children: post.category,
                },
              }
            : null,
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                fontSize: "64px",
                lineHeight: 1.4,
                color: "#2A1F11",
                fontWeight: 700,
              },
              children: post.title,
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "28px",
                color: "#79694F",
              },
              children: [
                { type: "div", props: { style: { display: "flex" }, children: "Qryptraveller's Notes" } },
                {
                  type: "div",
                  props: {
                    style: { display: "flex" },
                    children: post.series && post.episode != null ? `${post.series} #${post.episode}` : "",
                  },
                },
              ],
            },
          },
        ].filter(Boolean),
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Zen Kaku Gothic New", data: fontData, weight: 700, style: "normal" }],
    }
  );
};
