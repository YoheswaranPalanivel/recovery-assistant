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
import { applyConsent, clearConsents, consentOf, hasConsent, recordConsent } from "../programme/consent.js";
import { VALID_RANGE, applyGlucose, bandOf, clearGlucose, glucoseSummary, limitsFor, recordReading, seedDemoGlucose, setLimits } from "../programme/glucose.js";
import { acceptAlert, activeAlerts, alertsFor, alertsForHelper, clearAlerts, declineAlert, raiseAlert, reportAlert } from "../programme/alerts.js";
import { HELPERS, circleFor } from "../programme/circle.js";
import { addMedicine, clearMedicines, markTaken, medicinesView, seedDemoMedicines, stopMedicine } from "../programme/medicines.js";
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
  clearConsents();
  clearGlucose();
  clearAlerts();
  clearMedicines();
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
    seedDemoGlucose([...new Set(store.allRecords().map((r) => r.userId))]);
    const loaded = profilesFor([...new Set(store.allRecords().map((r) => r.userId))]);
    seedDemoMedicines([...loaded.values()].map((p) => ({ userId: p.userId, condition: p.condition, prescribedBy: circleFor(p.userId).careTeam.name })));
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
  clearConsents();
  clearGlucose();
  clearAlerts();
  clearMedicines();
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
  const view = todayView(recs, (w) => applyGlucose(applyConsent(applyCheckIn(w))));
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
      consent: consentOf(userId),
      glucose: glucoseSummary(userId),
      medicines: medicinesView(userId),
    });
  } catch (e) {
    next(e);
  }
});

/** The member gives or withdraws consent (from their phone). Logged, and the lists update live. */
api.post("/consent", (req, res, next) => {
  try {
    const { userId, status } = z.object({ userId: z.string().min(1).max(64), status: z.enum(["given", "withdrawn"]) }).parse(req.body);
    const c = recordConsent(userId, status, "member");
    store.addAudit({ user: req.user!.username, action: status === "given" ? "consent_given" : "consent_withdrawn", detail: `${userId} ${status === "given" ? "gave" : "withdrew"} consent` });
    emitChange();
    res.json(c);
  } catch (e) {
    next(e);
  }
});
/**
 * The "I need help" button on the member's phone. Always allowed, even if consent was withdrawn:
 * asking for help must never be blocked.
 */
api.post("/help", (req, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string().min(1).max(64) }).parse(req.body);
    const { alert, isNew } = raiseAlert(userId, "help");
    store.addAudit({ user: req.user!.username, action: "help_requested", detail: `${userId} asked for help` });
    emitChange();
    res.json({ alert, isNew });
  } catch (e) {
    next(e);
  }
});

/** Alerts waiting for a response or being handled, with the member's demo name and language. */
/** Adds the member's demo name, language and care circle to alerts. */
function alertViews(list: ReturnType<typeof activeAlerts>) {
  const profiles = profilesFor([...new Set(store.allRecords().map((r) => r.userId))]);
  return list
    .filter((a) => profiles.has(a.userId))
    .map((a) => ({ ...a, name: profiles.get(a.userId)!.name, language: profiles.get(a.userId)!.language, circle: circleFor(a.userId) }));
}

/** Alerts waiting for a response or being handled. */
api.get("/alerts", (_req, res) => {
  res.json(alertViews(activeAlerts()));
});

/**
 * What a family member far away sees: only if the member shared with family and hasn't withdrawn
 * consent. Demo: opened by staff; a real family app would have its own sign-in, invited by the member.
 */
api.get("/family/:userId", (req, res, next) => {
  try {
    const userId = String(req.params.userId).slice(0, 64);
    const profiles = profilesFor([...new Set(store.allRecords().map((r) => r.userId))]);
    const p = profiles.get(userId);
    if (!p) throw new IngestionError("No data for this member.");
    const c = circleFor(userId);
    const sharing = Boolean(c.family) && hasConsent(userId);
    const mine = alertViews(alertsFor(userId));
    res.json({
      name: p.name,
      family: c.family,
      sharing,
      glucose: sharing ? glucoseSummary(userId) : null,
      checkIn: sharing ? recentCheckIn(userId) : null,
      alert: sharing ? (mine.find((a) => a.status !== "resolved") ?? null) : null,
      reports: sharing ? mine.filter((a) => a.report).slice(0, 5) : [],
      medicines: sharing ? medicinesView(userId) : null,
    });
  } catch (e) {
    next(e);
  }
});

/** The family asks for someone to check on the member: it goes to their helper like any other alert. */
api.post("/family/:userId/request", (req, res, next) => {
  try {
    const userId = String(req.params.userId).slice(0, 64);
    const c = circleFor(userId);
    if (!c.family || !hasConsent(userId)) {
      res.status(403).json({ error: "This member hasn't shared with family." });
      return;
    }
    const { alert, isNew } = raiseAlert(userId, "family_request");
    store.addAudit({ user: req.user!.username, action: "family_request", detail: `${userId}: family asked for a check-in` });
    emitChange();
    res.json({ alert, isNew });
  } catch (e) {
    next(e);
  }
});

/** Demo helpers, so staff can act as one on the helper page. */
api.get("/helpers", (_req, res) => res.json(HELPERS));

/** What one helper needs to act on now. */
api.get("/helpers/:id/alerts", (req, res) => {
  res.json(alertViews(alertsForHelper(String(req.params.id).slice(0, 40))));
});

/** A member's care circle and their recent alerts with visit reports. */
api.get("/circle/:userId", (req, res) => {
  const userId = String(req.params.userId).slice(0, 64);
  res.json({ circle: circleFor(userId), alerts: alertViews(alertsFor(userId).slice(0, 10)) });
});

const HelperSchema = z.object({ helperId: z.string().min(1).max(40) });

api.post("/alerts/:id/accept", (req, res, next) => {
  try {
    const { helperId } = HelperSchema.parse(req.body);
    const a = acceptAlert(String(req.params.id), helperId);
    store.addAudit({ user: req.user!.username, action: "alert_accepted", detail: `${a.userId}: accepted by ${a.acceptedBy}` });
    emitChange();
    res.json(a);
  } catch (e) {
    if (e instanceof Error && !(e instanceof z.ZodError)) return res.status(409).json({ error: e.message });
    next(e);
  }
});

api.post("/alerts/:id/decline", (req, res, next) => {
  try {
    const { helperId } = HelperSchema.parse(req.body);
    const a = declineAlert(String(req.params.id), helperId);
    store.addAudit({ user: req.user!.username, action: "alert_declined", detail: `${a.userId}: ${helperId} can't go` });
    emitChange();
    res.json(a);
  } catch (e) {
    if (e instanceof Error && !(e instanceof z.ZodError)) return res.status(409).json({ error: e.message });
    next(e);
  }
});

const ReportSchema = z.object({
  helperId: z.string().min(1).max(40),
  checks: z.object({ seen: z.boolean(), talking: z.boolean(), plan_followed: z.boolean(), care_team_told: z.boolean(), ambulance: z.boolean() }),
  recheckMgdl: z.number().int().min(VALID_RANGE.min).max(VALID_RANGE.max).nullable(),
  note: z.string().max(500).default(""),
});

/** The helper's visit report: a checklist (same meaning in every language), a recheck reading and a note. */
api.post("/alerts/:id/report", (req, res, next) => {
  try {
    const { helperId, ...r } = ReportSchema.parse(req.body);
    const a = reportAlert(String(req.params.id), helperId, r);
    if (r.recheckMgdl) recordReading({ userId: a.userId, mgdl: r.recheckMgdl, kind: "random", source: "helper" });
    store.addAudit({ user: req.user!.username, action: "visit_reported", detail: `${a.userId}: visit reported by ${a.report!.by}` });
    emitChange();
    res.json(a);
  } catch (e) {
    if (e instanceof Error && !(e instanceof z.ZodError)) return res.status(409).json({ error: e.message });
    next(e);
  }
});

/** A member's current medicines and today's doses. */
api.get("/medicines/:userId", (req, res) => {
  res.json(medicinesView(String(req.params.userId).slice(0, 64)));
});

const MedicineSchema = z.object({
  userId: z.string().min(1).max(64),
  name: z.string().trim().min(2).max(60).regex(/^[\p{L}\p{N} .()+-]+$/u, "Use letters, numbers and spaces only."),
  strength: z.object({ value: z.number().positive().max(5000), unit: z.enum(["mg", "g", "mcg", "ml", "units"]) }),
  dose: z.object({ count: z.number().positive().max(100), unit: z.enum(["tablet", "capsule", "units", "ml"]) }),
  times: z.array(z.enum(["morning", "afternoon", "night"])).min(1).max(3),
  food: z.enum(["before", "after", "any"]),
  prescribedBy: z.string().trim().min(2).max(80),
});

/** The care team enters a prescription. Admin only; the app stores it exactly as entered and logs it. */
api.post("/medicines", requireRole("admin"), (req, res, next) => {
  try {
    const body = MedicineSchema.parse(req.body);
    const m = addMedicine({ ...body, times: [...new Set(body.times)], demo: false });
    store.addAudit({ user: req.user!.username, action: "medicine_added", detail: `${body.userId}: prescription entered` });
    emitChange();
    res.json(m);
  } catch (e) {
    next(e);
  }
});

api.post("/medicines/:id/stop", requireRole("admin"), (req, res) => {
  try {
    const m = stopMedicine(String(req.params.id));
    store.addAudit({ user: req.user!.username, action: "medicine_stopped", detail: `${m.userId}: prescription stopped` });
    emitChange();
    res.json(m);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

/** The member marks a dose as taken. Pressing twice records it once. */
api.post("/medicines/:id/taken", (req, res) => {
  try {
    const { userId, slot } = z.object({ userId: z.string().min(1).max(64), slot: z.enum(["morning", "afternoon", "night"]) }).parse(req.body);
    const log = markTaken(userId, String(req.params.id), slot);
    store.addAudit({ user: req.user!.username, action: "dose_taken", detail: `${userId}: ${slot} dose marked taken` });
    emitChange();
    res.json(log);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

const GlucoseSchema = z.object({
  userId: z.string().min(1).max(64),
  mgdl: z.number().int().min(VALID_RANGE.min).max(VALID_RANGE.max),
  kind: z.enum(["fasting", "post_meal", "random"]),
  via: z.enum(["meter", "typed"]).default("typed"), // from a glucometer, or typed in
});

/** A blood glucose reading, entered on the member's phone (or by a helper on a visit). */
api.post("/glucose", (req, res, next) => {
  try {
    const parsed = GlucoseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `Enter a reading between ${VALID_RANGE.min} and ${VALID_RANGE.max} mg/dL.` });
      return;
    }
    const body = parsed.data;
    if (!hasConsent(body.userId)) {
      res.status(403).json({ error: "Readings are off because consent was withdrawn." });
      return;
    }
    const { via, ...reading } = body;
    const r = recordReading({ ...reading, source: via === "meter" ? "device" : req.user!.role === "admin" ? "helper" : "patient" });
    store.addAudit({ user: req.user!.username, action: "glucose_reading", detail: `${body.userId} reading recorded` });
    const l = limitsFor(body.userId);
    const band = bandOf(r.mgdl, l);
    if (band !== "in_range") {
      raiseAlert(body.userId, band === "low" ? "glucose_low" : "glucose_high", { mgdl: r.mgdl, low: l.low, high: l.high });
      store.addAudit({ user: "system", action: "alert_raised", detail: `${body.userId}: ${band} blood sugar` });
    }
    emitChange();
    res.json({ reading: r, summary: glucoseSummary(body.userId) });
  } catch (e) {
    next(e);
  }
});

/** The care team sets a person's low and high alert levels. Admin only, logged. */
api.put("/glucose/:userId/limits", requireRole("admin"), (req, res, next) => {
  try {
    const userId = String(req.params.userId).slice(0, 64);
    const { low, high } = z
      .object({ low: z.number().int().min(40).max(120), high: z.number().int().min(140).max(400) })
      .parse(req.body);
    const l = setLimits(userId, low, high);
    store.addAudit({ user: req.user!.username, action: "glucose_limits", detail: `${userId} alert levels set by care team` });
    emitChange();
    res.json(l);
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
    if (!hasConsent(body.userId)) {
      res.status(403).json({ error: "Check-ins are off because consent was withdrawn." });
      return;
    }
    const c = recordCheckIn(body);
    store.addAudit({ user: req.user!.username, action: "member_checkin", detail: `${body.userId} checked in` });
    if (body.mood === "not_well") {
      raiseAlert(body.userId, "not_well");
      store.addAudit({ user: "system", action: "alert_raised", detail: `${body.userId}: not feeling well` });
    }
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
  const weeks = allMemberWeeks(recs, (w) => applyGlucose(applyConsent(applyCheckIn(w))));
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
    res.json({ ...d, member: applyGlucose(applyConsent(applyCheckIn(d.member))), actions: actionsFor(userId, recs), glucose: glucoseSummary(userId) });
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
    if (!hasConsent(userId)) {
      res.status(403).json({ error: "This member has withdrawn consent, so no AI plan is made for them." });
      return;
    }
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
