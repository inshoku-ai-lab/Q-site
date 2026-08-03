// Lightweight User-Agent parsing for bug reports -- good enough for triage
// (not a general-purpose UA library), so keep the raw string alongside
// this summary in case a browser/OS combination isn't recognized.
export type UaSummary = {
  deviceType: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
};

export function parseUserAgent(ua: string): UaSummary {
  const isTablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua);
  const isMobile = !isTablet && /Mobi|iPhone|Android/i.test(ua);
  const deviceType: UaSummary["deviceType"] = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let browser = "不明";
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/Edg\/([\d.]+)/))) browser = `Edge ${m[1].split(".")[0]}`;
  else if ((m = ua.match(/OPR\/([\d.]+)/))) browser = `Opera ${m[1].split(".")[0]}`;
  else if ((m = ua.match(/CriOS\/([\d.]+)/))) browser = `Chrome ${m[1].split(".")[0]} (iOS)`;
  else if ((m = ua.match(/FxiOS\/([\d.]+)/))) browser = `Firefox ${m[1].split(".")[0]} (iOS)`;
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua) && (m = ua.match(/Chrome\/([\d.]+)/)))
    browser = `Chrome ${m[1].split(".")[0]}`;
  else if ((m = ua.match(/Firefox\/([\d.]+)/))) browser = `Firefox ${m[1].split(".")[0]}`;
  else if (/Version\/.*Safari\//.test(ua) && (m = ua.match(/Version\/([\d.]+)/))) browser = `Safari ${m[1].split(".")[0]}`;

  let os = "不明";
  if ((m = ua.match(/Windows NT 10\.0/))) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if ((m = ua.match(/iPhone OS ([\d_]+)/)) || (m = ua.match(/CPU OS ([\d_]+)/))) os = `iOS ${m[1].replace(/_/g, ".")}`;
  else if ((m = ua.match(/Mac OS X ([\d_]+)/))) os = `macOS ${m[1].replace(/_/g, ".")}`;
  else if ((m = ua.match(/Android ([\d.]+)/))) os = `Android ${m[1]}`;
  else if (/Linux/.test(ua)) os = "Linux";

  return { deviceType, browser, os };
}
