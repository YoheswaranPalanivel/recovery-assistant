import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ActionKind, ActionSummary, ContactAction, DailyRecord, MemberAction, Outcome, TodayView } from "@shared/types";
import { config } from "../config.js";
import { addDays, round } from "../analytics/metrics.js";

/**
 * What health workers did (call, visit, plan sent, device check) and whether the
 * member became more active afterwards. Kept in its own small file next to the snapshot.
 */
const FILE = path.resolve(import.meta.dirname, "../../data/actions.json");
let actions: ContactAction[] = [];

function load() {
  if (!config.persistData || !fs.existsSync(FILE)) return;
  try {
    actions = JSON.parse(fs.readFileSync(FILE, "utf8")) as ContactAction[];
  } catch {
    console.error("[actions] could not read actions.json, starting empty");
  }
}
function save() {
  if (!config.persistData) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(actions));
  fs.renameSync(`${FILE}.tmp`, FILE);
}
load();

export function recordAction(a: { userId: string; kind: ActionKind; note: string; followUp: string | null; by: string; dataDate: string }): ContactAction {
  const action: ContactAction = { id: randomUUID(), at: new Date().toISOString(), ...a };
  actions.unshift(action);
  if (actions.length > 2000) actions.length = 2000;
  save();
  return action;
}

export function clearActions() {
  actions = [];
  save();
}

const UP = 0.1; // 10% more daily steps counts as "more active"

/** Average daily steps in the 3 days before contact vs up to 3 days after. */
export function outcomeOf(a: ContactAction, recs: DailyRecord[]): Outcome {
  const byDate = new Map(recs.map((r) => [r.date, r.steps]));
  const avg = (dates: string[]) => {
    const v = dates.map((d) => byDate.get(d)).filter((x): x is number => x !== undefined);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
  };
  const before = avg([0, -1, -2].map((i) => addDays(a.dataDate, i)));
  const afterDates = [1, 2, 3].map((i) => addDays(a.dataDate, i)).filter((d) => byDate.has(d));
  const after = avg(afterDates);
  if (!afterDates.length || before === null || after === null)
    return { status: "waiting", beforeSteps: before, afterSteps: after, changePct: null, daysAfter: afterDates.length };
  const change = before > 0 ? round(((after - before) / before) * 100, 0) : null;
  const better = before === 0 ? after > 0 : after >= before * (1 + UP);
  return { status: better ? "more_active" : "no_change", beforeSteps: before, afterSteps: after, changePct: change, daysAfter: afterDates.length };
}

export function actionsFor(userId: string, recs: DailyRecord[]): MemberAction[] {
  return actions.filter((a) => a.userId === userId).map((a) => ({ ...a, outcome: outcomeOf(a, recs) }));
}

/** Adds each member's latest contact and an overall "did it help?" summary to the Today view. */
export function withActions(view: TodayView, records: DailyRecord[], names: Map<string, string>): TodayView {
  const byUser = new Map<string, DailyRecord[]>();
  for (const r of records) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r);

  const latest = new Map<string, MemberAction>();
  for (const a of actions) if (!latest.has(a.userId)) latest.set(a.userId, { ...a, outcome: outcomeOf(a, byUser.get(a.userId) ?? []) });

  const summary: ActionSummary = { contacted: latest.size, moreActive: 0, noChange: 0, waiting: 0, followUps: [] };
  for (const a of latest.values()) {
    if (a.outcome.status === "more_active") summary.moreActive++;
    else if (a.outcome.status === "no_change") summary.noChange++;
    else summary.waiting++;
    if (a.followUp) summary.followUps.push({ userId: a.userId, name: names.get(a.userId) ?? a.userId, kind: a.kind, date: a.followUp });
  }
  summary.followUps.sort((x, y) => x.date.localeCompare(y.date));

  return {
    ...view,
    priorities: view.priorities.map((m) => ({ ...m, lastAction: latest.get(m.profile.userId) ?? null })),
    actions: summary,
  };
}