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





// ---------- Community diabetes programme ----------

export type MemberProfile = {
  userId: string; // pseudonym
  name: string; // demo name: the dataset has no names
  ageBand: "30-44" | "45-59" | "60+";
  condition: "Type 2 diabetes" | "Pre-diabetes";
  mobility: "normal" | "limited";
  prefers: string; // e.g. "evening walks"
  language: "Tamil" | "English";
  demo: true; // profiles are sample data, clearly labelled
};

export type MemberStatus = "needs_support" | "slipping" | "check_device" | "needs_rest" | "on_track";

export type GoalProgress = {
  key: "active_minutes" | "active_days" | "sleep" | "steps";
  label: string;
  value: number | null; // null when the dataset has no value
  target: number;
  unit: string;
};

export type DayDot = { date: string; level: "none" | "low" | "some" | "good" | "great" };

export type MemberWeek = {
  profile: MemberProfile;
  lastAction?: MemberAction | null; // the health worker's latest contact, with its outcom
  checkIn?: CheckIn | null; // the member's check-in in the last 24 hours
  status: MemberStatus;
  reasons: string[]; // plain-language reasons, each backed by a figure
  goals: GoalProgress[];
  week: DayDot[]; // last 7 completed days
  weekStart: string;
  weekEnd: string;
  metWeeklyGoal: boolean;
};

export type TodayView = {
  asOf: string | null;
  counts: Record<MemberStatus, number>;
  priorities: MemberWeek[]; // everyone not on track, most urgent first
  community: { metGoalPct: number; previousMetGoalPct: number | null; members: number };
  actions?: ActionSummary;
};

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type PlanAction = {
  activity: string;
  label: string;
  minutes: number;
  days: Weekday[];
  when: string;
};

export type CarePlan = {
  userId: string;
  createdAt: string;
  actions: PlanAction[];
  totalMinutes: number;
  targetMinutes: number;
  message: string;
  workerNote: string;
  source: "llm" | "template";
  model: string | null;
  check: { passed: boolean; attempts: number; problems: string[] };
  context: Record<string, unknown>;
  messageEnglish: string;
  language: "Tamil" | "English";
};

export type ActionKind = "call" | "visit" | "plan_sent" | "device_check";

export type ContactAction = {
  id: string;
  userId: string;
  kind: ActionKind;
  note: string;
  by: string; // username
  at: string; // when it was recorded
  dataDate: string; // latest data day at the time: "before" and "after" are measured from here
  followUp: string | null; // YYYY-MM-DD
};

export type Outcome = {
  status: "waiting" | "more_active" | "no_change";
  beforeSteps: number | null; // average daily steps, 3 days before contact
  afterSteps: number | null; // average daily steps, up to 3 days after
  changePct: number | null;
  daysAfter: number;
};

export type MemberAction = ContactAction & { outcome: Outcome };

export type ActionSummary = {
  contacted: number; // members contacted
  moreActive: number;
  noChange: number;
  waiting: number;
  followUps: { userId: string; name: string; kind: ActionKind; date: string }[];
};



// ---------- Member journey page ----------

export type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  activeMinutes: number;
  target: number;
  met: boolean;
  avgSteps: number | null;
  avgSleep: number | null;
  trackedDays: number;
};

export type MemberDetail = {
  member: MemberWeek;
  history: WeekSummary[]; // oldest first, up to 4 weeks
  streak: number; // active days in a row up to the latest day
  actions: MemberAction[]; // newest first, each with its outcome
};


// ---------- Community view (programme lead) ----------

export type CommunityWeek = { weekStart: string; weekEnd: string; members: number; metGoalPct: number };

export type CommunityView = {
  asOf: string | null;
  members: number;
  counts: Record<MemberStatus, number>;
  weeks: CommunityWeek[]; // oldest first, up to 4
  goals: { key: GoalProgress["key"]; label: string; metPct: number; members: number }[];
  actions: ActionSummary;
};

export type CommunitySummary = {
  text: string;
  source: "llm" | "template";
  model: string | null;
  check: { passed: boolean; attempts: number; problems: string[] };
  context: Record<string, unknown>;
};



// ---------- Member daily check-in (member's phone view) ----------

export type CheckIn = {
  id: string;
  userId: string;
  at: string; // when it was sent
  mood: "good" | "okay" | "not_well";
  medicineTaken: boolean | null; // null = not answered
};

export type MemberApp = {
  name: string;
  language: "Tamil" | "English";
  goals: GoalProgress[];
  week: DayDot[];
  streak: number;
  message: { text: string; from: string; at: string } | null; // latest plan sent by the health worker
  todayCheckIn: CheckIn | null;
};