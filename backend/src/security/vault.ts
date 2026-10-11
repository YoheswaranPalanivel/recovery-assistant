import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/**
 * Encryption at rest for every data file (records, contacts, check-ins, the erasure list).
 * AES-256-GCM: a fresh random IV for each write, and an auth tag, so a changed or swapped
 * file is rejected instead of being read. Older plain-JSON files are still read, and are
 * encrypted the next time they're saved.
 */
type Sealed = { v: 1; alg: "aes-256-gcm"; iv: string; tag: string; data: string };

function seal(obj: unknown, label: string): Sealed {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", config.dataKey, iv);
  cipher.setAAD(Buffer.from(label)); // ties the content to its file name
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return { v: 1, alg: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

function open<T>(s: Sealed, label: string): T {
  const decipher = crypto.createDecipheriv("aes-256-gcm", config.dataKey, Buffer.from(s.iv, "base64"));
  decipher.setAAD(Buffer.from(label));
  decipher.setAuthTag(Buffer.from(s.tag, "base64"));
  const text = Buffer.concat([decipher.update(Buffer.from(s.data, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(text) as T;
}

/** Writes an encrypted file atomically (temp file, then rename). */
export function writeSecure(file: string, obj: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(seal(obj, path.basename(file))), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Reads an encrypted file (or an older plain one). Throws if it was changed or the key is wrong. */
export function readSecure<T>(file: string): T {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (parsed && parsed.alg === "aes-256-gcm" && parsed.v === 1) return open<T>(parsed as Sealed, path.basename(file));
  return parsed as T; // plain JSON from before encryption was added
}