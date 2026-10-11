import fs from "node:fs";
import path from "node:path";
import type { Consent, MemberWeek } from "@shared/types";
import { config } from "../config.js";
import { readSecure, writeSecure } from "../security/vault.js";

/**
 * Consent: members agree at enrolment and can withdraw, or give it again, at any time from
 * their phone. While it's withdrawn there are no AI plans, no messages and no check-ins.
 * Every change is kept (encrypted), so the history can be shown if it's ever questioned.
 */
type Entry = { userId: string; status: Consent["status"]; at: string; source: Consent["source"] };

const FILE = path.resolve(import.meta.dirname, "../../data/consents.json");
let history: Entry[] = [];

if (config.persistData && fs.existsSync(FILE)) {
  try {
    history = readSecure<Entry[]>(FILE);
  } catch {
    console.error("[consent] could not read consents.json, starting empty");
  }
}
function save() {
  if (config.persistData) writeSecure(FILE, history);
}

const AT_ENROLMENT: Consent = { status: "given", at: null, source: "enrolment" };

/** The member's current consent: the latest change, or the consent given at enrolment. */
export function consentOf(userId: string): Consent {
  const e = history.find((h) => h.userId === userId);
  return e ? { status: e.status, at: e.at, source: e.source } : AT_ENROLMENT;
}

export const hasConsent = (userId: string) => consentOf(userId).status === "given";

export function recordConsent(userId: string, status: Consent["status"], source: Consent["source"]): Consent {
  history.unshift({ userId, status, at: new Date().toISOString(), source });
  save();
  return consentOf(userId);
}

export function deleteConsentFor(userId: string): number {
  const before = history.length;
  history = history.filter((h) => h.userId !== userId);
  save();
  return before - history.length;
}

export function clearConsents() {
  history = [];
  save();
}

/** Shows the consent on the member's card, with a clear reason when it's withdrawn. */
export function applyConsent(w: MemberWeek): MemberWeek {
  const c = consentOf(w.profile.userId);
  if (c.status === "given") return { ...w, consent: c };
  return { ...w, consent: c, reasons: ["Consent withdrawn: no plans or messages", ...w.reasons] };
}