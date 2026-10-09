import type { LlmContext } from "@shared/types";

/** Every number that appears anywhere in the context (values and inside strings). */
export function allowedNumbers(ctx: LlmContext | object): Set<string> {
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
const WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18",
  nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50", hundred: "100",
};

/** Pulls numbers out of text, including ones written as words ("three members" -> "3"). */
export function extractNumbers(text: string): string[] {
  const digits = (text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []).map(normalise);
  const words = (text.toLowerCase().match(/\b[a-z]+\b/g) ?? []).filter((w) => w in WORDS).map((w) => WORDS[w]);
  return [...digits, ...words];
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
export function checkNumbers(ctx: LlmContext | object, ...texts: string[]) {
  const allowed = allowedNumbers(ctx);
  const unknown = [...new Set(texts.flatMap(extractNumbers))].filter((n) => !allowed.has(n));
  return { passed: unknown.length === 0, unknownNumbers: unknown };
}
