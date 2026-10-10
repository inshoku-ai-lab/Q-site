// The Astro Vercel adapter writes .vercel/output/config.json itself and
// knows nothing about cron jobs, so they are added to that file here,
// right after `astro build` (Build Output API: config.json "crons").
import fs from "node:fs";

const CRONS = [
  // Daily Supabase keep-alive (free projects pause after 7 idle days).
  { path: "/api/keepalive", schedule: "23 18 * * *" },
];

const file = ".vercel/output/config.json";
const config = JSON.parse(fs.readFileSync(file, "utf-8"));
config.crons = CRONS;
fs.writeFileSync(file, JSON.stringify(config, null, "\t"));
console.log(`add-vercel-crons: ${CRONS.length} cron job(s) written to ${file}`);
