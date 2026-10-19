import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { readSecure, writeSecure } from "../security/vault.js";
import { store } from "../store/memoryStore.js";
import { deleteActionsFor } from "./actions.js";
import { deleteCheckInsFor } from "./checkins.js";
import { deleteConsentFor } from "./consent.js";
import { deleteGlucoseFor } from "./glucose.js"

/**
 * Right to erasure. Deleting a member removes everything stored about them, and their
 * pseudonym goes on a "do not import" list so a later upload or device feed can't bring them back.
 * The list holds pseudonyms only, never data.
 */
const FILE = path.resolve(import.meta.dirname, "../../data/erased.json");
const erased = new Set<string>();

if (config.persistData && fs.existsSync(FILE)) {
  try {
    for (const id of readSecure<string[]>(FILE)) erased.add(id);
  } catch {
    console.error("[erasure] could not read erased.json, starting empty");
  }
}
function save() {
  if (!config.persistData) return;
  writeSecure(FILE, [...erased]);
}

export const isErased = (userId: string) => erased.has(userId);
export const erasedCount = () => erased.size;
export const erasedIds = () => [...erased];

export function eraseMember(userId: string) {
  const { records, insights } = store.deleteMember(userId);
  const contacts = deleteActionsFor(userId);
  const checkIns = deleteCheckInsFor(userId);
  deleteConsentFor(userId);
  deleteGlucoseFor(userId);
  erased.add(userId);
  save();
  return { records, insights, contacts, checkIns };
}