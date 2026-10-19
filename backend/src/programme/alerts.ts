import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CareAlert, CareAlertKind } from "@shared/types";
import { config } from "../config.js";
import { readSecure, writeSecure } from "../security/vault.js";

/**
 * Care alerts: a low or high reading, "not feeling well", or the "I need help" button.
 * Each one waits for a person to respond; the next step adds who responds and escalation.
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

const SEVERITY: Record<CareAlertKind, CareAlert["severity"]> = {
  glucose_low: "urgent",
  help: "urgent",
  glucose_high: "attention",
  not_well: "attention",
};

/**
 * Raises an alert. If the same kind is already open for this person, it is updated rather than
 * duplicated, so a worried member pressing "help" three times doesn't create three alerts.
 */
export function raiseAlert(userId: string, kind: CareAlertKind, data: CareAlert["data"] = {}): { alert: CareAlert; isNew: boolean } {
  const open = alerts.find((a) => a.userId === userId && a.kind === kind && a.status !== "resolved");
  if (open) {
    open.at = new Date().toISOString();
    open.data = data;
    save();
    return { alert: open, isNew: false };
  }
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
  };
  alerts.unshift(alert);
  if (alerts.length > 5000) alerts.length = 5000;
  save();
  return { alert, isNew: true };
}

/** Alerts still waiting or being handled, most urgent first, then newest. */
export const activeAlerts = () =>
  alerts
    .filter((a) => a.status !== "resolved")
    .sort((a, b) => (a.severity === b.severity ? b.at.localeCompare(a.at) : a.severity === "urgent" ? -1 : 1));

export const alertsFor = (userId: string) => alerts.filter((a) => a.userId === userId);

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