export type MemberRow = {
  id: string;
  email: string;
  display_name: string | null;
  provider: string;
  agreement_reason: string;
  joined_at: string;
  referrer_article_slug: string | null;
  first_read_article_slug: string | null;
  admin_note: string | null;
};

export type ArchiveRow = {
  provider: string;
  agreement_reason: string;
  joined_at: string;
  left_at: string;
};

const REASON_LABELS: Record<string, string> = {
  financial: "金銭的利益をもたらした",
  referral: "誰かに薦めたことがある",
  other: "その他の形で応援",
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  line: "LINE",
};

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function monthsBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

export function buildDashboardStats(members: MemberRow[], archive: ArchiveRow[]) {
  const now = new Date().toISOString();

  const currentCount = members.length;
  const churnCount = archive.length;
  const cumulativeJoins = currentCount + churnCount;

  // provider breakdown (all-time)
  const providerCounts: Record<string, number> = {};
  for (const m of members) providerCounts[m.provider] = (providerCounts[m.provider] ?? 0) + 1;
  for (const a of archive) providerCounts[a.provider] = (providerCounts[a.provider] ?? 0) + 1;
  const providerBreakdown = Object.entries(providerCounts)
    .map(([provider, count]) => ({ provider, label: PROVIDER_LABELS[provider] ?? provider, count }))
    .sort((a, b) => b.count - a.count);

  // reason breakdown + retention cross-tab
  const reasonTotals: Record<string, { total: number; active: number }> = {};
  for (const m of members) {
    reasonTotals[m.agreement_reason] ??= { total: 0, active: 0 };
    reasonTotals[m.agreement_reason].total++;
    reasonTotals[m.agreement_reason].active++;
  }
  for (const a of archive) {
    reasonTotals[a.agreement_reason] ??= { total: 0, active: 0 };
    reasonTotals[a.agreement_reason].total++;
  }
  const reasonBreakdown = Object.entries(reasonTotals)
    .map(([reason, v]) => ({
      reason,
      label: REASON_LABELS[reason] ?? reason,
      total: v.total,
      active: v.active,
      retentionRate: v.total > 0 ? Math.round((v.active / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // join/leave time series by month
  const joinsByMonth: Record<string, number> = {};
  for (const m of members) joinsByMonth[monthKey(m.joined_at)] = (joinsByMonth[monthKey(m.joined_at)] ?? 0) + 1;
  for (const a of archive) joinsByMonth[monthKey(a.joined_at)] = (joinsByMonth[monthKey(a.joined_at)] ?? 0) + 1;
  const leavesByMonth: Record<string, number> = {};
  for (const a of archive) leavesByMonth[monthKey(a.left_at)] = (leavesByMonth[monthKey(a.left_at)] ?? 0) + 1;
  const allMonths = Array.from(new Set([...Object.keys(joinsByMonth), ...Object.keys(leavesByMonth)])).sort();
  const timeSeries = allMonths.map((month) => ({
    month,
    joins: joinsByMonth[month] ?? 0,
    leaves: leavesByMonth[month] ?? 0,
  }));

  // day-of-week x hour-of-day heatmap of joins
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const row of [...members, ...archive]) {
    const d = new Date(row.joined_at);
    heatmap[d.getDay()][d.getHours()]++;
  }

  // cohort retention: for each join-month cohort, % still active at +1/+3/+6 months
  const cohortMonths = Array.from(
    new Set([...members.map((m) => monthKey(m.joined_at)), ...archive.map((a) => monthKey(a.joined_at))])
  ).sort();
  const cohorts = cohortMonths.map((month) => {
    const cohortMembers = members.filter((m) => monthKey(m.joined_at) === month);
    const cohortArchive = archive.filter((a) => monthKey(a.joined_at) === month);
    const total = cohortMembers.length + cohortArchive.length;

    function retentionAt(checkpointMonths: number): number | null {
      const elapsedSinceCohortStart = monthsBetween(`${month}-01`, now);
      if (elapsedSinceCohortStart < checkpointMonths) return null; // not enough time has passed yet
      let retained = 0;
      for (const m of cohortMembers) retained++; // still active members always count as retained
      for (const a of cohortArchive) {
        if (monthsBetween(a.joined_at, a.left_at) >= checkpointMonths) retained++;
      }
      return total > 0 ? Math.round((retained / total) * 100) : null;
    }

    return {
      month,
      total,
      retention1mo: retentionAt(1),
      retention3mo: retentionAt(3),
      retention6mo: retentionAt(6),
    };
  });

  // referral tracking (current members only -- archive doesn't retain article-level referral data)
  const referrerCounts: Record<string, number> = {};
  for (const m of members) {
    if (!m.referrer_article_slug) continue;
    referrerCounts[m.referrer_article_slug] = (referrerCounts[m.referrer_article_slug] ?? 0) + 1;
  }
  const topReferrers = Object.entries(referrerCounts)
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // milestone celebration
  const MILESTONES = [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const nextMilestone = MILESTONES.find((m) => m > currentCount) ?? null;
  const justPassedMilestone = MILESTONES.filter((m) => m <= currentCount).pop() ?? null;
  const recentlyPassedMilestone =
    justPassedMilestone !== null && currentCount - justPassedMilestone < 5 ? justPassedMilestone : null;

  return {
    currentCount,
    cumulativeJoins,
    churnCount,
    providerBreakdown,
    reasonBreakdown,
    timeSeries,
    heatmap,
    cohorts,
    topReferrers,
    nextMilestone,
    recentlyPassedMilestone,
  };
}
