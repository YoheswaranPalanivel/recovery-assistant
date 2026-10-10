import { Router, type Request } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Alert, IngestionStatus, Overview, PipelineStatus } from "@shared/types";
import { config } from "../config.js";
import { store } from "../store/memoryStore.js";
import { csvRows, excelRows, ingestRows, IngestionError } from "../ingestion/ingest.js";
import { addDays, completedDays, computeHeatmap, computeKpis, computeTrend, computeUsers, dateRange, type Filter } from "../analytics/metrics.js";
import { detectAnomalies } from "../analytics/anomalies.js";
import { buildContext } from "../llm/contextBuilder.js";
import { generateInsight, llmEnabled, llmModel, llmProvider } from "../llm/llmClient.js";
import { emitChange, emitStreamUpdate, markAlertsSeen } from "../realtime.js";
import { memberWeek, todayView, allMemberWeeks, memberDetail } from "../programme/engine.js";
import { generatePlan } from "../programme/planner.js";
import { actionSummary, actionsFor, clearActions, recordAction, withActions } from "../programme/actions.js";
import { communitySummary, communityView } from "../programme/community.js";
import { applyCheckIn, clearCheckIns, recentCheckIn, recordCheckIn } from "../programme/checkins.js";
import { eraseMember } from "../programme/erasure.js";
import { profilesFor } from "../programme/profiles.js";
import { dateRange as range } from "../analytics/metrics.js";import {
  SESSION_COOKIE,
  cookieOptions,
  issueToken,
  requireAuth,
  requireIngestKey,
  requireRole,
  verifyLogin,
} from "../auth/auth.js";

export const api = Router();

// ---------- input validation helpers ----------

const ALLOWED_EXT = new Set([".csv", ".xlsx", ".xls"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new IngestionError(`${file.originalname}: only .csv, .xlsx or .xls files are accepted.`));
    }
    cb(null, true);
  },
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const userIdSchema = z.string().max(64).regex(/^[\w.-]+$/);
const FilterSchema = z.object({ userId: userIdSchema.optional(), from: isoDate, to: isoDate });

function readFilter(req: Request): Filter {
  const raw = Object.fromEntries(Object.entries(req.query).filter(([, v]) => typeof v === "string" && v !== ""));
  const parsed = FilterSchema.safeParse(raw);
  if (!parsed.success) throw new IngestionError("Invalid filter. Use userId, from and to (YYYY-MM-DD).");
  return parsed.data;
}

const safeName = (n: string) => path.basename(n).replace(/[^\w.() -]/g, "_").slice(0, 120);

/** Stream batches arrive every few seconds; fold them into one audit line per minute. */
function auditStream(rows: number) {
  const top = store.audit()[0];
  if (top && top.action === "stream_batch" && Date.now() - Date.parse(top.at) < 60_000) {
    const prev = Number(top.detail.match(/^(\d+)/)?.[1] ?? 0);
    top.detail = `${prev + rows} rows received via ingest API`;
    return;
  }
  store.addAudit({ user: "ingest-api", action: "stream_batch", detail: `${rows} rows received via ingest API` });
}

// ---------- public ----------

api.get("/health", (_req, res) => res.json({ ok: true }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
});

const LoginSchema = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200) });

api.post("/auth/login", loginLimiter, (req, res) => {
  const body = LoginSchema.safeParse(req.body);
  const user = body.success ? verifyLogin(body.data.username, body.data.password) : null;
  if (!user) {
    store.addAudit({ user: body.success ? body.data.username.slice(0, 64) : "unknown", action: "login_failed", detail: "wrong username or password" });
    return res.status(401).json({ error: "Wrong username or password." });
  }
  res.cookie(SESSION_COOKIE, issueToken(user), cookieOptions());
  store.addAudit({ user: user.username, action: "login", detail: `signed in as ${user.role}` });
  res.json({ user });
});

api.post("/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

// ---------- streaming ingestion: API key, not a browser session ----------

const StreamSchema = z.object({
  source: z.string().max(120).default("stream"),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

api.post("/ingest", requireIngestKey, async (req, res, next) => {
  try {
    const body = StreamSchema.parse(req.body);
    const { batch, touchedUsers, latestDate } = await ingestRows(body.rows, { fileName: safeName(body.source), source: "stream" });
    const all = completedDays(store.allRecords());
    const candidates = [...touchedUsers].flatMap((u) => detectAnomalies(all, { userId: u }));
    const recentFrom = latestDate ? addDays(latestDate, -1) : "";
    const newAlerts = markAlertsSeen(candidates).filter((a) => a.date >= recentFrom);
    emitStreamUpdate({ batches: [batch], newAlerts });
    auditStream(batch.totalRows);
    res.json({ batch, newAlerts: newAlerts.length });
  } catch (e) {
    next(e);
  }
});

api.post("/reset-stream", requireIngestKey, (_req, res) => {
  store.reset();
  clearActions();
  clearCheckIns();
  markAlertsSeen([], true);
  emitStreamUpdate({ batches: [], newAlerts: [], reset: true });
  store.addAudit({ user: "ingest-api", action: "reset", detail: "data cleared before replay" });
  res.json({ ok: true });
});

// ---------- everything below needs a signed-in user ----------

api.use(requireAuth);

api.get("/auth/me", (req, res) => res.json({ user: req.user }));

api.get("/status", (_req, res) => {
  res.json({
    llm: llmEnabled(),
    model: llmModel(),
    records: store.recordCount(),
    targetSteps: config.targetSteps,
  });
});

// ---------- upload (admin) ----------

api.post("/upload", requireRole("admin"), upload.array("files", 5), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) throw new IngestionError("Choose at least one .csv or .xlsx file.");
    // Activity files first, so sleep rows attach to them directly.
    files.sort((a, b) => Number(/sleep/i.test(a.originalname)) - Number(/sleep/i.test(b.originalname)));

    const batches = [];
    for (const f of files) {
      const ext = path.extname(f.originalname).toLowerCase();
      const rows = ext === ".csv" ? csvRows(f.buffer) : excelRows(f.buffer);
      const { batch } = await ingestRows(rows, { fileName: safeName(f.originalname), source: "upload" });
      batches.push(batch);
      store.addAudit({ user: req.user!.username, action: "upload", detail: `${batch.fileName}: ${batch.accepted} accepted, ${batch.rejected} rejected` });
    }
    markAlertsSeen(detectAnomalies(completedDays(store.allRecords()), {}));
    emitStreamUpdate({ batches, newAlerts: [] });
    res.json({ batches });
  } catch (e) {
    next(e);
  }
});

/** One click demo data: the real dataset in data/fitbit if present, else the synthetic sample. */
api.post("/demo/load", requireRole("admin"), async (req, res, next) => {
  try {
    const dataDir = path.resolve(import.meta.dirname, "../../data");
    const candidates = [
      { dir: "fitbit", label: "Fitbit public dataset" },
      { dir: "sample", label: "synthetic test data" },
    ];
    const pick = candidates.find((c) => fs.existsSync(path.join(dataDir, c.dir, "dailyActivity_merged.csv")));
    if (!pick) throw new IngestionError('No dataset found. Run "npm run sample" in the backend folder, or put the Fitbit CSVs in backend/data/fitbit.');

    const batches = [];
    for (const name of ["dailyActivity_merged.csv", "sleepDay_merged.csv"]) {
      const file = path.join(dataDir, pick.dir, name);
      if (!fs.existsSync(file)) continue;
      const { batch } = await ingestRows(csvRows(fs.readFileSync(file)), { fileName: name, source: "upload" });
      batches.push(batch);
    }
    markAlertsSeen(detectAnomalies(completedDays(store.allRecords()), {}));
    emitStreamUpdate({ batches, newAlerts: [] });
    store.addAudit({ user: req.user!.username, action: "load_dataset", detail: `loaded ${pick.label}` });
    res.json({ batches, dataset: pick.label });
  } catch (e) {
    next(e);
  }
});

api.post("/reset", requireRole("admin"), (req, res) => {
  store.reset();
  clearActions();
  clearCheckIns();
  markAlertsSeen([], true);
  emitStreamUpdate({ batches: [], newAlerts: [], reset: true });
  store.addAudit({ user: req.user!.username, action: "reset", detail: "all data cleared" });
  res.json({ ok: true });
});

api.get("/ingestion", (_req, res) => {
  const batches = store.batches();
  const status: IngestionStatus = {
    batches: batches.slice(0, 50),
    recentRejections: store.rejections().slice(0, 100),
    rejectionReasons: store.rejectionReasons(),
    totals: batches.reduce(
      (t, b) => ({ rows: t.rows + b.totalRows, accepted: t.accepted + b.accepted, rejected: t.rejected + b.rejected, duplicates: t.duplicates + b.duplicates }),
      { rows: 0, accepted: 0, rejected: 0, duplicates: 0 },
    ),
  };
  res.json(status);
});

// ---------- analytics ----------

api.get("/overview", (req, res, next) => {
  try {
    const f = readFilter(req);
    const all = completedDays(store.allRecords());
    const overview: Overview = {
      kpis: computeKpis(all, f),
      trend: computeTrend(all, f),
      heatmap: computeHeatmap(all, { from: f.from, to: f.to }),
      alerts: detectAnomalies(all, f).slice(0, 80),
      dateRange: dateRange(all),
      availableFields: store.availableFields(),
    };
    res.json(overview);
  } catch (e) {
    next(e);
  }
});

// api.get("/today", (_req, res) => {
//   res.json(todayView(completedDays(store.allRecords())));
// });

api.get("/today", (_req, res) => {
  const recs = completedDays(store.allRecords());
  const view = todayView(recs, applyCheckIn);
  const names = new Map([...profilesFor([...new Set(recs.map((r) => r.userId))]).values()].map((p) => [p.userId, p.name]));
  res.json(withActions(view, recs, names));
});

const ActionSchema = z.object({
  userId: z.string().min(1).max(64),
  kind: z.enum(["call", "visit", "plan_sent", "device_check"]),
  note: z.string().max(300).default(""),
  followUpDays: z.number().int().min(0).max(30).nullable().default(null),
});

/** A health worker records a call, visit, plan sent or device check, with an optional follow-up. */
api.post("/actions", (req, res, next) => {
  try {
    const body = ActionSchema.parse(req.body);
    const { max } = range(completedDays(store.allRecords()));
    if (!max) throw new IngestionError("No data loaded yet.");
    const today = new Date().toISOString().slice(0, 10);
    const action = recordAction({
      userId: body.userId,
      kind: body.kind,
      note: body.note,
      by: req.user!.username,
      dataDate: max,
      followUp: body.followUpDays === null ? null : addDays(today, body.followUpDays),
    });
    store.addAudit({ user: req.user!.username, action: "record_action", detail: `${body.kind} for ${body.userId}` });
    res.json(action);
  } catch (e) {
    next(e);
  }
});




/**
 * The member's phone view. In this demo it is opened by signed-in staff to show what a member sees;
 * a real member app would have its own sign-in and only ever see its own data.
 */
api.get("/member-app/:userId", (req, res, next) => {
  try {
    const userId = String(req.params.userId).slice(0, 64);
    const all = completedDays(store.allRecords());
    const recs = all.filter((r) => r.userId === userId);
    const { max } = range(all);
    if (!recs.length || !max) throw new IngestionError("No data for this member.");
    const profile = profilesFor([...new Set(all.map((r) => r.userId))]).get(userId)!;
    const d = memberDetail(recs, profile, max);
    const sent = actionsFor(userId, recs).find((a) => a.kind === "plan_sent" && a.note);
    res.json({
      name: profile.name,
      language: profile.language,
      goals: d.member.goals,
      week: d.member.week,
      streak: d.streak,
      message: sent ? { text: sent.note, from: sent.by, at: sent.at } : null,
      todayCheckIn: recentCheckIn(userId),
    });
  } catch (e) {
    next(e);
  }
});

const CheckInSchema = z.object({
  userId: z.string().min(1).max(64),
  mood: z.enum(["good", "okay", "not_well"]),
  medicineTaken: z.boolean().nullable().default(null),
});

/** A member's daily check-in. It updates the health worker's list straight away. */
api.post("/checkins", (req, res, next) => {
  try {
    const body = CheckInSchema.parse(req.body);
    const c = recordCheckIn(body);
    store.addAudit({ user: req.user!.username, action: "member_checkin", detail: `${body.userId} checked in` });
    emitChange();
    res.json(c);
  } catch (e) {
    next(e);
  }
});


/**
 * Right to erasure: delete everything about one member and stop it being imported again.
 * Admin only. The activity log records that it happened, without any of the deleted data.
 */
api.delete("/members/:userId", requireRole("admin"), (req, res) => {
  const userId = String(req.params.userId).slice(0, 64);
  const removed = eraseMember(userId);
  store.addAudit({
    user: req.user!.username,
    action: "delete_member",
    detail: `${userId}: ${removed.records} daily records, ${removed.contacts} contacts, ${removed.checkIns} check-ins and ${removed.insights} messages deleted`,
  });
  emitChange();
  res.json({ ok: true, removed });
});


/** All members, most urgent first, each with their latest contact. */
api.get("/members", (_req, res) => {
  const recs = completedDays(store.allRecords());
  const weeks = allMemberWeeks(recs, applyCheckIn);
  const names = new Map(weeks.map((w) => [w.profile.userId, w.profile.name]));
  const view = withActions({ asOf: null, counts: { needs_support: 0, slipping: 0, check_device: 0, needs_rest: 0, on_track: 0 }, priorities: weeks, community: { metGoalPct: 0, previousMetGoalPct: null, members: 0 } }, recs, names);
  res.json(view.priorities);
});

/** One member's journey: this week, last 4 weeks, streak and contact history with outcomes. */
api.get("/members/:userId", (req, res, next) => {
  try {
    const userId = String(req.params.userId).slice(0, 64);
    const all = completedDays(store.allRecords());
    const recs = all.filter((r) => r.userId === userId);
    const { max } = range(all);
    if (!recs.length || !max) throw new IngestionError("No data for this member.");
    const profile = profilesFor([...new Set(all.map((r) => r.userId))]).get(userId)!;
    const d = memberDetail(recs, profile, max);
    res.json({ ...d, member: applyCheckIn(d.member), actions: actionsFor(userId, recs) });
  } catch (e) {
    next(e);
  }
});

api.get("/actions/:userId", (req, res) => {
  const userId = String(req.params.userId).slice(0, 64);
  res.json(actionsFor(userId, store.allRecords().filter((r) => r.userId === userId)));
});


api.get("/users", (_req, res) => {
  const all = completedDays(store.allRecords());
  const latest = dateRange(all).max;
  const counts = new Map<string, number>();
  if (latest) {
    const recent: Alert[] = detectAnomalies(all, { from: addDays(latest, -6) }).filter((a) => a.severity === "attention");
    for (const a of recent) counts.set(a.userId, (counts.get(a.userId) ?? 0) + 1);
  }
  res.json(computeUsers(all, counts));
});

/** Live numbers for the "How it works" page. */
api.get("/pipeline", (_req, res) => {
  const all = completedDays(store.allRecords());
  const batches = store.batches();
  const alerts = detectAnomalies(all, {});
  const insights = store.insights();
  const sampleUser = alerts.find((a) => a.severity === "attention")?.userId ?? all[0]?.userId;
  const sum = (k: "totalRows" | "accepted" | "rejected" | "duplicates") => batches.reduce((t, b) => t + b[k], 0);
  const status: PipelineStatus = {
    rowsReceived: sum("totalRows"),
    accepted: sum("accepted"),
    rejected: sum("rejected"),
    duplicates: sum("duplicates"),
    records: all.length,
    users: new Set(all.map((r) => r.userId)).size,
    dateRange: dateRange(all),
    alerts: alerts.length,
    attentionAlerts: alerts.filter((a) => a.severity === "attention").length,
    insights: insights.length,
    insightsByLlm: insights.filter((i) => i.source === "llm").length,
    guardRejections: insights.filter((i) => i.guard.unknownNumbers.length > 0 || i.guard.attempts > 1).length,
    llm: { enabled: llmEnabled(), model: llmModel(), provider: llmProvider() },
    security: {
      authRequired: true,
      cookie: `httpOnly, SameSite=Lax${config.production ? ", Secure" : ""}, ${config.auth.sessionHours} h`,
      pseudonymisation: true,
      persistence: config.persistData,
      ingestKeyRequired: Boolean(config.auth.ingestApiKey),
      loginRateLimit: "10 attempts / 15 min per IP",
      insightRateLimit: "20 requests / min per user",
      maxUploadMb: config.maxUploadMb,
      defaultPasswordsInUse: config.auth.defaultPasswordsInUse,
    },
    exampleContext: sampleUser ? buildContext(all, sampleUser) : null,
    targetSteps: config.targetSteps,
    rules: config.rules,
  };
  res.json(status);
});

api.get("/audit", requireRole("admin"), (_req, res) => res.json(store.audit().slice(0, 150)));

// ---------- LLM ----------

const insightLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user?.username ?? "anon",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many insight requests. Wait a minute and try again." },
});

const InsightSchema = z.object({
  userId: userIdSchema,
  from: isoDate,
  to: isoDate,
  messageType: z.enum(["reminder", "encouragement", "progress_update", "attention_alert", "general_insight"]).optional(),
});

/** Preview exactly what would be sent to the LLM, before sending it. */
api.get("/insights/context", (req, res, next) => {
  try {
    const f = readFilter(req);
    if (!f.userId) throw new IngestionError("Select a person to build an insight.");
    const ctx = buildContext(completedDays(store.allRecords()), f.userId, f);
    if (!ctx) throw new IngestionError("No data for this person in the selected period.");
    res.json(ctx);
  } catch (e) {
    next(e);
  }
});



function community() {
  const recs = completedDays(store.allRecords());
  const names = new Map([...profilesFor([...new Set(recs.map((r) => r.userId))]).values()].map((p) => [p.userId, p.name]));
  return communityView(recs, actionSummary(recs, names));
}

/** Programme lead's view: the community week by week. */
api.get("/community", (_req, res) => {
  res.json(community());
});

/** AI weekly summary for the programme lead, checked before it's shown. */
api.post("/community/summary", insightLimiter, async (req, res, next) => {
  try {
    const v = community();
    if (!v.asOf) throw new IngestionError("No data loaded yet.");
    const s = await communitySummary(v);
    store.addAudit({ user: req.user!.username, action: "community_summary", detail: s.source === "llm" ? `AI summary accepted on attempt ${s.check.attempts}` : "template summary used" });
    res.json(s);
  } catch (e) {
    next(e);
  }
});


/** AI weekly care plan for one member: chosen from the approved menu, checked against code limits. */
api.post("/plan", insightLimiter, async (req, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string().min(1).max(64) }).parse(req.body);
    const all = completedDays(store.allRecords());
    const recs = all.filter((r) => r.userId === userId);
    const { max } = range(all);
    if (!recs.length || !max) throw new IngestionError("No data for this member.");
    const profile = profilesFor([...new Set(all.map((r) => r.userId))]).get(userId)!;
     const plan = await generatePlan(applyCheckIn(memberWeek(recs, profile, max)));
    store.addAudit({
      user: req.user!.username,
      action: "generate_plan",
      detail: `${userId}, ${plan.source === "llm" ? `AI plan accepted on attempt ${plan.check.attempts}` : "template plan used"}`,
    });
    res.json(plan);
  } catch (e) {
    next(e);
  }
});


api.post("/insights", insightLimiter, async (req, res, next) => {
  try {
    const body = InsightSchema.parse(req.body);
    const ctx = buildContext(completedDays(store.allRecords()), body.userId, body);
    if (!ctx) throw new IngestionError("No data for this person in the selected period.");
    const insight = await generateInsight(body.userId, ctx);
    store.addInsight(insight);
    store.addAudit({
      user: req.user!.username,
      action: "generate_insight",
      detail: `${body.userId}, ${ctx.message_type}, ${insight.source === "llm" ? `LLM accepted on attempt ${insight.guard.attempts}` : "template used"}`,
    });
    res.json(insight);
  } catch (e) {
    next(e);
  }
});

api.get("/insights", (req, res) => {
  const parsed = userIdSchema.safeParse(req.query.userId);
  res.json(store.insights(parsed.success ? parsed.data : undefined).slice(0, 20));
});
