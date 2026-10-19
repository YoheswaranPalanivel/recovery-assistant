import fs from "node:fs";
import path from "node:path";
import crypto, { randomUUID } from "node:crypto";
import type { GlucoseBand, GlucoseKind, GlucoseLimits, GlucoseReading, GlucoseSummary, MemberWeek } from "@shared/types";
import { config } from "../config.js";
import { readSecure, writeSecure } from "../security/vault.js";

/**
 * Blood glucose readings (mg/dL) and each person's alert levels.
 * The levels belong to the care team: the app only compares readings with them and never
 * interprets a reading medically. Stored encrypted, like every other data file.
 */
const FILE = path.resolve(import.meta.dirname, "../../data/glucose.json");
type Saved = { readings: GlucoseReading[]; limits: Record<string, GlucoseLimits> };
let readings: GlucoseReading[] = [];
let limits: Record<string, GlucoseLimits> = {};

if (config.persistData && fs.existsSync(FILE)) {
  try {
    const d = readSecure<Saved>(FILE);
    readings = d.readings ?? [];
    limits = d.limits ?? {};
  } catch {
    console.error("[glucose] could not read glucose.json, starting empty");
  }
}
function save() {
  if (config.persistData) writeSecure(FILE, { readings, limits } satisfies Saved);
}

/** Used until the care team sets a person's own levels. Shown as a programme default, never as advice. */
export const DEFAULT_LIMITS: GlucoseLimits = { low: 70, high: 250, setBy: "default", at: null };
/** Readings outside this range are almost certainly typing mistakes (a glucometer reads about 20 to 600). */
export const VALID_RANGE = { min: 20, max: 600 };

export const limitsFor = (userId: string): GlucoseLimits => limits[userId] ?? DEFAULT_LIMITS;

export function setLimits(userId: string, low: number, high: number): GlucoseLimits {
  limits[userId] = { low, high, setBy: "care_team", at: new Date().toISOString() };
  save();
  return limits[userId];
}

export const bandOf = (mgdl: number, l: GlucoseLimits): GlucoseBand => (mgdl < l.low ? "low" : mgdl > l.high ? "high" : "in_range");

export function recordReading(r: { userId: string; mgdl: number; kind: GlucoseKind; source: GlucoseReading["source"]; at?: string }): GlucoseReading {
  const reading: GlucoseReading = { id: randomUUID(), at: r.at ?? new Date().toISOString(), userId: r.userId, mgdl: Math.round(r.mgdl), kind: r.kind, source: r.source };
  readings.push(reading);
  if (readings.length > 50_000) readings.splice(0, readings.length - 50_000);
  save();
  return reading;
}

export function glucoseSummary(userId: string): GlucoseSummary {
  const l = limitsFor(userId);
  const now = Date.now();
  const mine = readings.filter((r) => r.userId === userId && now - Date.parse(r.at) <= 14 * 864e5).sort((a, b) => a.at.localeCompare(b.at));
  const latest = mine.at(-1) ?? null;
  const week = mine.filter((r) => now - Date.parse(r.at) <= 7 * 864e5);
  const low = week.filter((r) => bandOf(r.mgdl, l) === "low").length;
  const high = week.filter((r) => bandOf(r.mgdl, l) === "high").length;
  return {
    latest: latest ? { ...latest, band: bandOf(latest.mgdl, l) } : null,
    limits: l,
    readings: mine,
    last7: { count: week.length, low, high, inRangePct: week.length ? Math.round(((week.length - low - high) / week.length) * 100) : null },
  };
}

/** Adds the glucose summary to a member's card. Alerts come from it in a later step. */
export const applyGlucose = (w: MemberWeek): MemberWeek => ({ ...w, glucose: glucoseSummary(w.profile.userId) });

export function deleteGlucoseFor(userId: string): number {
  const before = readings.length;
  readings = readings.filter((r) => r.userId !== userId);
  delete limits[userId];
  save();
  return before - readings.length;
}

export function clearGlucose() {
  readings = [];
  limits = {};
  save();
}

// ---------- demo readings ----------

/** Small seeded random generator, so every load gives the same demo readings. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Demo readings for the last 14 days, because the Fitbit dataset has no glucose. Most people stay
 * in range; a few run high, a few have the odd low. Clearly labelled "demo" wherever it shows.
 */
export function seedDemoGlucose(userIds: string[]) {
  const now = Date.now();
  let added = 0;
  for (const userId of userIds) {
    if (readings.some((r) => r.userId === userId)) continue;
    const h = parseInt(crypto.createHash("sha256").update(`glucose:${userId}`).digest("hex").slice(0, 8), 16);
    const pattern = h % 10; // 0-5 steady, 6-7 runs high, 8 occasional lows, 9 swings
    const rand = rng(h);
    for (let d = 13; d >= 0; d--) {
      const day = new Date(now - d * 864e5);
      const morning = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 2, 0); // about 7:30 am in India
      const base = pattern <= 5 ? 105 + rand() * 40 : pattern <= 7 ? 205 + rand() * 60 : pattern === 8 ? (rand() < 0.25 ? 58 + rand() * 9 : 92 + rand() * 25) : 75 + rand() * 150;
      if (morning <= now) {
        readings.push({ id: randomUUID(), userId, at: new Date(morning).toISOString(), mgdl: Math.round(base), kind: "fasting", source: "demo" });
        added++;
      }
      const afternoon = morning + 6.5 * 36e5; // about 2 pm
      if (d % 2 === 0 && afternoon <= now) {
        readings.push({ id: randomUUID(), userId, at: new Date(afternoon).toISOString(), mgdl: Math.round(base + 35 + rand() * 45), kind: "post_meal", source: "demo" });
        added++;
      }
    }
  }
  if (added) save();
  return added;
}