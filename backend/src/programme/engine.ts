import { mean } from "simple-statistics";
import type { DailyRecord, DayDot, GoalProgress, MemberDetail, MemberProfile, MemberStatus, MemberWeek, TodayView, WeekSummary } from "@shared/types";
import { config } from "../config.js";
import { addDays, dateRange, groupBy, round } from "../analytics/metrics.js";
import { profilesFor } from "./profiles.js";

const P = config.programme;

/** Moderate + vigorous minutes for a day (Fitbit very + fairly), or the generic active minutes. */
const activeMins = (r: DailyRecord) =>
  r.veryActiveMinutes != null && r.fairlyActiveMinutes != null ? r.veryActiveMinutes + r.fairlyActiveMinutes : (r.activeMinutes ?? 0);

/**
 * Personal weekly target: the member's usual weekly active minutes + 10%,
 * never below the floor, never above the programme goal (lower cap for limited mobility).
 */
export function weeklyTarget(usualWeekly: number, profile: MemberProfile) {
  const cap = profile.mobility === "limited" ? P.limitedMobilityCap : P.weeklyActiveGoal;
  const raw = Math.round((usualWeekly * (1 + P.weeklyIncrease)) / 5) * 5;
  return Math.min(cap, Math.max(P.minWeeklyTarget, raw));
}

const RANK: DayDot["level"][] = ["none", "low", "some", "good", "great"];

/** A day's colour: brisk minutes OR steps against the personal step goal, whichever is better. */
function level(r: DailyRecord | null, stepGoal: number): DayDot["level"] {
  if (r === null) return "none";
  const m = activeMins(r);
  const byMins: DayDot["level"] = m < 10 ? "low" : m < P.activeDayMinutes ? "some" : m < 45 ? "good" : "great";
  const bySteps: DayDot["level"] = stepGoal > 0 && r.steps >= stepGoal ? "good" : stepGoal > 0 && r.steps >= stepGoal * 0.7 ? "some" : "low";
  return RANK.indexOf(byMins) >= RANK.indexOf(bySteps) ? byMins : bySteps;
}

/** One member's last 7 completed days against their personal goals, with a status and plain reasons. */
export function memberWeek(recs: DailyRecord[], profile: MemberProfile, asOf: string): MemberWeek {
  const byDate = new Map(recs.map((r) => [r.date, r]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(asOf, i - 6));
  const week = days.map((d) => byDate.get(d) ?? null);
  const tracked = week.filter((r): r is DailyRecord => r !== null);

  // usual level: the 28 days before this week (needs at least 7 days, else whatever exists)
  const before = recs.filter((r) => r.date < days[0] && r.date >= addDays(days[0], -28));
  const base = before.length >= 7 ? before : recs;
  const usualDailyActive = base.length ? mean(base.map(activeMins)) : 0;
  const usualSteps = base.length ? mean(base.map((r) => r.steps)) : 0;

  const target = weeklyTarget(usualDailyActive * 7, profile);
  const daysGoal = profile.mobility === "limited" ? P.activeDaysGoal - 1 : P.activeDaysGoal;
  const stepGoal = Math.round((usualSteps * (1 + P.weeklyIncrease)) / 100) * 100;

  const weekActive = tracked.reduce((t, r) => t + activeMins(r), 0);
  const activeDays = tracked.filter((r) => activeMins(r) >= P.activeDayMinutes).length;
  const sleeps = tracked.map((r) => r.sleepHours).filter((s): s is number => s !== null);
  const avgSleep = sleeps.length ? round(mean(sleeps), 1) : null;
  const avgSteps = tracked.length ? Math.round(mean(tracked.map((r) => r.steps))) : null;

  const goals: GoalProgress[] = [
    { key: "active_minutes", label: "Active minutes", value: weekActive, target, unit: "min" },
    { key: "active_days", label: "Active days", value: activeDays, target: daysGoal, unit: "days" },
    { key: "sleep", label: "Sleep", value: avgSleep, target: P.sleepGoalHours, unit: "h" },
    { key: "steps", label: "Daily steps", value: avgSteps, target: stepGoal, unit: "steps" },
  ];

  // ---- status, most serious first; every reason quotes the figure behind it
  const reasons: string[] = [];
  const last3 = week.slice(-3);
  const noData = last3.filter((r) => r === null).length;
  // An inactive day needs BOTH little brisk activity AND low steps: some people walk a lot
  // without logging "active minutes", and they shouldn't be flagged.
  const lowSteps = Math.max(2000, usualSteps * 0.4);
  const inactiveDay = (r: DailyRecord | null) => r !== null && activeMins(r) < 10 && r.steps < lowSteps;
  const inactive3 = last3.every((r) => r === null || inactiveDay(r)) && last3.some((r) => r !== null);
  const shortSleepNights = last3.filter((r) => r?.sleepHours != null && r.sleepHours < 6).length;
  const yesterday = week[6];
  const metWeeklyGoal = weekActive >= target;
  // walking counts too: meeting the personal step goal means they're not slipping
  const walkingOk = avgSteps !== null && avgSteps >= stepGoal;

  let status: MemberStatus = "on_track";
  if (noData === 3) {
    // no data is a device problem first, not a health judgement
    status = "check_device";
    reasons.push("No data for 3 days: check the watch is worn and syncing");
  } else if (inactive3 && !metWeeklyGoal) {
    status = "needs_support";
    reasons.push("3 days with almost no activity");
  } else if (!metWeeklyGoal && !walkingOk && weekActive < target * 0.7) {
    status = "slipping";
    reasons.push(`${weekActive} of ${target} active minutes this week`);
    if (avgSteps !== null) reasons.push(`${avgSteps.toLocaleString("en-IN")} daily steps, goal ${stepGoal.toLocaleString("en-IN")}`);
  } else if (!metWeeklyGoal && !walkingOk && avgSteps !== null && usualSteps > 0 && avgSteps < usualSteps * 0.7) {
    status = "slipping";
    reasons.push(`Steps ${Math.round((1 - avgSteps / usualSteps) * 100)}% below their usual`);
  } else if (yesterday?.sleepHours != null && yesterday.sleepHours < 5 && activeMins(yesterday) >= 45) {
    status = "needs_rest";
    reasons.push(`Only ${round(yesterday.sleepHours, 1)} h sleep after a very active day`);
  }
  if (shortSleepNights >= 2) reasons.push(`Slept under 6 h on ${shortSleepNights} of the last 3 nights`);
  if (status === "on_track")
    reasons.unshift(
      metWeeklyGoal || !walkingOk
        ? `${weekActive} of ${target} active minutes this week`
        : `Walking well: ${avgSteps!.toLocaleString("en-IN")} daily steps, goal ${stepGoal.toLocaleString("en-IN")}`,
    );

  return {
    profile,
    status,
    reasons,
    goals,
    week: days.map((date, i) => ({ date, level: level(week[i], stepGoal) })),
    weekStart: days[0],
    weekEnd: asOf,
    metWeeklyGoal,
  };
}

const ORDER: Record<MemberStatus, number> = { needs_support: 0, slipping: 1, check_device: 2, needs_rest: 3, on_track: 4 };


/** Every member's week, most urgent first. */
export function allMemberWeeks(records: DailyRecord[]): MemberWeek[] {
  const { max } = dateRange(records);
  if (!max) return [];
  const byUser = groupBy(records, (r) => r.userId);
  const profiles = profilesFor([...byUser.keys()]);
  return [...byUser]
    .map(([userId, recs]) => memberWeek(recs, profiles.get(userId)!, max))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.profile.name.localeCompare(b.profile.name));
}

/** One member's journey: this week, the last 4 weeks, and their current streak. */
export function memberDetail(recs: DailyRecord[], profile: MemberProfile, asOf: string): Omit<MemberDetail, "actions"> {
  const member = memberWeek(recs, profile, asOf);
  const history: WeekSummary[] = [];
  for (let k = 3; k >= 0; k--) {
    const end = addDays(asOf, -7 * k);
    if (!recs.some((r) => r.date <= end && r.date > addDays(end, -7))) continue;
    const w = k === 0 ? member : memberWeek(recs, profile, end);
    const inWeek = recs.filter((r) => r.date > addDays(end, -7) && r.date <= end);
    const sleeps = inWeek.map((r) => r.sleepHours).filter((x): x is number => x !== null);
    history.push({
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      activeMinutes: w.goals[0].value ?? 0,
      target: w.goals[0].target,
      met: w.metWeeklyGoal,
      avgSteps: inWeek.length ? Math.round(mean(inWeek.map((r) => r.steps))) : null,
      avgSleep: sleeps.length ? round(mean(sleeps), 1) : null,
      trackedDays: inWeek.length,
    });
  }
  // streak: days in a row, up to the latest day, that were active by minutes or met the step goal
  const byDate = new Map(recs.map((r) => [r.date, r]));
  const stepGoal = member.goals[3].target;
  let streak = 0;
  for (let d = asOf; ; d = addDays(d, -1)) {
    const r = byDate.get(d);
    if (!r || !(activeMins(r) >= P.activeDayMinutes || (stepGoal > 0 && r.steps >= stepGoal))) break;
    streak++;
  }
  return { member, history, streak };
}


/** Everything the health worker's Today page needs. */
export function todayView(records: DailyRecord[]): TodayView {
  const { max } = dateRange(records);
  const counts: TodayView["counts"] = { needs_support: 0, slipping: 0, check_device: 0, needs_rest: 0, on_track: 0 };
  if (!max) return { asOf: null, counts, priorities: [], community: { metGoalPct: 0, previousMetGoalPct: null, members: 0 } };

  const byUser = groupBy(records, (r) => r.userId);
  const profiles = profilesFor([...byUser.keys()]);
  const weeks: MemberWeek[] = [];
  let metPrev = 0;
  let hadPrev = 0;
  for (const [userId, recs] of byUser) {
    const w = memberWeek(recs, profiles.get(userId)!, max);
    weeks.push(w);
    counts[w.status]++;
    // same calculation for the week before, for the community trend
    if (recs.some((r) => r.date <= addDays(max, -7))) {
      hadPrev++;
      if (memberWeek(recs, profiles.get(userId)!, addDays(max, -7)).metWeeklyGoal) metPrev++;
    }
  }
  const met = weeks.filter((w) => w.metWeeklyGoal).length;
  return {
    asOf: max,
    counts,
    priorities: weeks
      .filter((w) => w.status !== "on_track")
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.goals[0].value! / a.goals[0].target - b.goals[0].value! / b.goals[0].target),
    community: {
      metGoalPct: Math.round((met / weeks.length) * 100),
      previousMetGoalPct: hadPrev ? Math.round((metPrev / hadPrev) * 100) : null,
      members: weeks.length,
    },
  };
}