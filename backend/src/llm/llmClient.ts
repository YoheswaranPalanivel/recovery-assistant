import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import type { Insight, LlmContext } from "@shared/types";
import { config } from "../config.js";
import { checkNumbers, checkWords  } from "./numberGuard.js";
import { SYSTEM_PROMPT, templateMessage, userPrompt } from "./prompts.js";

const MAX_ATTEMPTS = 3;
const cfg = config.llm;

/** Sends one system + user prompt and returns the model's text. */
type Complete = (system: string, user: string) => Promise<string>;

// ---------- OpenAI-compatible: Groq, OpenRouter, Ollama, OpenAI ... ----------
const openaiCompatible: Complete = async (system, user) => {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.4,
    max_tokens: cfg.maxTokens, // reasoning models (gpt-oss) spend part of this on thinking
  };
  if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(`HTTP ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  const choice = data.choices?.[0];
  const text = choice?.message?.content ?? "";
  if (!text && choice?.finish_reason === "length") {
    throw new Error("model used all tokens before answering; raise LLM_MAX_TOKENS or lower LLM_REASONING_EFFORT");
  }
  return text;
};

// ---------- Anthropic (Claude) ----------
const anthropic = cfg.anthropicKey ? new Anthropic({ apiKey: cfg.anthropicKey }) : null;
const claude: Complete = async (system, user) => {
  const res = await anthropic!.messages.create({
    model: cfg.model,
    max_tokens: 400,
    temperature: 0.4,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
};

// A hosted OpenAI-compatible API needs a key; a local one (Ollama) doesn't.
const isLocal = /\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(cfg.baseUrl);
const complete: Complete | null =
  cfg.provider === "openai" && (cfg.apiKey || isLocal)
    ? openaiCompatible
    : cfg.provider === "anthropic" && anthropic
      ? claude
      : null;

export const llmEnabled = () => complete !== null;
export const callModel = complete;
export const llmModel = () => (complete ? cfg.model : null);
export const llmProvider = () => (complete ? (cfg.provider === "anthropic" ? "Anthropic" : new URL(cfg.baseUrl).host) : null);
export const llmLabel = () =>
  !complete ? "no LLM configured, template messages" : cfg.provider === "anthropic" ? `Claude (${cfg.model})` : `${cfg.model} via ${cfg.baseUrl}`;

function parseJson(text: string): { insight: string; message: string } | null {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    const obj = JSON.parse(clean.slice(start, end + 1));
    if (typeof obj.insight === "string" && typeof obj.message === "string") {
      return { insight: obj.insight.trim(), message: obj.message.trim() };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function generateInsight(userId: string, ctx: LlmContext): Promise<Insight> {
  const base = { id: randomUUID(), userId, createdAt: new Date().toISOString(), context: ctx };

  if (complete) {
    let feedback: string | undefined;
    let lastUnknown: string[] = [];
    let lastBlocked: string[] = [];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const text = await complete(SYSTEM_PROMPT, userPrompt(ctx, feedback));
        const out = parseJson(text);
        if (!out) {
          feedback = "it was not valid JSON with insight and message fields.";
          continue;
        }
        const guard = checkNumbers(ctx, out.insight, out.message);
        const blocked = checkWords(out.insight, out.message);
        if (guard.passed && blocked.length === 0) {
          return { ...base, ...out, source: "llm", model: cfg.model, guard: { ...guard, attempts: attempt, blockedWords: [] } };
        }
        lastUnknown = guard.unknownNumbers;
        lastBlocked = blocked;
        feedback = !guard.passed
          ? `it contained numbers not in the context (${guard.unknownNumbers.join(", ")}).`
          : `it used words that are not allowed (${blocked.join(", ")}). Rephrase in plain, friendly language.`;
      } catch (err) {
        // Log the reason only — never the context or the key.
        console.error(`[llm] request failed (attempt ${attempt}):`, (err as Error).message);
        break;
      }
    }
    const t = templateMessage(ctx);
    return {
      ...base,
      ...t,
      source: "template",
      model: null,
      guard: { passed: lastUnknown.length === 0, unknownNumbers: lastUnknown, attempts: MAX_ATTEMPTS, blockedWords: lastBlocked },
    };
  }

  const t = templateMessage(ctx);
  return { ...base, ...t, source: "template", model: null, guard: { ...checkNumbers(ctx, t.insight, t.message), attempts: 0 } };
}
