import type { SupabaseClient } from "@supabase/supabase-js";

// Free, key-less quote source (stooq.com CSV endpoint). No paid API per
// business decision (MEMORY.md: "データ取得は無料の方法に限定").
const STOOQ_URL = (symbol: string) =>
  `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlc&h&e=csv`;

async function fetchStooqClose(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(STOOQ_URL(symbol), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const cols = lines[1].split(",");
    const close = parseFloat(cols[cols.length - 1]);
    return Number.isFinite(close) && close > 0 ? close : null;
  } catch {
    return null;
  }
}

export interface SilverFeeSettings {
  dealerFeePct: number;
  fxFeePct: number;
  consumptionTaxPct: number;
  gsFeePct: number;
}

// Fallback used only if the settings row can't be read (e.g. migration not
// yet applied). Matches the defaults seeded by
// supabase/migrations/0001_silver_price_settings.sql.
const DEFAULT_SETTINGS: SilverFeeSettings = {
  dealerFeePct: 14,
  fxFeePct: 1,
  consumptionTaxPct: 10,
  gsFeePct: 5,
};

export async function getSilverPriceSettings(admin: SupabaseClient): Promise<SilverFeeSettings> {
  const { data, error } = await admin
    .from("silver_price_settings")
    .select("dealer_fee_pct, fx_fee_pct, consumption_tax_pct, gs_fee_pct")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return {
    dealerFeePct: Number(data.dealer_fee_pct),
    fxFeePct: Number(data.fx_fee_pct),
    consumptionTaxPct: Number(data.consumption_tax_pct),
    gsFeePct: Number(data.gs_fee_pct),
  };
}

export interface SilverPriceBreakdown {
  spotUsd: number;
  usdJpyRate: number;
  afterDealerUsd: number;   // spot + dealer premium, still USD
  afterFxJpy: number;       // converted to JPY at the raw rate, before fx fee%
  afterFxFeeJpy: number;    // + remittance/FX fee%
  afterTaxJpy: number;      // + consumption tax%
  finalJpy: number;         // + GS fee% -- the number shown large on the page
  settings: SilverFeeSettings;
  fetchedAt: string;
}

// Each stage compounds on the previous result per MEMORY.md's confirmed
// formula. All four fee percentages are independently adjustable (dealer fee
// tracks the supplier's stock situation, fx fee tracks the remittance
// provider, consumption tax is statutory, GS fee is GS's own margin).
export function computeSilverPrice(
  spotUsd: number,
  usdJpyRate: number,
  settings: SilverFeeSettings
): SilverPriceBreakdown {
  const afterDealerUsd = spotUsd * (1 + settings.dealerFeePct / 100);
  const afterFxJpy = afterDealerUsd * usdJpyRate;
  const afterFxFeeJpy = afterFxJpy * (1 + settings.fxFeePct / 100);
  const afterTaxJpy = afterFxFeeJpy * (1 + settings.consumptionTaxPct / 100);
  const finalJpy = afterTaxJpy * (1 + settings.gsFeePct / 100);

  return {
    spotUsd,
    usdJpyRate,
    afterDealerUsd,
    afterFxJpy,
    afterFxFeeJpy,
    afterTaxJpy,
    finalJpy,
    settings,
    fetchedAt: new Date().toISOString(),
  };
}

export type SilverPriceResult =
  | { ok: true; breakdown: SilverPriceBreakdown }
  | { ok: false; settings: SilverFeeSettings };

// Orchestrator used by the /silver page: pulls settings + both free quotes
// in parallel, and degrades to an explicit failure state (rather than
// throwing) if the upstream feed is unavailable -- the page renders a
// fallback message instead of crashing. See src/pages/silver/index.astro for
// the CDN-level stale-while-revalidate caching that keeps this cheap.
export async function getSilverPriceData(admin: SupabaseClient): Promise<SilverPriceResult> {
  const [settings, spotUsd, usdJpyRate] = await Promise.all([
    getSilverPriceSettings(admin),
    fetchStooqClose("xagusd"),
    fetchStooqClose("usdjpy"),
  ]);

  if (spotUsd === null || usdJpyRate === null) {
    return { ok: false, settings };
  }

  return { ok: true, breakdown: computeSilverPrice(spotUsd, usdJpyRate, settings) };
}
