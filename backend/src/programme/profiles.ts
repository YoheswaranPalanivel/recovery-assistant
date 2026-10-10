import crypto from "node:crypto";
import type { MemberProfile } from "@shared/types";
import { erasedIds } from "./erasure.js";

/**
 * DEMO PROFILES. The Fitbit dataset has no names, ages or conditions, so each
 * pseudonym gets a sample profile. They are labelled demo: true and shown as
 * demo data in the UI. In a real programme they come from an onboarding form,
 * with consent.
 */
const NAMES = [
  "Lakshmi", "Ravi", "Fatima", "Murugan", "Anita", "Joseph", "Kavitha", "Senthil", "Priya", "Arjun",
  "Meenakshi", "Karthik", "Saroja", "Imran", "Divya", "Ganesh", "Revathi", "Suresh", "Nandhini", "Vijay",
  "Shanthi", "Prakash", "Deepa", "Rahim", "Uma", "Balaji", "Geetha", "Mohan", "Sangeetha", "Kumar",
  "Radha", "Selvam", "Pooja", "Ashok", "Malathi", "Dinesh", "Vasantha", "Rajesh", "Kamala", "Hari",
];
const PREFERS = ["morning walks", "evening walks", "yoga at home", "walking after meals", "temple walks", "home exercises"];

const pick = <T,>(xs: readonly T[], h: number) => xs[h % xs.length];
const hash = (s: string) => parseInt(crypto.createHash("sha256").update(s).digest("hex").slice(0, 8), 16);

let cache: Map<string, MemberProfile> | null = null;
let cacheKey = "";

/** Same pseudonym, same profile, every time. Names are unique across members. */
export function profilesFor(userIds: string[]): Map<string, MemberProfile> {
  // erased members keep their place, so deleting someone never renames anyone else
  const sorted = [...new Set([...userIds, ...erasedIds()])].sort();
  const key = sorted.join(",");
  if (cache && cacheKey === key) return cache;
  const map = new Map<string, MemberProfile>();
  sorted.forEach((userId, i) => {
    const h = hash(userId);
    const ageBand = pick(["30-44", "45-59", "45-59", "60+"] as const, h);
    map.set(userId, {
      userId,
      name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""),
      ageBand,
      condition: pick(["Type 2 diabetes", "Type 2 diabetes", "Pre-diabetes"] as const, h >>> 3),
      // older members are more likely to have limited mobility in the sample
      mobility: (ageBand === "60+" ? h % 2 === 0 : h % 5 === 0) ? "limited" : "normal",
      prefers: pick(PREFERS, h >>> 5),
      language: pick(["Tamil", "Tamil", "English"] as const, h >>> 7),
      demo: true,
    });
  });
  cache = map;
  cacheKey = key;
  return map;
}