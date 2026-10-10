import fs from "node:fs";
import path from "node:path";
import type { AuditEntry, DailyRecord, IngestionBatch, Insight, RejectedRow } from "@shared/types";
import type { SleepEntry } from "../ingestion/validator.js";
import { config } from "../config.js";

/**
 * In-memory store with a JSON snapshot on disk, so a backend restart doesn't
 * empty the dashboard. Every read/write goes through this module, so moving to
 * PostgreSQL later means re-implementing these functions only.
 *
 * The snapshot only ever holds pseudonymised ids (see ingestion/pseudonymise.ts).
 */

const records = new Map<string, DailyRecord>(); // key: userId|date
const pendingSleep = new Map<string, number>(); // sleep rows that arrived before activity rows
const batches: IngestionBatch[] = [];
const rejections: RejectedRow[] = [];
const insights: Insight[] = [];
const fieldsSeen = new Set<string>();
const reasonCounts = new Map<string, number>(); // rejection reason -> number of rows
const audit: AuditEntry[] = [];

const key = (userId: string, date: string) => `${userId}|${date}`;

// ---------- persistence ----------

const SNAPSHOT = path.resolve(import.meta.dirname, "../../data/store.json");
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (!config.persistData) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 800);
}

function saveNow() {
  try {
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      records: [...records.values()],
      pendingSleep: [...pendingSleep],
      batches,
      rejections,
      insights,
      fieldsSeen: [...fieldsSeen],
      reasonCounts: [...reasonCounts],
      audit,
    };
    const tmp = `${SNAPSHOT}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, SNAPSHOT); // atomic replace: never a half-written file
  } catch (e) {
    console.error("[store] could not save snapshot:", (e as Error).message);
  }
}

export function loadSnapshot(): number {
  if (!config.persistData || !fs.existsSync(SNAPSHOT)) return 0;
  try {
    const d = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
    for (const r of d.records ?? []) records.set(key(r.userId, r.date), r);
    for (const [k, v] of d.pendingSleep ?? []) pendingSleep.set(k, v);
    batches.push(...(d.batches ?? []));
    rejections.push(...(d.rejections ?? []));
    insights.push(...(d.insights ?? []));
    (d.fieldsSeen ?? []).forEach((f: string) => fieldsSeen.add(f));
    for (const [k, v] of d.reasonCounts ?? []) reasonCounts.set(k, v);
    audit.push(...(d.audit ?? []));
    return records.size;
  } catch (e) {
    console.error("[store] snapshot unreadable, starting empty:", (e as Error).message);
    return 0;
  }
}

// ---------- store API ----------

export const store = {
  /** Returns "inserted" or "duplicate" (same user + date already stored). */
  upsertRecord(r: DailyRecord): "inserted" | "duplicate" {
    const k = key(r.userId, r.date);
    if (records.has(k)) return "duplicate";
    const sleep = pendingSleep.get(k);
    if (r.sleepHours === null && sleep !== undefined) {
      r.sleepHours = sleep;
      pendingSleep.delete(k);
    }
    records.set(k, r);
    trackFields(r);
    scheduleSave();
    return "inserted";
  },

  mergeSleep(s: SleepEntry): "merged" | "pending" | "duplicate" {
    const k = key(s.userId, s.date);
    const existing = records.get(k);
    scheduleSave();
    if (existing) {
      if (existing.sleepHours !== null) return "duplicate";
      existing.sleepHours = s.sleepHours;
      fieldsSeen.add("sleepHours");
      return "merged";
    }
    if (pendingSleep.has(k)) return "duplicate";
    pendingSleep.set(k, s.sleepHours);
    fieldsSeen.add("sleepHours");
    return "pending";
  },

  allRecords(): DailyRecord[] {
    return [...records.values()];
  },

  recordCount: () => records.size,

  addBatch(b: IngestionBatch) {
    batches.unshift(b);
    if (batches.length > 200) batches.length = 200;
    scheduleSave();
  },
  batches: () => batches,

  addRejections(rows: RejectedRow[]) {
    // Count every rejected row by reason, even beyond the 500 rows kept for display.
    for (const r of rows) reasonCounts.set(r.reason, (reasonCounts.get(r.reason) ?? 0) + 1);
    rejections.unshift(...rows.slice(0, 500));
    if (rejections.length > 500) rejections.length = 500;
    scheduleSave();
  },
  rejections: () => rejections,
  rejectionReasons: () =>
    [...reasonCounts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),

  addInsight(i: Insight) {
    insights.unshift(i);
    if (insights.length > 300) insights.length = 300;
    scheduleSave();
  },
  insights: (userId?: string) => (userId ? insights.filter((i) => i.userId === userId) : insights),
  insightCount: () => insights.length,

  availableFields: () => [...fieldsSeen],

  /** Who did what, when. Never stores data values, only actions. */
  addAudit(e: Omit<AuditEntry, "at">) {
    audit.unshift({ at: new Date().toISOString(), ...e });
    if (audit.length > 300) audit.length = 300;
    scheduleSave();
  },
  audit: () => audit,


    /** Removes everything stored about one member: daily records, waiting sleep rows and AI messages. */
  deleteMember(userId: string): { records: number; insights: number } {
    let n = 0;
    for (const k of [...records.keys()]) if (k.startsWith(`${userId}|`) && records.delete(k)) n++;
    for (const k of [...pendingSleep.keys()]) if (k.startsWith(`${userId}|`)) pendingSleep.delete(k);
    const before = insights.length;
    const keep = insights.filter((i) => i.userId !== userId);
    insights.length = 0;
    insights.push(...keep);
    scheduleSave();
    return { records: n, insights: before - keep.length };
  },

  /** Clears the data. The audit log is kept, so a reset itself stays traceable. */
  reset() {
    records.clear();
    pendingSleep.clear();
    batches.length = 0;
    rejections.length = 0;
    insights.length = 0;
    fieldsSeen.clear();
    reasonCounts.clear();
    scheduleSave();
  },
};

function trackFields(r: DailyRecord) {
  for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) fieldsSeen.add(k);
}
