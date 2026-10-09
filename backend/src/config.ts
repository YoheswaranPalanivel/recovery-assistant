import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: num(process.env.PORT, 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 50),
  production: process.env.NODE_ENV === "production",

  /** Keep a JSON snapshot so restarts don't empty the dashboard. */
  persistData: (process.env.PERSIST_DATA ?? "true").toLowerCase() !== "false",

  auth: (() => {
    const env = (k: string) => process.env[k]?.trim() || "";
    const DEFAULTS = { admin: "Admin@12345", analyst: "Analyst@12345" };
    const users = [
      { username: env("ADMIN_USERNAME") || "admin", password: env("ADMIN_PASSWORD") || DEFAULTS.admin, role: "admin" as const },
      { username: env("ANALYST_USERNAME") || "analyst", password: env("ANALYST_PASSWORD") || DEFAULTS.analyst, role: "analyst" as const },
    ];
    const jwtSecret = env("JWT_SECRET");
    return {
      users,
      defaultPasswordsInUse: users.some((u) => u.password === DEFAULTS[u.role]),
      // Without JWT_SECRET a random one is used: safe, but everyone is logged out on restart.
      jwtSecret: jwtSecret || crypto.randomBytes(32).toString("hex"),
      jwtSecretFromEnv: Boolean(jwtSecret),
      sessionHours: num(process.env.SESSION_HOURS, 8),
      ingestApiKey: env("INGEST_API_KEY"),
    };
  })(),

  /** Secret for turning dataset ids into pseudonyms. Must stay the same across restarts. */
  pseudonymSecret: (() => {
    const fromEnv = process.env.PSEUDONYM_SECRET?.trim();
    if (fromEnv) return fromEnv;
    const file = path.resolve(import.meta.dirname, "../data/.pseudonym-secret");
    try {
      return fs.readFileSync(file, "utf8").trim();
    } catch {
      const s = crypto.randomBytes(32).toString("hex");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, s, { mode: 0o600 });
      return s;
    }
  })(),

  /**
   * LLM provider.
   *  - "openai":    any OpenAI-compatible API (Groq, OpenRouter, Ollama, OpenAI...)
   *  - "anthropic": Claude via the Anthropic SDK
   *  - unset:       picks whichever has a key; with no key, template messages are used.
   */
  llm: (() => {
    const env = (k: string) => process.env[k]?.trim() || "";
    const explicit = env("LLM_PROVIDER").toLowerCase();
    const provider: "openai" | "anthropic" | null =
      explicit === "openai" || explicit === "anthropic"
        ? explicit
        : env("LLM_API_KEY") || env("LLM_BASE_URL")
          ? "openai"
          : env("ANTHROPIC_API_KEY")
            ? "anthropic"
            : null;
    return {
      provider,
      // OpenAI-compatible
      baseUrl: (env("LLM_BASE_URL") || "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
      apiKey: env("LLM_API_KEY"),
      model:
        provider === "anthropic"
          ? env("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001"
          : env("LLM_MODEL") || "openai/gpt-oss-120b",
      reasoningEffort: env("LLM_REASONING_EFFORT"), // "low" | "medium" | "high" for gpt-oss; empty = don't send
      maxTokens: num(process.env.LLM_MAX_TOKENS, 2000),
      // Anthropic
      anthropicKey: env("ANTHROPIC_API_KEY"),
    };
  })(),

  /** Daily step goal. Public datasets don't carry a goal, so it is configured here. */
  targetSteps: num(process.env.TARGET_STEPS, 8000),
  excludeLatestDay: (process.env.EXCLUDE_LATEST_DAY ?? "true").toLowerCase() !== "false",



    /**
   * Community diabetes programme goals. Weekly targets build gradually from each
   * member's own level towards the programme goal, so nobody starts at a goal they can't reach.
   */
  programme: {
    weeklyActiveGoal: 150, // minutes of moderate-to-vigorous activity per week
    activeDayMinutes: 20, // a day counts as "active" at this many active minutes
    activeDaysGoal: 5, // active days per week (4 for limited mobility)
    sleepGoalHours: 7,
    weeklyIncrease: 0.1, // next week's target = usual level + 10%, capped at the goal
    minWeeklyTarget: 60, // never set a target below this
    limitedMobilityCap: 120, // gentler weekly cap for limited mobility
  },

  /**
   * Rule thresholds. Kept in one place so every alert can be explained:
   * "this fired because X was below Y".
   */
  rules: {
    baselineDays: 14, // rolling window used as the user's own baseline
    minBaselineDays: 7, // don't judge a user until we have this much history
    activityDropPct: 40, // steps this % below baseline -> alert
    sleepDropHours: 1.5, // sleep this many hours below baseline -> alert
    minSleepHours: 5, // absolute floor regardless of baseline
    missedTargetStreak: 4, // consecutive days under target -> alert
    recoveryDropPoints: 15, // recovery score fall vs baseline -> alert
  },

  /** Values outside these ranges are rejected as data-quality problems. */
  validRanges: {
    steps: [0, 100_000],
    distanceKm: [0, 150],
    activeMinutes: [0, 1440],
    sedentaryMinutes: [0, 1440],
    calories: [0, 10_000],
    sleepHours: [0, 20],
    restingHeartRate: [25, 220],
    recoveryScore: [0, 100],
  } as Record<string, [number, number]>,
};
