import { getSeriesIndex } from "./posts";

// Curated presentation order and blurbs for the series (連載).
export const SERIES_ORDER = ["放浪記", "デボリューション理論", "ツイッターファイル", "ティール・スワン", "真のビットコイン (BSV)", "翻訳記事"];

export const SERIES_DESCRIPTIONS: Record<string, string> = {
  "放浪記": "宗教家庭から脱出した17歳の少年が、世界中を放浪し続ける物語。500話以上の連載。",
  "デボリューション理論": "トランプ政権末期に発動された軍事的権限委譲作戦の全貌。徹底解説。",
  "ツイッターファイル": "イーロン・マスクが暴露したTwitter社内の検閲構造。全シリーズ要約。",
  "ティール・スワン": "悪魔崇拝サバイバーがトラウマセラピストへ。意識の断片化と統合の話。",
  "真のビットコイン (BSV)": "BTCではなくBSV。サトシ・ナカモトの正体とビットコインの本質。",
  "翻訳記事": "海外の重要な情報源から、日本人が知っておくべき記事を翻訳。",
};

export function getSeriesSorted() {
  const list = getSeriesIndex();
  const rank = (name: string) => {
    const i = SERIES_ORDER.indexOf(name);
    return i === -1 ? SERIES_ORDER.length : i;
  };
  return [...list].sort((a, b) => rank(a.name) - rank(b.name) || b.count - a.count);
}

export function seriesHref(name: string): string {
  return `/series/${encodeURIComponent(name)}/`;
}

// Plain-text excerpt clipped to `max` characters.
export function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "放浪記": "20年以上の世界放浪を綴った自伝的連載。各地での出会いと別れ、日々の断片を残しています。",
  "思想・理論": "デボリューション理論、意識論、覚醒についての考察と検証。",
  "時事・情報戦": "メディアが報じない情報戦争・選挙の真実。",
  "エッセイ・その他": "単発の随筆・観察・雑記。",
  "スピリチュアリティ": "意識、トラウマ、自己と魂の探求。ティール・スワンの解説を中心に。",
  "ビットコインの真実": "真のビットコイン(BSV)、サトシ・ナカモトの正体、暗号通貨を巡る情報戦。",
};

export const CATEGORY_ORDER = ["放浪記", "思想・理論", "時事・情報戦", "エッセイ・その他", "スピリチュアリティ", "ビットコインの真実"];
