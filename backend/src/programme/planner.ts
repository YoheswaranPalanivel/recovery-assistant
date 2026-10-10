import type { CarePlan, MemberWeek, PlanAction, Weekday } from "@shared/types";
import { callModel, llmModel } from "../llm/llmClient.js";
import { checkNumbers, checkWords } from "../llm/numberGuard.js";

/**
 * APPROVED ACTIVITY MENU. In a real programme the health team owns this list.
 * The AI may only choose from it, and never above an item's session limit.
 */
const MENU = [
  { id: "brisk_walk", label: "Brisk walk", ta: "வேகமான நடை", maxMinutes: 30, limitedOk: false },
  { id: "short_walk", label: "Short walk", ta: "சிறு நடை", maxMinutes: 20, limitedOk: true },
  { id: "walk_after_meal", label: "Walk after a meal", ta: "சாப்பாட்டுக்குப் பின் நடை", maxMinutes: 15, limitedOk: true },
  { id: "yoga", label: "Gentle yoga", ta: "எளிய யோகா", maxMinutes: 25, limitedOk: true },
  { id: "chair_exercises", label: "Chair exercises", ta: "நாற்காலி பயிற்சி", maxMinutes: 15, limitedOk: true },
  { id: "stretching", label: "Stretching", ta: "உடல் நீட்சி பயிற்சி", maxMinutes: 10, limitedOk: true },
] as const;

const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_ATTEMPTS = 3;

const SYSTEM = `You are a supportive coach in a community diabetes programme. You plan one week of gentle activity for a member and write a short message for their health worker to send.
Rules:
- Reply with JSON only: {"actions":[{"activity":"<id>","minutes":<n>,"days":["Mon",...],"when":"<time of day>"}],"message":"<to the member, in their language>","message_en":"<the same message in English>","worker_note":"<one line for the health worker, in English>"}.
- If "language" is "Tamil", write "message" in simple, everyday spoken Tamil (Tamil script) and "message_en" as its faithful English translation. Otherwise write both in English.
- Write every number with the digits 0-9, also in Tamil (for example "15 நிமிடம்"); never Tamil numerals or numbers in words.
- Choose activities ONLY from "allowed_activities", never above their "max_minutes" per session.
- 1 to 3 actions. Total minutes (minutes x number of days, summed) must be between plan_min_minutes and plan_max_minutes.
- Respect "prefers" and "best_time" where you can. If status is "needs_rest", plan light activity only.
- If "feeling_unwell" is true, plan only gentle activity, tell them to rest until they feel better, and in worker_note suggest a call to check how they are.
- In the message and note, use only numbers that appear in the context or in your own plan. Don't calculate anything else.
- The message: 2 short, warm sentences in plain, simple words, no guilt. Never give medical, medication or diet advice. Don't mention the app, data or the system.`;

type RawPlan = { actions?: { activity?: string; minutes?: number; days?: string[]; when?: string }[]; message?: string; message_en?: string; worker_note?: string };

/** Medical and medication words in Tamil: the English list in numberGuard can't see these. */
const TA_BLOCKED = ["மருத்துவர்", "டாக்டர்", "மருந்து", "மாத்திரை", "இன்சுலின்", "சிகிச்சை", "நோய்"];
const tamilWords = (t: string) => TA_BLOCKED.filter((w) => t.includes(w));
/** Tamil numerals (௦-௯) would slip past the number check, so they are not allowed. */
const hasTamilNumerals = (t: string) => /[\u0BE6-\u0BEF]/.test(t);

function parse(text: string): RawPlan | null {
  const t = text.replace(/```json|```/g, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1)) as RawPlan;
  } catch {
    return null;
  }
}

/** Everything the AI receives: calculated figures and fixed labels, no name or ID. */
export function planContext(m: MemberWeek) {
  const g = Object.fromEntries(m.goals.map((x) => [x.key, x]));
  const allowed = MENU.filter((a) => (m.profile.mobility === "normal" || a.limitedOk) && !(m.checkIn?.mood === "not_well" && a.id === "brisk_walk"));
  const target = g.active_minutes.target;
  // a rest week, or a member who says they're unwell, gets about half the usual amount, gentle only
  const unwell = m.checkIn?.mood === "not_well";
  const planTarget = m.status === "needs_rest" || unwell ? Math.round(target / 2 / 5) * 5 : target;
  return {
    user: "anonymous",
    age_band: m.profile.ageBand,
    mobility: m.profile.mobility,
    prefers: m.profile.prefers,
    language: m.profile.language,
    best_time: /morning/.test(m.profile.prefers) ? "morning" : /evening|dinner|meal/.test(m.profile.prefers) ? "evening" : "any",
    status: m.status,
    feeling_unwell: unwell,
    reasons: m.reasons,
    active_minutes_last_week: g.active_minutes.value,
    weekly_target_minutes: target,
    active_days_last_week: g.active_days.value,
    active_days_target: g.active_days.target,
    avg_daily_steps: g.steps.value,
    step_goal: g.steps.target,
    avg_sleep_hours: g.sleep.value,
    plan_min_minutes: Math.round(planTarget * 0.8),
    plan_max_minutes: Math.round(planTarget * 1.1),
    allowed_activities: allowed.map((a) => ({ id: a.id, max_minutes: a.maxMinutes })),
  };
}
type Ctx = ReturnType<typeof planContext>;

/** Checks the AI's plan against the code's limits. Returns problems in plain words. */
function validate(raw: RawPlan, ctx: Ctx): { actions: PlanAction[]; total: number; problems: string[] } {
  const problems: string[] = [];
  const allowed = new Map<string, number>(ctx.allowed_activities.map((a) => [a.id, a.max_minutes]));
  const actions: PlanAction[] = [];
  const list = Array.isArray(raw.actions) ? raw.actions : [];
  if (list.length < 1 || list.length > 3) problems.push("plan must have 1 to 3 actions");
  for (const a of list) {
    const max = allowed.get(a.activity ?? "");
    const days = (a.days ?? []).filter((d): d is Weekday => DAYS.includes(d as Weekday));
    if (max === undefined) problems.push(`activity "${a.activity}" is not on the approved menu`);
    else if (!Number.isInteger(a.minutes) || a.minutes! < 5 || a.minutes! > max) problems.push(`${a.activity}: minutes must be 5 to ${max}`);
    if (!days.length || days.length !== (a.days ?? []).length || new Set(days).size !== days.length) problems.push(`${a.activity}: invalid days`);
    if (max !== undefined)
      actions.push({ activity: a.activity!, label: MENU.find((x) => x.id === a.activity)!.label, minutes: a.minutes ?? 0, days, when: String(a.when ?? "").slice(0, 40) });
  }
  const total = actions.reduce((t, a) => t + a.minutes * a.days.length, 0);
  if (total < ctx.plan_min_minutes || total > ctx.plan_max_minutes)
    problems.push(`total ${total} minutes must be between ${ctx.plan_min_minutes} and ${ctx.plan_max_minutes}`);
  if (!raw.message || raw.message.length > 400) problems.push("message missing or too long");
  if (!raw.message_en || raw.message_en.length > 400) problems.push("message_en missing or too long");
  if (raw.message && hasTamilNumerals(raw.message)) problems.push("use the digits 0-9, not Tamil numerals");
  return { actions, total, problems };
}

/** Deterministic plan used when the AI is unavailable or its plan fails the checks. */
function templatePlan(ctx: Ctx): { actions: PlanAction[]; total: number; message: string; messageEnglish: string; note: string } {
  const pref = ctx.allowed_activities.find((a) => (/walk/.test(ctx.prefers) ? a.id.includes("walk") : ctx.prefers.includes(a.id.split("_")[0])));
  const pick = pref ?? ctx.allowed_activities[0];
  let sessions = Math.min(7, Math.max(3, ctx.active_days_target));
  const per = Math.min(pick.max_minutes, Math.max(5, Math.ceil(((ctx.plan_min_minutes + ctx.plan_max_minutes) / 2 / sessions) / 5) * 5));
  // if one session is capped short, add days so the week still reaches the minimum
  sessions = Math.min(7, Math.max(sessions, Math.ceil(ctx.plan_min_minutes / per)));
  const days = (["Mon", "Wed", "Fri", "Sat", "Tue", "Thu", "Sun"] as Weekday[]).slice(0, sessions);
  const label = MENU.find((x) => x.id === pick.id)!.label;
  const when = ctx.best_time === "any" ? "at a time that suits you" : `in the ${ctx.best_time}`;
  const english = `This week, try a ${label.toLowerCase()} of ${per} minutes on ${days.length} days, ${when}. Small steps every week make a real difference.`;
  const ta = MENU.find((x) => x.id === pick.id)!.ta;
  const whenTa = ctx.best_time === "morning" ? "காலையில்" : ctx.best_time === "evening" ? "மாலையில்" : "உங்களுக்கு வசதியான நேரத்தில்";
  const tamil = `இந்த வாரம் ${days.length} நாள், ${whenTa} ${per} நிமிடம் ${ta} செய்து பாருங்கள். ஒவ்வொரு சின்ன முயற்சியும் பெரிய மாற்றம் தரும்.`;
  return {
    actions: [{ activity: pick.id, label, minutes: per, days, when }],
    total: per * days.length,
    message: ctx.language === "Tamil" ? tamil : english,
    messageEnglish: english,
    note: `Suggested plan: ${label.toLowerCase()}, ${per} minutes on ${days.length} days.`,
  };
}

export async function generatePlan(m: MemberWeek): Promise<CarePlan> {
  const ctx = planContext(m);
  const base = { userId: m.profile.userId, createdAt: new Date().toISOString(), targetMinutes: ctx.plan_max_minutes, context: ctx as Record<string, unknown> };
  let problems: string[] = [];

  if (callModel) {
    let feedback = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const text = await callModel(SYSTEM, `Context:\n${JSON.stringify(ctx, null, 2)}${feedback ? `\n\nYour previous plan was rejected: ${feedback} Fix it.` : ""}`);
        const raw = parse(text);
        if (!raw) {
          problems = ["reply was not valid JSON"];
        } else {
          const v = validate(raw, ctx);
          problems = v.problems;
          if (!problems.length) {
            // numbers in the words may come from the context or from the validated plan itself
            const planNumbers = { plan: v.actions.map((a) => [a.minutes, a.days.length]), total: v.total };
            const nums = checkNumbers({ ...ctx, ...planNumbers }, raw.message ?? "", raw.message_en ?? "", raw.worker_note ?? "");
            const words = [...checkWords(raw.message ?? "", raw.message_en ?? "", raw.worker_note ?? ""), ...tamilWords(raw.message ?? "")];
            if (!nums.passed) problems.push(`numbers not in the context or plan: ${nums.unknownNumbers.join(", ")}`);
            if (words.length) problems.push(`words not allowed: ${words.join(", ")}`);
          }
          if (!problems.length) {
            return {
              ...base,
              actions: v.actions,
              totalMinutes: v.total,
              message: raw.message!.trim(),
              messageEnglish: raw.message_en!.trim(),
              language: ctx.language,
              workerNote: (raw.worker_note ?? "").trim(),
              source: "llm",
              model: llmModel(),
              check: { passed: true, attempts: attempt, problems: [] },
            };
          }
        }
        console.warn(`[llm] plan attempt ${attempt} rejected: ${problems.join("; ")}`);
        feedback = problems.join("; ") + ".";
      } catch (e) {
        console.warn(`[llm] plan request failed: ${(e as Error).message}`);
        problems = ["AI unavailable"];
        break;
      }
    }
  }

  const t = templatePlan(ctx);
  return {
    ...base,
    actions: t.actions,
    totalMinutes: t.total,
    message: t.message,
    messageEnglish: t.messageEnglish,
    language: ctx.language,
    workerNote: t.note,
    source: "template",
    model: null,
    check: { passed: false, attempts: callModel ? MAX_ATTEMPTS : 0, problems },
  };
}