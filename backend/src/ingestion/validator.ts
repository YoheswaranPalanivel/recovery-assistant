import { z } from "zod";
import { config } from "../config.js";
import type { DailyRecord } from "@shared/types";
import { parseDate, type ColumnMapping, type StandardField } from "./columnMapper.js";
import { pseudonymise } from "./pseudonymise.js";

const range = (field: string) => {
  const [min, max] = config.validRanges[field];
  return z
    .number({ error: `${field} is not a number` })
    .min(min, { error: `${field} below ${min}` })
    .max(max, { error: `${field} above ${max} (impossible value)` });
};

const RecordSchema = z.object({
  userId: z.string().min(1, { error: "missing user id" }).max(64),
  date: z.string({ error: "missing or unreadable date" }).regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: range("steps"),
  distanceKm: range("distanceKm").nullable(),
  activeMinutes: range("activeMinutes").nullable(),
  sedentaryMinutes: range("sedentaryMinutes").nullable(),
  veryActiveMinutes: range("activeMinutes").nullable(),
  fairlyActiveMinutes: range("activeMinutes").nullable(),
  lightlyActiveMinutes: range("activeMinutes").nullable(),
  calories: range("calories").nullable(),
  sleepHours: range("sleepHours").nullable(),
  restingHeartRate: range("restingHeartRate").nullable(),
  recoveryScore: range("recoveryScore").nullable(),
});

const SleepSchema = z.object({
  userId: z.string().min(1, { error: "missing user id" }).max(64),
  date: z.string({ error: "missing or unreadable date" }).regex(/^\d{4}-\d{2}-\d{2}$/),
  sleepHours: range("sleepHours"),
});

export type SleepEntry = z.infer<typeof SleepSchema>;

export type ValidationResult =
  | { ok: true; kind: "activity"; record: DailyRecord }
  | { ok: true; kind: "sleep"; sleep: SleepEntry }
  | { ok: false; reason: string };

/** Turns "", "NA", "null" etc. into null; numeric strings into numbers. */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = String(v).trim();
  if (s === "" || /^(na|n\/a|null|nan|none|-)$/i.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** Strip anything that could identify a person or break the UI; keep ids anonymous. */
function cleanId(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/[^\w.-]/g, "")
    .slice(0, 64);
}

const round = (n: number | null, dp = 2) => (n === null ? null : Math.round(n * 10 ** dp) / 10 ** dp);

export function validateRow(row: Record<string, unknown>, mapping: ColumnMapping): ValidationResult {
  const get = (f: StandardField) => (mapping.fields[f] ? row[mapping.fields[f]!] : undefined);

  // The raw dataset id is replaced by a pseudonym right here, before validation output is stored.
  const userId = pseudonymise(cleanId(get("userId")));
  const date = parseDate(get("date"));

  let sleepHours = toNum(get("sleepHours"));
  const sleepMinutes = toNum(get("sleepMinutes"));
  if (sleepMinutes !== null && !Number.isNaN(sleepMinutes)) sleepHours = sleepMinutes / 60;

  if (mapping.kind === "sleep") {
    const parsed = SleepSchema.safeParse({ userId, date: date ?? undefined, sleepHours: sleepHours ?? undefined });
    if (!parsed.success) return { ok: false, reason: firstIssue(parsed.error) };
    return { ok: true, kind: "sleep", sleep: { ...parsed.data, sleepHours: round(parsed.data.sleepHours)! } };
  }

  // Active minutes: Fitbit splits it; "very + fairly" = moderate-to-vigorous minutes.
  let activeMinutes = toNum(get("activeMinutes"));
  const very = toNum(get("veryActiveMinutes"));
  const fairly = toNum(get("fairlyActiveMinutes"));
  if (very !== null && fairly !== null) activeMinutes = very + fairly;

  const candidate = {
    userId,
    date: date ?? undefined,
    steps: toNum(get("steps")) ?? undefined,
    distanceKm: round(toNum(get("distanceKm"))),
    activeMinutes,
    sedentaryMinutes: toNum(get("sedentaryMinutes")),
    veryActiveMinutes: very,
    fairlyActiveMinutes: fairly,
    lightlyActiveMinutes: toNum(get("lightlyActiveMinutes")),
    calories: toNum(get("calories")),
    sleepHours: round(sleepHours),
    restingHeartRate: toNum(get("restingHeartRate")),
    recoveryScore: toNum(get("recoveryScore")),
  };

  const parsed = RecordSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: firstIssue(parsed.error) };

  // Non-wear day: device recorded nothing. Not a real "zero activity" day, so it
  // would distort averages and fire false alerts. Flag it instead of storing it.
  if (parsed.data.steps === 0 && (parsed.data.sedentaryMinutes === null || parsed.data.sedentaryMinutes >= 1440)) {
    return { ok: false, reason: "device not worn (0 steps, no activity recorded)" };
  }

  // Logical check: a full day of sedentary + active minutes can't exceed 24h.
  const r = parsed.data;
  if (r.activeMinutes !== null && r.sedentaryMinutes !== null && r.activeMinutes + r.sedentaryMinutes > 1440) {
    return { ok: false, reason: "active + sedentary minutes exceed 24 hours" };
  }
  return { ok: true, kind: "activity", record: { ...r, steps: Math.round(r.steps) } };
}

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return "invalid row";
  if (i.code === "invalid_type") {
    const field = String(i.path[0] ?? "value");
    return `missing or invalid ${field}`;
  }
  return i.message;
}
