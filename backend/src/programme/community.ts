import type { ActionSummary, CommunitySummary, CommunityView, CommunityWeek, DailyRecord, MemberStatus } from "@shared/types";
import { addDays, dateRange, groupBy } from "../analytics/metrics.js";
import { callModel, llmModel } from "../llm/llmClient.js";
import { checkNumbers, checkWords } from "../llm/numberGuard.js";
import { memberWeek } from "./engine.js";
import { profilesFor } from "./profiles.js";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** The programme lead's view: how the whole community is doing, week by week. */
export function communityView(records: DailyRecord[], actions: ActionSummary): CommunityView {
  const { max } = dateRange(records);
  const counts: Record<MemberStatus, number> = { needs_support: 0, slipping: 0, check_device: 0, needs_rest: 0, on_track: 0 };
  if (!max) return { asOf: null, members: 0, counts, weeks: [], goals: [], actions };

  const byUser = groupBy(records, (r) => r.userId);
  const profiles = profilesFor([...byUser.keys()]);

  // last 4 weeks: share of members (with data that week) who met their own weekly goal
  const weeks: CommunityWeek[] = [];
  for (let k = 3; k >= 0; k--) {
    const end = addDays(max, -7 * k);
    let n = 0;
    let met = 0;
    for (const [userId, recs] of byUser) {
      if (!recs.some((r) => r.date <= end && r.date > addDays(end, -7))) continue;
      n++;
      if (memberWeek(recs, profiles.get(userId)!, end).metWeeklyGoal) met++;
    }
    if (n) weeks.push({ weekStart: addDays(end, -6), weekEnd: end, members: n, metGoalPct: pct(met, n) });
  }

  // this week: status split and how many met each goal (only members with data for that goal)
  const tally = { active_minutes: [0, 0], active_days: [0, 0], sleep: [0, 0], steps: [0, 0] } as Record<string, [number, number]>;
  for (const [userId, recs] of byUser) {
    const w = memberWeek(recs, profiles.get(userId)!, max);
    counts[w.status]++;
    if (w.status === "check_device") continue;
    for (const g of w.goals) {
      if (g.value === null) continue;
      tally[g.key][1]++;
      if (g.value >= g.target) tally[g.key][0]++;
    }
  }
  const LABEL: Record<string, string> = { active_minutes: "Weekly active minutes", active_days: "Active days", sleep: "Sleep, 7 hours", steps: "Personal step goal" };
  const goals = Object.entries(tally).map(([key, [met, n]]) => ({ key: key as CommunityView["goals"][number]["key"], label: LABEL[key], metPct: pct(met, n), members: n }));

  return { asOf: max, members: byUser.size, counts, weeks, goals, actions };
}

const SYSTEM = `You write a short weekly update for the lead of a community diabetes programme.
Rules:
- Reply with JSON only: {"summary":"<3 or 4 sentences>"}.
- Use only numbers that appear in the context. Don't calculate new ones.
- Say what improved or slipped, where the health workers should focus, and one practical suggestion for the programme (for example a group walk or a device check drive).
- Plain, calm English. No medical advice. Don't mention the app or the data system.`;

/** AI summary for the programme lead, checked like every other AI output; template if it fails. */
export async function communitySummary(v: CommunityView): Promise<CommunitySummary> {
  const last = v.weeks.at(-1);
  const prev = v.weeks.at(-2);
  const ctx = {
    members: v.members,
    met_goal_pct_this_week: last?.metGoalPct ?? null,
    met_goal_pct_last_week: prev?.metGoalPct ?? null,
    direction: !last || !prev ? "unknown" : last.metGoalPct > prev.metGoalPct ? "improved" : last.metGoalPct < prev.metGoalPct ? "declined" : "unchanged",
    needs_support: v.counts.needs_support,
    slipping: v.counts.slipping,
    check_device: v.counts.check_device,
    needs_rest: v.counts.needs_rest,
    on_track: v.counts.on_track,
    goals_met_pct: Object.fromEntries(v.goals.map((g) => [g.key, g.metPct])),
    contacted: v.actions.contacted,
    more_active_after_contact: v.actions.moreActive,
  };
  let problems: string[] = [];
  if (callModel) {
    let feedback = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const text = await callModel(SYSTEM, `Context:\n${JSON.stringify(ctx, null, 2)}${feedback ? `\n\nYour previous answer was rejected: ${feedback} Fix it.` : ""}`);
        const t = text.replace(/```json|```/g, "");
        let summary = "";
        try {
          summary = String((JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)) as { summary?: string }).summary ?? "");
        } catch {
          /* handled below */
        }
        problems = [];
        if (!summary) problems.push("reply was not valid JSON with a summary");
        else {
          const nums = checkNumbers(ctx, summary);
          const words = checkWords(summary);
          if (!nums.passed) problems.push(`numbers not in the context: ${nums.unknownNumbers.join(", ")}`);
          if (words.length) problems.push(`words not allowed: ${words.join(", ")}`);
        }
        if (!problems.length) return { text: summary.trim(), source: "llm", model: llmModel(), check: { passed: true, attempts: attempt, problems: [] }, context: ctx };
        console.warn(`[llm] community summary attempt ${attempt} rejected: ${problems.join("; ")}`);
        feedback = problems.join("; ") + ".";
      } catch (e) {
        console.warn(`[llm] community summary failed: ${(e as Error).message}`);
        problems = ["AI unavailable"];
        break;
      }
    }
  }
  const trend =
    ctx.direction === "improved" ? `up from ${ctx.met_goal_pct_last_week}%` : ctx.direction === "declined" ? `down from ${ctx.met_goal_pct_last_week}%` : "about the same as last week";
  const text = `This week ${ctx.met_goal_pct_this_week ?? 0}% of members met their activity goal, ${trend}. ${ctx.needs_support + ctx.slipping} members need a call or a plan, and ${ctx.check_device} need a device check. ${ctx.contacted ? `Of ${ctx.contacted} member${ctx.contacted === 1 ? "" : "s"} contacted, ${ctx.more_active_after_contact} became more active afterwards.` : "No contacts have been recorded yet."}`;
  return { text, source: "template", model: null, check: { passed: false, attempts: callModel ? 3 : 0, problems }, context: ctx };
}