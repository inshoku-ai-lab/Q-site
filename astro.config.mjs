// @ts-check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Route segments that are site structure, not article slugs -- never
// generate a legacy-URL redirect for these.
const RESERVED_SLUGS = new Set([
  "about", "archive", "series", "category", "tag", "posts", "rss.xml",
  "sitemap-index.xml", "sitemap-0.xml", "_astro", "favicon.ico", "favicon.svg", "404",
]);

// The old WordPress site served every article at a flat `/<slug>/` URL;
// this site serves them at `/posts/<slug>/`. Once qryptraveller.com points
// here, every indexed search result and external bookmark to the old URL
// structure needs a 301 or it 404s. Astro's `redirects` config compiles
// straight into the Vercel adapter's native (edge-level, no function
// invocation) redirect rules, so this is generated fresh from posts.json
// on every build rather than hand-maintained.
function legacyPostRedirects() {
  const postsJsonPath = path.join(__dirname, "src/data/posts.json");
  let posts;
  try {
    posts = JSON.parse(fs.readFileSync(postsJsonPath, "utf-8"));
  } catch {
    return {};
  }
  const redirects = {};
  for (const p of posts) {
    if (!p.slug || RESERVED_SLUGS.has(p.slug)) continue;
    redirects[`/${p.slug}`] = `/posts/${p.slug}/`;
  }
  return redirects;
}

// https://astro.build/config
export default defineConfig({
  site: "https://qryptraveller.com",
  output: "server",
  adapter: vercel(),
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({
      // Pages that carry <meta name="robots" content="noindex"> must not
      // be advertised in the sitemap -- submitting a URL for indexing and
      // then telling the crawler not to index it is a contradiction
      // Search Console reports as an error.
      filter: (page) => {
        const { pathname } = new URL(page);
        return !/^\/(search|account|admin)(\/|$)/.test(pathname);
      },
    }),
  ],
  redirects: legacyPostRedirects(),
  build: {
    format: "directory",
  },
});
