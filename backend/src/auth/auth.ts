import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Role, SessionUser } from "@shared/types";
import { config } from "../config.js";

export const SESSION_COOKIE = "ra_session";

// Passwords are hashed once at startup (scrypt + random salt); plain text is not kept around.
const users = config.auth.users.map((u) => {
  const salt = crypto.randomBytes(16);
  return { username: u.username, role: u.role, salt, hash: crypto.scryptSync(u.password, salt, 64) };
});

/** Constant-time check, and the same work is done for unknown usernames (no user enumeration). */
export function verifyLogin(username: string, password: string): SessionUser | null {
  const u = users.find((x) => x.username === username);
  const salt = u?.salt ?? crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  if (!u || !crypto.timingSafeEqual(hash, u.hash)) return null;
  return { username: u.username, role: u.role };
}

export function issueToken(user: SessionUser) {
  return jwt.sign(user, config.auth.jwtSecret, { expiresIn: `${config.auth.sessionHours}h`, algorithm: "HS256" });
}

export function readToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, config.auth.jwtSecret, { algorithms: ["HS256"] }) as SessionUser;
    return { username: p.username, role: p.role };
  } catch {
    return null;
  }
}

/** httpOnly: JavaScript can't read it (XSS can't steal it). SameSite=Lax: not sent on cross-site POSTs (CSRF). */
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.production,
  maxAge: config.auth.sessionHours * 3600 * 1000,
  path: "/",
});

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = readToken(req.cookies?.[SESSION_COOKIE]);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  req.user = user;
  next();
}

export const requireRole = (role: Role) => (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== role) return res.status(403).json({ error: `Only ${role} users can do this.` });
  next();
};

/** Machine-to-machine auth for the streaming endpoint (device integration / replay simulator). */
export function requireIngestKey(req: Request, res: Response, next: NextFunction) {
  const expected = config.auth.ingestApiKey;
  const given = req.get("x-api-key") ?? "";
  if (!expected) return res.status(503).json({ error: "Streaming is disabled: set INGEST_API_KEY in backend/.env." });
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Invalid ingest API key." });
  next();
}

/** Extra CSRF defence: state-changing browser requests must come from our frontend. */
export function checkOrigin(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && origin !== config.frontendOrigin) return res.status(403).json({ error: "Request origin not allowed." });
  next();
}
