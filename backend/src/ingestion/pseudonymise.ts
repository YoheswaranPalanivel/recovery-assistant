import crypto from "node:crypto";
import { config } from "../config.js";

/**
 * Replaces the dataset's user id with a keyed hash (HMAC-SHA256) before anything
 * is stored. The same source id always maps to the same pseudonym, so analytics
 * still work per person, but the original id never reaches storage, the UI or the LLM.
 */
export function pseudonymise(rawId: string): string {
  if (!rawId) return "";
  return "P-" + crypto.createHmac("sha256", config.pseudonymSecret).update(rawId).digest("hex").slice(0, 8);
}
