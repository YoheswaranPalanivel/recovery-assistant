import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { Server } from "socket.io";
import multer from "multer";
import { ZodError } from "zod";
import { config } from "./config.js";
import { api } from "./routes/api.js";
import { IngestionError } from "./ingestion/ingest.js";
import { attachRealtime } from "./realtime.js";
import { llmLabel } from "./llm/llmClient.js";
import { checkOrigin, readToken, SESSION_COOKIE } from "./auth/auth.js";
import { loadSnapshot } from "./store/memoryStore.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet()); // security headers: no sniffing, no framing, strict referrer, etc.
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(checkOrigin);
app.use("/api", api);

// Errors: clear message to the client, no stack traces or data in responses.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof IngestionError) return res.status(400).json({ error: err.message });
  if (err instanceof ZodError) return res.status(400).json({ error: "Invalid request body.", details: err.issues.map((i) => i.message) });
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? `File is larger than ${config.maxUploadMb} MB.` : err.message;
    return res.status(400).json({ error: msg });
  }
  console.error("[error]", (err as Error)?.message ?? err);
  res.status(500).json({ error: "Something went wrong on the server. Check the backend console." });
});

const server = createServer(app);
const io = new Server(server, { cors: { origin: config.frontendOrigin, credentials: true } });

// Live updates only for signed-in users: the socket handshake carries the same session cookie.
io.use((socket, next) => {
  const cookies = Object.fromEntries(
    (socket.handshake.headers.cookie ?? "").split(";").map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
    }),
  );
  if (!readToken(cookies[SESSION_COOKIE])) return next(new Error("unauthorised"));
  next();
});
attachRealtime(io);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  Port ${config.port} is already in use: another backend is probably still running.`);
    console.error(`  Stop it (Ctrl+C in its terminal), or run: netstat -ano | findstr :${config.port}  then  taskkill /PID <pid> /F\n`);
    process.exit(1);
  }
  throw err;
});

const restored = loadSnapshot();

server.listen(config.port, () => {
  console.log(`\n  Recovery Assistant API  →  http://localhost:${config.port}/api/health`);
  console.log(`  LLM: ${llmLabel()}`);
  console.log(`  Daily step target: ${config.targetSteps}`);
  console.log(`  Data: ${restored ? `${restored} records restored from data/store.json` : "empty"}${config.persistData ? "" : " (persistence off)"}`);
  if (config.auth.defaultPasswordsInUse) console.log("  ⚠ Default passwords in use. Set ADMIN_PASSWORD / ANALYST_PASSWORD in .env before sharing.");
  if (!config.auth.jwtSecretFromEnv) console.log("  ⚠ JWT_SECRET not set: sessions end when the server restarts.");
  if (!config.auth.ingestApiKey) console.log("  ⚠ INGEST_API_KEY not set: live streaming (npm run replay) is disabled.");
  console.log("");
});
