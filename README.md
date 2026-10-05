# AI-Powered Recovery & Engagement Assistant

Analyses a de-identified, multi-user wearable activity dataset. All KPIs, trends,
compliance and anomalies are calculated by deterministic code; an LLM only turns the
calculated summary into a readable insight and an engagement message.

## Stack
- frontend/ — Next.js 16, TypeScript, Tailwind CSS, Recharts, Socket.IO client
- backend/  — Node.js, Express, TypeScript, zod, csv-parse, SheetJS, Socket.IO
- LLM       — openai/gpt-oss-120b via any OpenAI-compatible API (Groq by default); Claude also supported
- shared/   — TypeScript types used by both sides

## Sign in
Two accounts, set in backend/.env (change the passwords before sharing):
- admin / Admin@12345: load, upload and clear data, see the activity log
- analyst / Analyst@12345: view the dashboard and write insights

## Run (Node.js 20+)
Backend:
    cd backend
    npm install
    cp .env.example .env          # add LLM_API_KEY (Groq) to use gpt-oss-120b (optional)
    npm run sample                # SYNTHETIC test data, for checking the app only
    npm run test:analytics        # should print "All checks passed"
    npm run dev                   # http://localhost:4000/api/health

Frontend (new terminal):
    cd frontend
    npm install
    cp .env.local.example .env.local
    npm run dev                   # http://localhost:3000, sign in as admin
                                  # click "Load the dataset" on the empty dashboard

Live stream (new terminal, uses INGEST_API_KEY from backend/.env):
    cd backend
    npm run replay -- --reset --shift-to-today

## Real dataset
Download "FitBit Fitness Tracker Data" (Kaggle). Upload dailyActivity_merged.csv and
sleepDay_merged.csv on the Data page, or replay them:
    npm run replay -- --reset --shift-to-today --activity data/fitbit/dailyActivity_merged.csv --sleep data/fitbit/sleepDay_merged.csv

## Architecture
upload / replay -> column mapping -> validation & cleaning -> in-memory store
-> KPIs, trend, compliance, anomaly rules -> compact LLM context -> LLM (gpt-oss-120b)
-> number guard (rejects any number not in the context) -> dashboard

Target steps and rule thresholds live in backend/src/config.ts.
Fields missing from the source dataset are shown as unavailable, never invented.

## Notes
- Data is held in memory (restart clears it). Replace backend/src/store/memoryStore.ts to use PostgreSQL.
- The npm `xlsx` package has known advisories; uploads are size-limited. Use the official SheetJS build for production.

## LLM configuration (backend/.env)
    LLM_PROVIDER=openai
    LLM_BASE_URL=https://api.groq.com/openai/v1
    LLM_API_KEY=<your key>
    LLM_MODEL=openai/gpt-oss-120b
    LLM_REASONING_EFFORT=low
Any OpenAI-compatible endpoint works (OpenRouter, Ollama, OpenAI). Without a key the
app uses deterministic template messages. If the model's text contains a number that
is not in the calculated context, it is rejected and retried (up to 3 attempts), then
the template is used.

## Security and privacy
- Sign-in required for every page, API call and WebSocket; JWT in an httpOnly, SameSite=Lax cookie
- Passwords hashed with scrypt at startup; constant-time comparison; 10 attempts / 15 min per IP
- Roles: admin (data changes) and analyst (read, write insights)
- Ingest API protected by a separate API key (machine-to-machine)
- Dataset user ids replaced with HMAC-SHA256 pseudonyms before storage
- LLM receives only a calculated summary with no id; number guard on every answer; key server-side
- Helmet security headers, single allowed origin (CORS + origin check), schema-validated input
- Audit log of sign-ins, uploads, resets and AI requests (actions only, no data values)
- Data snapshot in backend/data/store.json (pseudonymised) so restarts keep the dashboard
