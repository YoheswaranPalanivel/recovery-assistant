/**
 * Replay simulator: streams a dataset to the backend in timed batches,
 * the way a wearable integration would push new days of data.
 *
 *   npm run replay -- --activity <file.csv> [--sleep <file.csv>]
 *                     [--interval 3000] [--days-per-tick 1] [--warmup 21]
 *                     [--shift-to-today] [--reset] [--api http://localhost:4000]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { buildMapping, parseDate } from "../src/ingestion/columnMapper.js";

type Row = Record<string, string>;

const args = process.argv.slice(2);
const opt = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const flag = (name: string) => args.includes(`--${name}`);

const API = opt("api", "http://localhost:4000")!;
const KEY = process.env.INGEST_API_KEY?.trim() ?? "";
if (!KEY) {
  console.error("INGEST_API_KEY is not set in backend/.env. The ingest endpoint needs it (see .env.example).");
  process.exit(1);
}
const authHeaders = { "Content-Type": "application/json", "x-api-key": KEY };
const INTERVAL = Number(opt("interval", "3000"));
const PER_TICK = Number(opt("days-per-tick", "1"));
const WARMUP = Number(opt("warmup", "21"));
const sampleDir = path.resolve(import.meta.dirname, "../data/sample");
const activityFile = opt("activity", path.join(sampleDir, "dailyActivity_merged.csv"))!;
const sleepFile = opt("sleep", fs.existsSync(path.join(sampleDir, "sleepDay_merged.csv")) && !opt("activity") ? path.join(sampleDir, "sleepDay_merged.csv") : undefined);

function load(file: string) {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}\nRun "npm run sample" first, or pass --activity <path>.`);
    process.exit(1);
  }
  const rows = parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true, trim: true }) as Row[];
  const mapping = buildMapping(Object.keys(rows[0] ?? {}));
  const dateCol = mapping.fields.date;
  if (!dateCol) throw new Error(`${file}: no date column found`);
  return { rows, dateCol, name: path.basename(file) };
}

const sources = [load(activityFile), ...(sleepFile ? [load(sleepFile)] : [])];

// Group every row by its (parsed) day.
const byDay = new Map<string, { src: number; row: Row }[]>();
sources.forEach((s, src) =>
  s.rows.forEach((row) => {
    const d = parseDate(row[s.dateCol]) ?? "invalid";
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push({ src, row });
  }),
);
const invalid = byDay.get("invalid") ?? [];
byDay.delete("invalid");
const days = [...byDay.keys()].sort();

// Optionally move the whole dataset so its last day is today (looks live on the dashboard).
let shiftDays = 0;
if (flag("shift-to-today") && days.length) {
  const last = Date.parse(`${days[days.length - 1]}T00:00:00Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  shiftDays = Math.round((today - last) / 86400000);
}
const shift = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + shiftDays);
  return d.toISOString().slice(0, 10);
};

async function send(dayList: string[], label: string, extra: { src: number; row: Row }[] = []) {
  for (let src = 0; src < sources.length; src++) {
    const rows = [
      ...dayList.flatMap((d) =>
        (byDay.get(d) ?? []).filter((x) => x.src === src).map((x) => ({ ...x.row, [sources[src].dateCol]: shift(d) })),
      ),
      ...extra.filter((x) => x.src === src).map((x) => x.row),
    ];
    for (let i = 0; i < rows.length; i += 5000) {
      const res = await fetch(`${API}/api/ingest`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ source: `${sources[src].name} (${label})`, rows: rows.slice(i, i + 5000) }),
      });
      const body = (await res.json()) as { batch?: { accepted: number; rejected: number }; newAlerts?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      console.log(
        `  ${label.padEnd(24)} ${sources[src].name.padEnd(28)} +${body.batch!.accepted} ok, ${body.batch!.rejected} rejected, ${body.newAlerts} new alerts`,
      );
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  try {
    await fetch(`${API}/api/health`);
  } catch {
    console.error(`Backend not reachable at ${API}. Start it with "npm run dev" first.`);
    process.exit(1);
  }
  if (flag("reset")) {
    const r = await fetch(`${API}/api/reset-stream`, { method: "POST", headers: authHeaders });
    if (!r.ok) {
      console.error(`Reset failed: ${((await r.json().catch(() => ({}))) as { error?: string }).error ?? r.status}`);
      process.exit(1);
    }
  }

  console.log(`Replaying ${days.length} days from ${sources.map((s) => s.name).join(" + ")}`);
  console.log(`Warm-up ${WARMUP} days, then ${PER_TICK} day(s) every ${INTERVAL} ms${shiftDays ? `, dates shifted by ${shiftDays} days` : ""}\n`);

  const warm = days.slice(0, WARMUP);
  if (warm.length) await send(warm, `warm-up ${warm.length}d`, invalid);
  for (let i = WARMUP; i < days.length; i += PER_TICK) {
    await sleep(INTERVAL);
    const chunk = days.slice(i, i + PER_TICK);
    await send(chunk, shift(chunk[0]));
  }
  console.log("\nReplay finished.");
}

main().catch((e) => {
  console.error("Replay stopped:", (e as Error).message);
  process.exit(1);
});
