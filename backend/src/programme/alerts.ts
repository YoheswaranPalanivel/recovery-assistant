import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AlertEvent, CareAlert, CareAlertKind, VisitReport } from "@shared/types";
import { config } from "../config.js";
import { readSecure, writeSecure } from "../security/vault.js";
import { circleFor, helperById } from "./circle.js";

/**
 * Care alerts: a low or high reading, "not feeling well", or the "I need help" button.
 * Each goes to the member's primary helper first (and their family, if urgent). If nobody accepts in
 * time it escalates to the backup helper and asks the family to call; for urgent alerts, if still nobody
 * has accepted, the family is shown the emergency number.
 */
const FILE = path.resolve(import.meta.dirname, "../../data/alerts.json");
let alerts: CareAlert[] = [];

if (config.persistData && fs.existsSync(FILE)) {
  try {
    alerts = readSecure<CareAlert[]>(FILE);
  } catch {
    console.error("[alerts] could not read alerts.json, starting empty");
  }
}
function save() {
  if (config.persistData) writeSecure(FILE, alerts);
}

/**
 * Escalation timings. Real programme: 600 s (10 minutes) and 1200 s (20 minutes).
 * The demo defaults are short so escalation can be shown live.
 */
export const ESCALATE_AFTER_MS = Number(process.env.ESCALATE_AFTER_SECONDS ?? 30) * 1000;
export const EMERGENCY_AFTER_MS = Number(process.env.EMERGENCY_AFTER_SECONDS ?? 60) * 1000;

const SEVERITY: Record<CareAlertKind, CareAlert["severity"]> = {
  glucose_low: "urgent",
  help: "urgent",
  glucose_high: "attention",
  not_well: "attention",
  family_request: "attention",
};
const WHAT: Record<CareAlertKind, string> = {
  glucose_low: "low blood sugar",
  glucose_high: "high blood sugar",
  not_well: "not feeling well",
  help: "asked for help",
  family_request: "family asked for someone to check on them",
};

const event = (a: CareAlert, kind: AlertEvent["kind"], text: string) => a.timeline.push({ at: new Date().toISOString(), kind, text });

/**
 * Raises an alert. If the same kind is already open for this person, it is updated rather than
 * duplicated, so a worried member pressing "help" three times doesn't create three alerts.
 */
export function raiseAlert(userId: string, kind: CareAlertKind, data: CareAlert["data"] = {}): { alert: CareAlert; isNew: boolean } {
  const open = alerts.find((a) => a.userId === userId && a.kind === kind && a.status !== "resolved");
  if (open) {
    open.at = new Date().toISOString();
    open.data = data;
    event(open, "raised", `Raised again: ${WHAT[kind]}${data.mgdl ? ` (${data.mgdl} mg/dL)` : ""}`);
    save();
    return { alert: open, isNew: false };
  }
  const c = circleFor(userId);
  const alert: CareAlert = {
    id: randomUUID(),
    userId,
    kind,
    severity: SEVERITY[kind],
    at: new Date().toISOString(),
    data,
    status: "open",
    acceptedBy: null,
    acceptedAt: null,
    resolvedAt: null,
    primaryId: c.primary.id,
    backupId: c.backup.id,
    level: 0,
    timeline: [],
    report: null,
  };
  event(alert, "raised", `Raised: ${WHAT[kind]}${data.mgdl ? ` (${data.mgdl} mg/dL)` : ""}`);
  const urgentFamily = alert.severity === "urgent" && c.family ? ` and ${c.family.name} (${c.family.relation}, ${c.family.place})` : "";
  event(alert, "sent", `Sent to ${c.primary.name} (helper, ${c.primary.area})${urgentFamily}`);
  alerts.unshift(alert);
  if (alerts.length > 5000) alerts.length = 5000;
  save();
  return { alert, isNew: true };
}

/** A helper accepts: the other helper and the family are told who is going. */
export function acceptAlert(id: string, helperId: string): CareAlert {
  const a = alerts.find((x) => x.id === id);
  const h = helperById(helperId);
  if (!a || !h) throw new Error("Alert or helper not found.");
  if (a.status !== "open") throw new Error(a.status === "accepted" ? `Already accepted by ${a.acceptedBy}.` : "This alert is closed.");
  if (helperId !== a.primaryId && !(helperId === a.backupId && a.level >= 1)) throw new Error("This alert isn't with you yet.");
  a.status = "accepted";
  a.acceptedBy = h.name;
  a.acceptedAt = new Date().toISOString();
  const c = circleFor(a.userId);
  event(a, "accepted", `${h.name} accepted and is on the way${c.family ? `; ${c.family.name} told` : ""}`);
  save();
  return a;
}

/** The first helper can't go: the backup is asked straight away, without waiting for the timer. */
export function declineAlert(id: string, helperId: string): CareAlert {
  const a = alerts.find((x) => x.id === id);
  const h = helperById(helperId);
  if (!a || !h) throw new Error("Alert or helper not found.");
  if (a.status !== "open") throw new Error("This alert is no longer waiting.");
  event(a, "declined", `${h.name} can't go`);
  if (a.level === 0) escalate(a, "the first helper can't go");
  save();
  return a;
}

/** The visit report closes the alert; the family and care team see the checklist in their own language. */
export function reportAlert(id: string, helperId: string, r: Omit<VisitReport, "at" | "by">): CareAlert {
  const a = alerts.find((x) => x.id === id);
  const h = helperById(helperId);
  if (!a || !h) throw new Error("Alert or helper not found.");
  if (a.status !== "accepted" || a.acceptedBy !== h.name) throw new Error("Only the helper who accepted can report.");
  a.report = { ...r, at: new Date().toISOString(), by: h.name };
  a.status = "resolved";
  a.resolvedAt = a.report.at;
  const c = circleFor(a.userId);
  event(a, "reported", `${h.name} reported the visit${r.recheckMgdl ? ` (recheck ${r.recheckMgdl} mg/dL)` : ""}; sent to ${c.family ? `${c.family.name} and ` : ""}${c.careTeam.name}`);
  save();
  return a;
}

function escalate(a: CareAlert, why: string) {
  const c = circleFor(a.userId);
  a.level = 1;
  event(a, "escalated", `Sent to ${c.backup.name} (backup helper) because ${why}`);
  if (c.family) event(a, "family_call", `${c.family.name} asked to call now`);
}

/** Runs every few seconds: escalates alerts nobody has accepted in time. Returns true if anything changed. */
export function checkEscalations(now = Date.now()): boolean {
  let changed = false;
  for (const a of alerts) {
    if (a.status !== "open") continue;
    const waited = now - Date.parse(a.timeline[0]?.at ?? a.at);
    if (a.level === 0 && waited >= ESCALATE_AFTER_MS) {
      escalate(a, `nobody accepted in ${Math.round(ESCALATE_AFTER_MS / 1000)} seconds`);
      changed = true;
    } else if (a.level === 1 && a.severity === "urgent" && waited >= EMERGENCY_AFTER_MS) {
      const c = circleFor(a.userId);
      a.level = 2;
      event(a, "emergency", c.family ? `Still nobody: ${c.family.name} shown the emergency number (108)` : "Still nobody: programme lead alerted to call 108");
      changed = true;
    }
  }
  if (changed) save();
  return changed;
}

/** Alerts still waiting or being handled, most urgent first, then newest. */
export const activeAlerts = () =>
  alerts
    .filter((a) => a.status !== "resolved")
    .sort((a, b) => (a.severity === b.severity ? b.at.localeCompare(a.at) : a.severity === "urgent" ? -1 : 1));

export const alertsFor = (userId: string) => alerts.filter((a) => a.userId === userId);

/** What one helper needs to act on: alerts with them now, plus the ones they accepted. */
export const alertsForHelper = (helperId: string) =>
  alerts.filter(
    (a) =>
      a.status !== "resolved" &&
      ((a.status === "open" && (a.primaryId === helperId || (a.backupId === helperId && a.level >= 1))) ||
        (a.status === "accepted" && helperById(helperId)?.name === a.acceptedBy)),
  );

export function deleteAlertsFor(userId: string): number {
  const before = alerts.length;
  alerts = alerts.filter((a) => a.userId !== userId);
  save();
  return before - alerts.length;
}

export function clearAlerts() {
  alerts = [];
  save();
}