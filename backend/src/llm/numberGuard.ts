import type { LlmContext } from "@shared/types";

/** Every number that appears anywhere in the context (values and inside strings). */
export function allowedNumbers(ctx: LlmContext): Set<string> {
  const set = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number") set.add(normalise(String(v)));
    else if (typeof v === "string") extractNumbers(v).forEach((n) => set.add(n));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(ctx);
  return set;
}

/** Pulls numbers out of text: "6,850" -> "6850", "57%" -> "57", "6.40" -> "6.4". */
export function extractNumbers(text: string): string[] {
  return (text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []).map(normalise);
}

function normalise(raw: string): string {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? String(Math.abs(n)) : raw;
}

const BLOCKED = ["compliance", "baseline", "metric", "the system", "flagged", "diagnos", "doctor", "disease", "medication", "illness"];

export function checkWords(...texts: string[]): string[] {
  const t = texts.join(" ").toLowerCase();
  return BLOCKED.filter((w) => t.includes(w));
}

/**
 * The LLM may only repeat numbers it was given. Any other number means it
 * calculated or invented something, so the response is rejected.
 */
export function checkNumbers(ctx: LlmContext, ...texts: string[]) {
  const allowed = allowedNumbers(ctx);
  const unknown = [...new Set(texts.flatMap(extractNumbers))].filter((n) => !allowed.has(n));
  return { passed: unknown.length === 0, unknownNumbers: unknown };
}
