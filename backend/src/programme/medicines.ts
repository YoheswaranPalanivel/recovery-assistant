import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DoseSlot, DoseStatus, Medicine, MedicinesView } from "@shared/types";
import { config } from "../config.js";
import { readSecure, writeSecure } from "../security/vault.js";

/**
 * Medicines, exactly as the care team entered them. The app never suggests, calculates, changes or
 * translates a medicine or a dose: the name, strength and dose are shown as entered, and only the
 * timing words (morning, after food) come from the approved word list in the reader's language.
 */
const FILE = path.resolve(import.meta.dirname, "../../data/medicines.json");
type DoseLog = { id: string; userId: string; medicineId: string; slot: DoseSlot; date: string; at: string };
type Saved = { medicines: Medicine[]; taken: DoseLog[] };
let medicines: Medicine[] = [];
let taken: DoseLog[] = [];

if (config.persistData && fs.existsSync(FILE)) {
  try {
    const d = readSecure<Saved>(FILE);
    medicines = d.medicines ?? [];
    taken = d.taken ?? [];
  } catch {
    console.error("[medicines] could not read medicines.json, starting empty");
  }
}
function save() {
  if (config.persistData) writeSecure(FILE, { medicines, taken } satisfies Saved);
}

const today = () => new Date().toISOString().slice(0, 10);

export function addMedicine(m: Omit<Medicine, "id" | "at" | "active">): Medicine {
  const med: Medicine = { ...m, id: randomUUID(), at: new Date().toISOString(), active: true };
  medicines.push(med);
  save();
  return med;
}

/** Stopping keeps the record (who prescribed what, and when), it just no longer shows as current. */
export function stopMedicine(id: string): Medicine {
  const m = medicines.find((x) => x.id === id);
  if (!m) throw new Error("Medicine not found.");
  m.active = false;
  save();
  return m;
}

export function markTaken(userId: string, medicineId: string, slot: DoseSlot): DoseLog {
  const m = medicines.find((x) => x.id === medicineId && x.userId === userId && x.active);
  if (!m) throw new Error("Medicine not found.");
  if (!m.times.includes(slot)) throw new Error("This medicine isn't prescribed for that time.");
  const existing = taken.find((t) => t.medicineId === medicineId && t.slot === slot && t.date === today());
  if (existing) return existing; // pressing twice doesn't record two doses
  const log: DoseLog = { id: randomUUID(), userId, medicineId, slot, date: today(), at: new Date().toISOString() };
  taken.push(log);
  if (taken.length > 50_000) taken.splice(0, taken.length - 50_000);
  save();
  return log;
}

export function medicinesView(userId: string): MedicinesView {
  const current = medicines.filter((m) => m.userId === userId && m.active);
  const d = today();
  const status: DoseStatus[] = current.flatMap((m) =>
    m.times.map((slot) => ({ medicineId: m.id, slot, takenAt: taken.find((t) => t.medicineId === m.id && t.slot === slot && t.date === d)?.at ?? null })),
  );
  return { medicines: current, today: status };
}

export function deleteMedicinesFor(userId: string): number {
  const before = medicines.length;
  medicines = medicines.filter((m) => m.userId !== userId);
  taken = taken.filter((t) => t.userId !== userId);
  save();
  return before - medicines.length;
}

export function clearMedicines() {
  medicines = [];
  taken = [];
  save();
}

/** Demo prescriptions for members with type 2 diabetes, labelled as demo. Real ones come from the care team. */
export function seedDemoMedicines(members: { userId: string; condition: string; prescribedBy: string }[]) {
  let added = 0;
  for (const p of members) {
    if (p.condition !== "Type 2 diabetes" || medicines.some((m) => m.userId === p.userId)) continue;
    medicines.push({
      id: randomUUID(),
      userId: p.userId,
      name: "Metformin",
      strength: { value: 500, unit: "mg" },
      dose: { count: 1, unit: "tablet" },
      times: ["morning", "night"],
      food: "after",
      prescribedBy: p.prescribedBy,
      at: new Date().toISOString(),
      active: true,
      demo: true,
    });
    added++;
  }
  if (added) save();
  return added;
}