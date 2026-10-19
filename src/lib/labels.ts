// Looking a label up in a plain object also finds inherited members
// ("constructor", "valueOf", "hasOwnProperty" ...). `members.provider` and
// `members.agreement_reason` are columns a signed-in user can write, so a
// value like that must come back as itself, not as an Object.prototype
// function.
export function lookupLabel(labels: Record<string, string>, key: string | null | undefined): string {
  if (key == null) return "";
  return Object.hasOwn(labels, key) ? labels[key] : key;
}

// Admin pages link "referrer" slugs that are stored with the member. A
// stored value may be hostile, so only a same-site absolute path
// ("/posts/x/") becomes a link; a bare slug is turned into a post URL
// (when it is a plain slug); anything else gets no link at all (null).
const SAME_SITE_PATH = /^\/(?!\/)[^\s\\]*$/;
const PLAIN_SLUG = /^[A-Za-z0-9%._~-]+$/;

export function articleHref(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return SAME_SITE_PATH.test(value) ? value : null;
  return PLAIN_SLUG.test(value) ? `/posts/${value}/` : null;
}
