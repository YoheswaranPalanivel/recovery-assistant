import { mean } from "simple-statistics";
import type { DailyRecord, HeatRow, Kpis, TrendPoint, UserSummary } from "@shared/types";
import { config } from "../config.js";

export type Filter = { userId?: string; from?: string; to?: string };

// ---------- small helpers ----------

export const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

export const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? mean(v) : null;
};

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export const metTarget = (r: DailyRecord) => r.steps >= config.targetSteps;

/** Compliance % = (days target achieved / total tracked days) × 100 */
export const compliance = (rs: DailyRecord[]) =>
  rs.length ? round((rs.filter(metTarget).length / rs.length) * 100, 1) : 0;

export function applyFilter(all: DailyRecord[], f: Filter): DailyRecord[] {
  return all.filter(
    (r) =>
      (!f.userId || r.userId === f.userId) && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to),
  );
}

export function completedDays(all: DailyRecord[]): DailyRecord[] {
  if (!config.excludeLatestDay) return all;
  const { max } = dateRange(all);
  return max ? all.filter((r) => r.date !== max) : all;
}

export function dateRange(rs: DailyRecord[]) {
  if (!rs.length) return { min: null, max: null };
  let min = rs[0].date;
  let max = rs[0].date;
  for (const r of rs) {
    if (r.date < min) min = r.date;
    if (r.date > max) max = r.date;
  }
  return { min, max };
}

export function groupBy<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

// ---------- KPIs ----------

export function computeKpis(all: DailyRecord[], f: Filter): Kpis {
  const current = applyFilter(all, f);
  const { min, max } = dateRange(current);

  // Previous period: an equal-length window directly before the selected one.
  // With no date filter, compare the last 7 days of data with the 7 before.
  let stepsChangePct: number | null = null;
  let changeLabel: string | null = null;
  if (min && max) {
    const scoped = applyFilter(all, { userId: f.userId });
    let curFrom: string, curTo: string;
    if (f.from || f.to) {
      curFrom = min;
      curTo = max;
    } else {
      curTo = max;
      curFrom = addDays(max, -6);
    }
    const len = daysBetween(curFrom, curTo) + 1;
    const prevTo = addDays(curFrom, -1);
    const prevFrom = addDays(curFrom, -len);
    const cur = applyFilter(scoped, { from: curFrom, to: curTo });
    const prev = applyFilter(scoped, { from: prevFrom, to: prevTo });
    const c = avg(cur.map((r) => r.steps));
    const p = avg(prev.map((r) => r.steps));
    if (c !== null && p !== null && p > 0) {
      stepsChangePct = round(((c - p) / p) * 100, 1);
      changeLabel = `${len}-day avg steps vs previous ${len} days`;
    }
  }

  const n = (v: number | null, dp = 1) => (v === null ? null : round(v, dp));
  return {
    users: new Set(current.map((r) => r.userId)).size,
    records: current.length,
    avgSteps: Math.round(avg(current.map((r) => r.steps)) ?? 0),
    avgActiveMinutes: n(avg(current.map((r) => r.activeMinutes)), 0),
    avgCalories: n(avg(current.map((r) => r.calories)), 0),
    activityMix: activityMix(current),
    avgSleepHours: n(avg(current.map((r) => r.sleepHours)), 1),
    avgRecoveryScore: n(avg(current.map((r) => r.recoveryScore)), 0),
    compliancePct: compliance(current),
    stepsChangePct,
    changeLabel,
    target: config.targetSteps,
    periodStart: min,
    periodEnd: max,
  };
}


/** Average minutes per day at each intensity, from days that have the full split. */
function activityMix(rs: DailyRecord[]): Kpis["activityMix"] {
  const days = rs.filter(
    (r) => r.veryActiveMinutes != null && r.fairlyActiveMinutes != null && r.lightlyActiveMinutes != null && r.sedentaryMinutes != null,
  );
  if (!days.length) return null;
  const m = (k: "veryActiveMinutes" | "fairlyActiveMinutes" | "lightlyActiveMinutes" | "sedentaryMinutes") =>
    Math.round(mean(days.map((r) => r[k] as number)));
  return { very: m("veryActiveMinutes"), fairly: m("fairlyActiveMinutes"), lightly: m("lightlyActiveMinutes"), sedentary: m("sedentaryMinutes") };
}

// ---------- Trend (daily, with 7-day rolling average) ----------

export function computeTrend(all: DailyRecord[], f: Filter): TrendPoint[] {
  const rs = applyFilter(all, f);
  const byDate = [...groupBy(rs, (r) => r.date).entries()].sort(([a], [b]) => a.localeCompare(b));

  const points: TrendPoint[] = byDate.map(([date, day]) => ({
    date,
    avgSteps: Math.round(avg(day.map((r) => r.steps)) ?? 0),
    rolling7: null,
    avgSleepHours: (() => {
      const s = avg(day.map((r) => r.sleepHours));
      return s === null ? null : round(s, 2);
    })(),
    compliancePct: compliance(day),
    users: new Set(day.map((r) => r.userId)).size,
  }));

  for (let i = 0; i < points.length; i++) {
    const window = points.slice(Math.max(0, i - 6), i + 1);
    if (window.length >= 4) points[i].rolling7 = Math.round(mean(window.map((p) => p.avgSteps)));
  }
  return points;
}

// ---------- Heatmap: users x days, steps relative to target ----------

export function computeHeatmap(all: DailyRecord[], f: Filter, maxDays = 35, maxUsers = 60): HeatRow[] {
  const rs = applyFilter(all, f);
  const { min, max } = dateRange(rs);
  if (!min || !max) return [];
  // Show only the selected range (up to maxDays), not empty columns before it.
  const span = Math.min(maxDays, daysBetween(min, max) + 1);
  const days: string[] = [];
  for (let i = span - 1; i >= 0; i--) days.push(addDays(max, -i));
  const from = days[0];

  const byUser = groupBy(
    rs.filter((r) => r.date >= from),
    (r) => r.userId,
  );
  const rows: HeatRow[] = [...byUser.entries()].map(([userId, urs]) => {
    const byDay = new Map(urs.map((r) => [r.date, r]));
    return {
      userId,
      compliancePct: compliance(urs),
      cells: days.map((date) => {
        const r = byDay.get(date);
        return {
          date,
          steps: r ? r.steps : null,
          ratio: r ? round(r.steps / config.targetSteps, 2) : null,
        };
      }),
    };
  });
  return rows.sort((a, b) => a.compliancePct - b.compliancePct).slice(0, maxUsers);
}

// ---------- Per-user summary list ----------

export function computeUsers(all: DailyRecord[], openAlertsByUser: Map<string, number>): UserSummary[] {
  return [...groupBy(all, (r) => r.userId).entries()]
    .map(([userId, urs]) => ({
      userId,
      days: urs.length,
      avgSteps: Math.round(avg(urs.map((r) => r.steps)) ?? 0),
      compliancePct: compliance(urs),
      lastDate: dateRange(urs).max!,
      openAlerts: openAlertsByUser.get(userId) ?? 0,
    }))
    .sort((a, b) => a.userId.localeCompare(b.userId, undefined, { numeric: true }));
}
