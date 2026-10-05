import { mean } from "simple-statistics";
import type { Alert, DailyRecord } from "@shared/types";
import { config } from "../config.js";
import { applyFilter, groupBy, round, type Filter } from "./metrics.js";

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * Transparent rules only. Each alert carries the exact values that triggered it,
 * so the reviewer (and the LLM) can see why it fired.
 * Baseline = the user's own average over the previous `baselineDays` tracked days.
 */
export function detectAnomalies(all: DailyRecord[], f: Filter): Alert[] {
  const R = config.rules;
  // Use the user's full history for baselines, then keep alerts inside the filter.
  const scoped = applyFilter(all, { userId: f.userId });
  const alerts: Alert[] = [];

  for (const [userId, recs] of groupBy(scoped, (r) => r.userId)) {
    const rs = [...recs].sort((a, b) => a.date.localeCompare(b.date));
    let missedStreak = 0;

    rs.forEach((r, i) => {
      const history = rs.slice(Math.max(0, i - R.baselineDays), i);
      const inRange = (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to);

      // Streak counting must run on every day, even outside the range.
      missedStreak = r.steps < config.targetSteps ? missedStreak + 1 : 0;
      if (!inRange) return;

      const push = (a: Omit<Alert, "id" | "userId" | "date">) =>
        alerts.push({ id: `${userId}-${r.date}-${a.type}`, userId, date: r.date, ...a });

      // Rule 1: activity well below the user's own recent baseline
      if (history.length >= R.minBaselineDays) {
        const base = mean(history.map((h) => h.steps));
        const dropPct = base > 0 ? ((base - r.steps) / base) * 100 : 0;
        if (base >= 1000 && dropPct >= R.activityDropPct) {
          push({
            type: "activity_drop",
            severity: dropPct >= 60 ? "attention" : "watch",
            title: `Steps ${round(dropPct, 0)}% below recent baseline`,
            evidence: [
              { label: "Steps that day", value: fmt(r.steps) },
              { label: `${history.length}-day baseline`, value: fmt(base) },
              { label: "Rule", value: `drop ≥ ${R.activityDropPct}%` },
            ],
          });
        }
      }

      // Rule 2: sleep well below baseline, or below an absolute floor
      if (r.sleepHours !== null) {
        const sleepHist = history.map((h) => h.sleepHours).filter((s): s is number => s !== null);
        const base = sleepHist.length >= 5 ? mean(sleepHist) : null;
        const belowBase = base !== null && base - r.sleepHours >= R.sleepDropHours;
        const belowFloor = r.sleepHours < R.minSleepHours;
        if (belowBase || belowFloor) {
          push({
            type: "low_sleep",
            severity: belowBase && belowFloor ? "attention" : "watch",
            title: belowBase
              ? `Sleep ${round(base! - r.sleepHours, 1)} h below usual`
              : `Sleep under ${R.minSleepHours} h`,
            evidence: [
              { label: "Sleep that night", value: `${round(r.sleepHours, 1)} h` },
              ...(base !== null ? [{ label: "Usual sleep", value: `${round(base, 1)} h` }] : []),
              {
                label: "Rule",
                value: belowBase ? `≥ ${R.sleepDropHours} h below usual` : `< ${R.minSleepHours} h`,
              },
            ],
          });
        }
      }

      // Rule 3: target missed several days in a row (fires once, when the streak reaches N)
      if (missedStreak === R.missedTargetStreak) {
        const streakDays = rs.slice(i - R.missedTargetStreak + 1, i + 1);
        push({
          type: "compliance_streak",
          severity: "attention",
          title: `Target missed ${R.missedTargetStreak} days in a row`,
          evidence: [
            { label: "Avg steps in streak", value: fmt(mean(streakDays.map((d) => d.steps))) },
            { label: "Daily target", value: fmt(config.targetSteps) },
            { label: "Rule", value: `${R.missedTargetStreak} consecutive misses` },
          ],
        });
      }

      // Rule 4: recovery score fall (only when the dataset actually has it)
      if (r.recoveryScore !== null) {
        const recHist = history.map((h) => h.recoveryScore).filter((s): s is number => s !== null);
        if (recHist.length >= R.minBaselineDays) {
          const base = mean(recHist);
          if (base - r.recoveryScore >= R.recoveryDropPoints) {
            push({
              type: "recovery_drop",
              severity: "attention",
              title: `Recovery score down ${round(base - r.recoveryScore, 0)} points`,
              evidence: [
                { label: "Score that day", value: String(r.recoveryScore) },
                { label: "Baseline", value: String(round(base, 0)) },
                { label: "Rule", value: `fall ≥ ${R.recoveryDropPoints} points` },
              ],
            });
          }
        }
      }
    });
  }

  return alerts.sort((a, b) => b.date.localeCompare(a.date) || a.userId.localeCompare(b.userId));
}
