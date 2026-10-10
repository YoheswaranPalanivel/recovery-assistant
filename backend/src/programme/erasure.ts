import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { store } from "../store/memoryStore.js";
import { deleteActionsFor } from "./actions.js";
import { deleteCheckInsFor } from "./checkins.js";

/**
 * Right to erasure. Deleting a member removes everything stored about them, and their
 * pseudonym goes on a "do not import" list so a later upload or device feed can't bring them back.
 * The list holds pseudonyms only, never data.
 */
const FILE = path.resolve(import.meta.dirname, "../../data/erased.json");
const erased = new Set<string>();

if (config.persistData && fs.existsSync(FILE)) {
  try {
    for (const id of JSON.parse(fs.readFileSync(FILE, "utf8")) as string[]) erased.add(id);
  } catch {
    console.error("[erasure] could not read erased.json, starting empty");
  }
}
function save() {
  if (!config.persistData) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify([...erased]));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

export const isErased = (userId: string) => erased.has(userId);
export const erasedCount = () => erased.size;
export const erasedIds = () => [...erased];

export function eraseMember(userId: string) {
  const { records, insights } = store.deleteMember(userId);
  const contacts = deleteActionsFor(userId);
  const checkIns = deleteCheckInsFor(userId);
  erased.add(userId);
  save();
  return { records, insights, contacts, checkIns };
}