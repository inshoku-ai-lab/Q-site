// Helpers for the 縦組み (vertical-rl) headings used throughout the
// redesign. A vertical heading lives in a box of fixed height, so a title
// has to be broken into columns at natural points (after particles and
// punctuation) and given a font size small enough that the columns don't
// eat the whole width of the screen.

const KANJI_DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

// 1 -> 一, 12 -> 十二, 520 -> 五百二十, 1000 -> 千
export function toKanjiNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  n = Math.floor(n);
  if (n === 0) return "〇";
  if (n >= 10000) return String(n);
  const units: [number, string][] = [
    [1000, "千"],
    [100, "百"],
    [10, "十"],
  ];
  let out = "";
  let rest = n;
  for (const [value, mark] of units) {
    const d = Math.floor(rest / value);
    if (d > 0) out += (d === 1 ? "" : KANJI_DIGITS[d]) + mark;
    rest %= value;
  }
  if (rest > 0) out += KANJI_DIGITS[rest];
  return out;
}

// Characters that may end a column (break after them).
const BREAK_AFTER = new Set([..."、。・：:！？!?」』）)】〕，,　 のはがをにでとへもやか"]);
// Characters that should never start a column.
const NO_START = new Set([..."、。・：:！？!?」』）)】〕，,ーっゃゅょァィゥェォッャュョぁぃぅぇぉ"]);

// Rough width of a character in em when set vertically: latin runs are
// rotated (text-orientation: mixed) and take about half the advance of a
// full-width character.
function charAdvance(ch: string): number {
  return /[\x20-\x7e]/.test(ch) ? 0.55 : 1;
}

function advanceOf(s: string): number {
  let a = 0;
  for (const ch of s) a += charAdvance(ch);
  return a;
}

// Break text into pieces ending at natural break points.
function segments(text: string): string[] {
  const chars = [...text];
  const segs: string[] = [];
  let cur = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    cur += ch;
    const next = chars[i + 1];
    if (next === undefined) break;
    // Script boundaries approximate 文節 boundaries: katakana<->kanji, and
    // hiragana -> kanji (the end of a run of okurigana / particles).
    const kindChange =
      (/[\u30a0-\u30ff]/.test(ch) && /[\u4e00-\u9fff]/.test(next)) ||
      (/[\u4e00-\u9fff]/.test(ch) && /[\u30a0-\u30ff]/.test(next)) ||
      (/[\u3041-\u309f]/.test(ch) && /[\u4e00-\u9fff]/.test(next));
    // A particle followed by more kana ("での", "から") is not a boundary.
    const particleRun = /[\u3041-\u309f]/.test(ch) && /[\u3041-\u309f]/.test(next);
    if (((BREAK_AFTER.has(ch) && !particleRun) || kindChange) && !NO_START.has(next)) {
      segs.push(cur);
      cur = "";
    }
  }
  if (cur) segs.push(cur);
  return segs;
}

// Break into the fewest columns of at most `perCol` em, choosing break
// points so the columns come out as even as possible (生まれて／来る前の話
// rather than 生まれて来る前／の話).
let lastHardSplit = false;

function fillColumns(text: string, perCol: number): string[] {
  lastHardSplit = false;
  // Pieces no longer than a column: hard-split any oversized segment.
  const pieces: string[] = [];
  for (const seg of segments(text)) {
    if (advanceOf(seg) <= perCol) {
      pieces.push(seg);
      continue;
    }
    lastHardSplit = true;
    let piece = "";
    for (const ch of seg) {
      if (piece && advanceOf(piece + ch) > perCol && !NO_START.has(ch)) {
        pieces.push(piece);
        piece = "";
      }
      piece += ch;
    }
    if (piece) pieces.push(piece);
  }
  const n = pieces.length;
  const len = (i: number, j: number) => advanceOf(pieces.slice(i, j).join(""));
  // best[i] = [columns, worst column length] for pieces[i..]
  const best: { cols: number; worst: number; next: number }[] = new Array(n + 1);
  best[n] = { cols: 0, worst: 0, next: n };
  for (let i = n - 1; i >= 0; i--) {
    let choice = { cols: Infinity, worst: Infinity, next: i + 1 };
    for (let j = i + 1; j <= n; j++) {
      const l = len(i, j);
      if (l > perCol && j > i + 1) break;
      const rest = best[j];
      const cand = { cols: rest.cols + 1, worst: Math.max(l, rest.worst), next: j };
      if (cand.cols < choice.cols || (cand.cols === choice.cols && cand.worst < choice.worst)) choice = cand;
    }
    best[i] = choice;
  }
  const cols: string[] = [];
  for (let i = 0; i < n; i = best[i].next) cols.push(pieces.slice(i, best[i].next).join("").trim());
  return cols.filter(Boolean);
}

export type VerticalLayout = { lines: string[]; size: number };

// Fit `text` into a vertical box: `height` is the usable column length
// in px, `maxWidth` the widest the block may grow. Tries the base size
// first and steps down until the columns fit.
export function fitVertical(
  text: string,
  opts: { size: number; height: number; maxWidth: number; minSize?: number; lineHeight?: number; tracking?: number },
): VerticalLayout {
  const lh = opts.lineHeight ?? 1.2;
  const tracking = opts.tracking ?? 0.08;
  const minSize = opts.minSize ?? 16;
  const clean = text.replace(/\s+/g, " ").trim();
  let size = opts.size;
  let lines: string[] = [clean];
  while (true) {
    const perCol = Math.max(1, Math.floor(opts.height / (size * (1 + tracking))));
    lines = fillColumns(clean, perCol);
    const fits = lines.length * size * lh <= opts.maxWidth;
    // Rather than break a word mid-way, accept a somewhat smaller size.
    const wordBroken = lastHardSplit && size > opts.size * 0.75;
    if ((fits && !wordBroken) || size <= minSize) break;
    size = Math.max(minSize, Math.round(size * 0.88));
  }
  return { lines, size };
}

// Article titles carry their series position in parentheses, e.g.
// "石垣島でキャンプする話１０（放浪記５２０）" -- the vertical heading shows
// the series label separately, so drop it there.
export function displayTitle(title: string, series: string | null): string {
  let t = title.replace(/[（(]\s*放浪記\s*[0-9０-９]+\s*[）)]\s*$/, "").trim();
  if (series) {
    const esc = series.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`[\\s　]+${esc}\\s*$`), "").trim();
  }
  return t || title;
}

// "放浪記　第五百二十話" / "デボリューション理論　第十三回 · 17/17" ...
export function episodeLabel(post: { series: string | null; episode: number | null; sub_episode: string | null; category: string | null }): string {
  if (!post.series) return post.category ?? "";
  if (post.episode == null) return post.series;
  if (post.series === "放浪記") return `放浪記　第${toKanjiNumber(post.episode)}話`;
  const sub = post.sub_episode ? ` · ${post.sub_episode}` : "";
  return `${post.series}　第${toKanjiNumber(post.episode)}回${sub}`;
}

// Short episode marker for list rows: "520" / "13-17/17" ...
export function episodeNumber(post: { episode: number | null; sub_episode: string | null }): string {
  if (post.episode == null) return "";
  return String(post.episode).padStart(3, "0");
}

// Build-time masthead: "2026.09.28" in Japan time.
export function mastheadDate(d = new Date()): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}.${String(jst.getUTCMonth() + 1).padStart(2, "0")}.${String(jst.getUTCDate()).padStart(2, "0")}`;
}
