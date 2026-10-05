import { linearRegression, mean } from "simple-statistics";
import type { DailyRecord, LlmContext, MessageType } from "@shared/types";
import { config } from "../config.js";
import { detectAnomalies } from "../analytics/anomalies.js";
import { addDays, applyFilter, avg, compliance, dateRange, daysBetween, round } from "../analytics/metrics.js";

/**
 * Everything here is calculated by code. The LLM receives only this small object —
 * never raw rows — and is not allowed to change any number in it.
 */
export function buildContext(
  all: DailyRecord[],
  userId: string,
  opts: { from?: string; to?: string; messageType?: MessageType } = {},
): LlmContext | null {
  const history = applyFilter(all, { userId });
  if (!history.length) return null;

  // Default period: the user's last 14 days of data.
  const { max } = dateRange(history);
  const to = opts.to ?? max!;
  const from = opts.from ?? addDays(to, -13);
  const period = applyFilter(history, { from, to }).sort((a, b) => a.date.localeCompare(b.date));
  if (!period.length) return null;

  const len = daysBetween(from, to) + 1;
  const prev = applyFilter(history, { from: addDays(from, -len), to: addDays(from, -1) });

  const avgSteps = mean(period.map((r) => r.steps));
  const prevAvg = prev.length ? mean(prev.map((r) => r.steps)) : null;
  const comp = compliance(period);
  const prevComp = prev.length ? compliance(prev) : null;

  const stepsChange = prevAvg && prevAvg > 0 ? Math.round(((avgSteps - prevAvg) / prevAvg) * 100) : null;

  // Trend: compared with the previous equal-length period (±5%) when it exists,
  // otherwise the slope of daily steps inside the period. One clear definition,
  // so "trend" never contradicts the change % shown next to it.
  let trend: LlmContext["trend"] = "stable";
  if (stepsChange !== null) {
    if (stepsChange >= 5) trend = "increasing";
    else if (stepsChange <= -5) trend = "decreasing";
  } else if (period.length >= 4 && avgSteps > 0) {
    const t0 = Date.parse(`${period[0].date}T00:00:00Z`);
    const { m } = linearRegression(period.map((r) => [(Date.parse(`${r.date}T00:00:00Z`) - t0) / 86_400_000, r.steps]));
    const relPerDay = (m / avgSteps) * 100;
    if (relPerDay > 1.5) trend = "increasing";
    else if (relPerDay < -1.5) trend = "decreasing";
  }

  const alerts = detectAnomalies(all, { userId, from, to });
  const alertLabels = [...new Set(alerts.map((a) => a.type))].map(
    (t) =>
      ({
        activity_drop: "activity below recent baseline",
        low_sleep: "sleep below usual",
        compliance_streak: `target missed ${config.rules.missedTargetStreak}+ days in a row`,
        recovery_drop: "recovery score below baseline",
      })[t],
  );

  const sleep = avg(period.map((r) => r.sleepHours));
  const active = avg(period.map((r) => r.activeMinutes));

  const ctx: LlmContext = {
    user: "anonymous", // not even the pseudonym is sent to the LLM
    period: `${from} to ${to} (${len} days)`,
    days_tracked: period.length,
    avg_steps: Math.round(avgSteps),
    target_steps: config.targetSteps,
    compliance_pct: Math.round(comp),
    previous_compliance_pct: prevComp === null ? null : Math.round(prevComp),
    days_on_target_change:
      prevComp === null ? null : Math.round(comp) - Math.round(prevComp) >= 3 ? "improved" : Math.round(comp) - Math.round(prevComp) <= -3 ? "declined" : "unchanged",
    steps_change_pct: stepsChange,
    avg_sleep_hours: sleep === null ? null : round(sleep, 1),
    avg_active_minutes: active === null ? null : Math.round(active),
    trend,
    alerts: alertLabels,
    message_type: "general_insight",
  };
  ctx.message_type = opts.messageType ?? chooseMessageType(ctx, alerts.some((a) => a.severity === "attention" && a.date >= addDays(to, -2)));
  return ctx;
}

/** Message type is decided by rules, not by the LLM. */
function chooseMessageType(c: LlmContext, recentAttention: boolean): MessageType {
  if (recentAttention) return "attention_alert";
  if (c.previous_compliance_pct !== null && c.compliance_pct - c.previous_compliance_pct >= 10) return "progress_update";
  if (c.trend === "increasing") return "encouragement";
  if (c.compliance_pct < 50) return "reminder";
  return "general_insight";
}
