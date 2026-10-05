// Shared contract between backend (Express) and frontend (Next.js).
// Frontend uses `import type` only, so nothing from here is bundled.

export type Role = "admin" | "analyst";
export type SessionUser = { username: string; role: Role };

export type AuditEntry = {
  at: string;
  user: string; // username, or "ingest-api" for machine uploads
  action: string; // e.g. "login", "upload", "generate_insight"
  detail: string; // never contains data values
};

export type PipelineStatus = {
  rowsReceived: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  records: number;
  users: number;
  dateRange: { min: string | null; max: string | null };
  alerts: number;
  attentionAlerts: number;
  insights: number;
  insightsByLlm: number;
  guardRejections: number;
  llm: { enabled: boolean; model: string | null; provider: string | null };
  security: {
    authRequired: boolean;
    cookie: string;
    pseudonymisation: boolean;
    persistence: boolean;
    ingestKeyRequired: boolean;
    loginRateLimit: string;
    insightRateLimit: string;
    maxUploadMb: number;
    defaultPasswordsInUse: boolean;
  };
  exampleContext: LlmContext | null;
  targetSteps: number;
  rules: {
    baselineDays: number;
    minBaselineDays: number;
    activityDropPct: number;
    sleepDropHours: number;
    minSleepHours: number;
    missedTargetStreak: number;
    recoveryDropPoints: number;
  };
};

/** One cleaned, standardised record: one user, one day. */
export type DailyRecord = {
  userId: string;
  date: string; // YYYY-MM-DD
  steps: number;
  distanceKm: number | null;
  activeMinutes: number | null;
  sedentaryMinutes: number | null;
  veryActiveMinutes?: number | null;
  fairlyActiveMinutes?: number | null;
  lightlyActiveMinutes?: number | null;
  calories: number | null;
  sleepHours: number | null; // null = not present in the source dataset
  restingHeartRate: number | null;
  recoveryScore: number | null; // only if the source dataset actually has it
};

export type RejectedRow = {
  source: string;
  rowNumber: number;
  reason: string;
};

export type IngestionBatch = {
  id: string;
  source: "upload" | "stream";
  fileName: string;
  receivedAt: string;
  totalRows: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  detectedFormat: string;
  mappedFields: Record<string, string>; // standard field -> source column
  unavailableFields: string[];
};

export type IngestionStatus = {
  batches: IngestionBatch[];
  recentRejections: RejectedRow[];
  rejectionReasons: { reason: string; count: number }[];
  totals: { rows: number; accepted: number; rejected: number; duplicates: number };
};

export type Kpis = {
  users: number;
  records: number;
  avgSteps: number;
  avgActiveMinutes: number | null;
  avgCalories: number | null;
  activityMix: { very: number; fairly: number; lightly: number; sedentary: number } | null;
  avgSleepHours: number | null;
  avgRecoveryScore: number | null;
  compliancePct: number;
  stepsChangePct: number | null; // vs previous equal-length period
  changeLabel: string | null; // which periods were compared, shown in the UI
  target: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type TrendPoint = {
  date: string;
  avgSteps: number;
  rolling7: number | null;
  avgSleepHours: number | null;
  compliancePct: number;
  users: number;
};

export type HeatCell = { date: string; steps: number | null; ratio: number | null };
export type HeatRow = { userId: string; compliancePct: number; cells: HeatCell[] };

export type AlertType =
  | "activity_drop"
  | "low_sleep"
  | "compliance_streak"
  | "recovery_drop";

export type Alert = {
  id: string;
  userId: string;
  date: string;
  type: AlertType;
  severity: "attention" | "watch";
  title: string;
  evidence: { label: string; value: string }[];
};

export type UserSummary = {
  userId: string;
  days: number;
  avgSteps: number;
  compliancePct: number;
  lastDate: string;
  openAlerts: number;
};

export type Overview = {
  kpis: Kpis;
  trend: TrendPoint[];
  heatmap: HeatRow[];
  alerts: Alert[];
  dateRange: { min: string | null; max: string | null };
  availableFields: string[];
};

export type MessageType =
  | "reminder"
  | "encouragement"
  | "progress_update"
  | "attention_alert"
  | "general_insight";

/** The only thing that is ever sent to the LLM. */
export type LlmContext = {
  user: string;
  period: string;
  days_tracked: number;
  avg_steps: number;
  target_steps: number;
  compliance_pct: number;
  previous_compliance_pct: number | null;
  days_on_target_change: "improved" | "declined" | "unchanged" | null;
  steps_change_pct: number | null;
  avg_sleep_hours: number | null;
  avg_active_minutes: number | null;
  trend: "increasing" | "decreasing" | "stable";
  alerts: string[];
  message_type: MessageType;
};

export type Insight = {
  id: string;
  userId: string;
  createdAt: string;
  context: LlmContext;
  insight: string;
  message: string;
  source: "llm" | "template";
  model: string | null;
  guard: { passed: boolean; unknownNumbers: string[]; attempts: number; blockedWords?: string[] };
};
