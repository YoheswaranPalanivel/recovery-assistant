import type { LlmContext, MessageType } from "@shared/types";

export const SYSTEM_PROMPT = `You are the writing layer of an activity and recovery analytics app.
The application has already calculated every metric. Your job is only to explain those results in plain language and write one short engagement message.

Rules:
- Use ONLY the numbers present in the JSON context. Copy them exactly as given.
- Never calculate, estimate, round, or derive new numbers (no differences, no "X steps short", no new percentages).
- If a value is null, that metric is not available in the dataset: do not mention or guess it.
- Address the person as "you". Never use or invent a name.
- No medical diagnosis or medical advice. Keep suggestions general and gentle (e.g. a short walk, a consistent bedtime).
- Neutral, supportive, never guilt-inducing.
- Say "days you met your target" instead of "compliance". Avoid technical words like "baseline" or "metric".
- Write step counts with thousands separators (e.g. 3,949).
- To say whether days on target went up or down, use only "days_on_target_change". Never call any figure higher or lower than before unless a field says so.
- If the trend and the alerts point different ways, say it plainly, e.g. "overall you are moving more, but there were a few recent dips".
- Never mention the app, the system, alerts being "flagged", or how the data was processed. Talk to the person, not about the software.
- "insight": 2-3 sentences describing what the data shows.
- "message": 1-2 sentences, the engagement message of the requested type, suitable for an app notification.

Respond with ONLY a JSON object, no markdown, no extra text:
{"insight": "...", "message": "..."}`;

const TYPE_GUIDE: Record<MessageType, string> = {
  reminder: "A friendly reminder because the daily target has not been met often.",
  encouragement: "Encouragement because activity is trending upward.",
  progress_update: "A progress update because compliance improved versus the previous period.",
  attention_alert: "A calm heads-up because a significant recent decline was detected.",
  general_insight: "A general observation about activity and recovery.",
};

export function userPrompt(ctx: LlmContext, feedback?: string) {
  return [
    `Message type requested: ${ctx.message_type} — ${TYPE_GUIDE[ctx.message_type]}`,
    `Context (calculated by the application):`,
    JSON.stringify(ctx, null, 2),
    feedback ? `\nYour previous answer was rejected: ${feedback} Rewrite it using only numbers from the context.` : "",
  ].join("\n");
}

const n = (v: number) => v.toLocaleString("en-IN");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** Deterministic fallback used when no API key is set or the LLM output fails the guard. */
export function templateMessage(c: LlmContext): { insight: string; message: string } {
  const sleep = c.avg_sleep_hours !== null ? ` Average sleep was ${c.avg_sleep_hours} hours.` : "";
  const change =
    c.steps_change_pct !== null ? ` Average steps changed by ${c.steps_change_pct}% compared with the previous period.` : "";
  const [from, , to] = c.period.split(" ");
  const insight =
    `From ${day(from)} to ${day(to)}, you averaged ${n(c.avg_steps)} steps a day against a target of ${n(c.target_steps)}, ` +
    `meeting it on ${c.compliance_pct}% of tracked days. Your activity trend is ${c.trend}.${change}${sleep}`;

  const messages: Record<MessageType, string> = {
    reminder: `Your target is ${n(c.target_steps)} steps. A short walk today can help you get closer.`,
    encouragement: `Your activity is ${c.trend}. Keep the momentum going today.`,
    progress_update:
      c.previous_compliance_pct !== null
        ? `You met your target on ${c.compliance_pct}% of days, up from ${c.previous_compliance_pct}%. Nice progress.`
        : `You met your target on ${c.compliance_pct}% of days. Keep building on it.`,
    attention_alert: `Your recent activity is lower than usual. Take it easy, and try some light movement when you can.`,
    general_insight: `You averaged ${n(c.avg_steps)} steps a day. Small, steady habits add up.`,
  };
  return { insight, message: messages[c.message_type] };
}
