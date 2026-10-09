import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CheckIn, MemberWeek } from "@shared/types";
import { config } from "../config.js";

/** Daily check-ins sent from the member's phone. Kept in their own small file. */
const FILE = path.resolve(import.meta.dirname, "../../data/checkins.json");
let checkIns: CheckIn[] = [];

if (config.persistData && fs.existsSync(FILE)) {
  try {
    checkIns = JSON.parse(fs.readFileSync(FILE, "utf8")) as CheckIn[];
  } catch {
    console.error("[checkins] could not read checkins.json, starting empty");
  }
}
function save() {
  if (!config.persistData) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(checkIns));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

export function recordCheckIn(c: Omit<CheckIn, "id" | "at">): CheckIn {
  const item: CheckIn = { id: randomUUID(), at: new Date().toISOString(), ...c };
  checkIns.unshift(item);
  if (checkIns.length > 5000) checkIns.length = 5000;
  save();
  return item;
}

export function clearCheckIns() {
  checkIns = [];
  save();
}

/** The member's most recent check-in, if it was sent in the last 24 hours. */
export function recentCheckIn(userId: string): CheckIn | null {
  const c = checkIns.find((x) => x.userId === userId);
  return c && Date.now() - Date.parse(c.at) < 24 * 3600 * 1000 ? c : null;
}

/**
 * What a member says about themselves changes their status, on top of the device data:
 * "not feeling well" puts them at the top of the health worker's list.
 */
export function applyCheckIn(w: MemberWeek): MemberWeek {
  const c = recentCheckIn(w.profile.userId);
  if (!c) return w;
  const reasons = [...w.reasons];
  let status = w.status;
  if (c.mood === "not_well") {
    reasons.unshift("Said they're not feeling well today");
    status = "needs_support";
  }
  if (c.medicineTaken === false) {
    reasons.push("Missed medicine today (from their check-in)");
    if (status === "on_track" || status === "needs_rest") status = "slipping";
  }
  return { ...w, status, reasons, checkIn: c };
}