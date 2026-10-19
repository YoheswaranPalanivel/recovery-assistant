import crypto from "node:crypto";
import type { CareCircle, FamilyContact, Helper } from "@shared/types";
import { profilesFor } from "./profiles.js";

/**
 * Demo care circles. In a real programme these are set at enrolment: the nearest trained helpers,
 * family the member agreed to share with, and their clinic. Here they are chosen from small demo lists
 * so every member has one, always the same.
 */
export const HELPERS: Helper[] = [
  { id: "h-ravi", name: "Ravi", area: "Anna Nagar", language: "Tamil" },
  { id: "h-selvi", name: "Selvi", area: "Anna Nagar", language: "Tamil" },
  { id: "h-meena", name: "Meena", area: "K K Nagar", language: "Tamil" },
  { id: "h-karthik", name: "Karthik", area: "K K Nagar", language: "Tamil" },
  { id: "h-anand", name: "Anand", area: "Tallakulam", language: "English" },
  { id: "h-farida", name: "Farida", area: "Tallakulam", language: "Tamil" },
];

const FAMILY: Omit<FamilyContact, "name">[] = [
  { relation: "son", place: "Singapore", language: "English" },
  { relation: "daughter", place: "Bengaluru", language: "English" },
  { relation: "son", place: "Dubai", language: "Tamil" },
  { relation: "daughter", place: "Chennai", language: "Tamil" },
];
const FAMILY_NAMES: Record<string, string[]> = { son: ["Arun", "Karthik", "Suresh", "Vignesh"], daughter: ["Divya", "Priya", "Anitha", "Kavya"] };
const CLINICS: CareCircle["careTeam"][] = [
  { name: "Dr. Sharma, City Diabetes Clinic", language: "Hindi" },
  { name: "Dr. Lakshmanan, Primary Health Centre", language: "Tamil" },
];

const hash = (s: string) => parseInt(crypto.createHash("sha256").update(s).digest("hex").slice(0, 8), 16);

export function circleFor(userId: string): CareCircle {
  const h = hash(`circle:${userId}`);
  const area = Math.floor((h % HELPERS.length) / 2) * 2; // helpers come in pairs by area
  const [a, b] = h % 2 ? [HELPERS[area], HELPERS[area + 1]] : [HELPERS[area + 1], HELPERS[area]];
  const hasFamily = h % 10 < 7; // most demo members share with one family member
  const f = FAMILY[(h >>> 4) % FAMILY.length];
  return {
    userId,
    primary: a,
    backup: b,
    family: hasFamily ? { ...f, name: FAMILY_NAMES[f.relation][(h >>> 8) % 4] } : null,
    careTeam: CLINICS[(h >>> 12) % CLINICS.length],
  };
}

export const helperById = (id: string) => HELPERS.find((x) => x.id === id) ?? null;

/** The member's demo name, for messages to helpers and family. */
export function nameOf(userId: string, allIds: string[]) {
  return profilesFor(allIds).get(userId)?.name ?? userId;
}