# Recovery & Engagement Assistant: community diabetes programme

A web app that helps **community health workers** keep people with, or at risk of, type 2 diabetes on track with healthy habits. It shows who needs help today and why, sets goals that start from each person's own level, suggests a safe weekly plan written by AI, lets members check in from their phone, and tracks whether reaching out actually helped.

> **One rule throughout:** code calculates every number and makes every decision; the AI suggests words and plans; the app checks the AI's output before anyone sees it.

## The problem

People with or at risk of type 2 diabetes are advised to stay active, sit less and sleep well. Most start well and drop off within weeks, and nobody notices until a check-up months later. One community health worker looks after hundreds of people, so they can't follow everyone or know who to reach first. And one goal for everyone, such as 10,000 steps, doesn't work for an older person with knee pain.

## Who it's for

| User | What they get |
| --- | --- |
| **Health worker** | A *Today* list: who needs them, why, a suggested weekly plan, and buttons to record a call, visit or plan sent |
| **Member** | A phone view in their own language (Tamil or English): their week, their health worker's plan, and a 10-second daily check-in |
| **Programme lead** | A *Community* view: is the community improving, where to focus, and is contact helping |

## What it does

- **Personal goals.** 150 active minutes a week, active on 5 days, 7 hours of sleep, and a personal step goal. Each member's weekly target starts at their usual level plus 10% and rises gently; it's capped lower for limited mobility. Walking counts too.
- **Status with reasons.** *Needs support*, *Slipping*, *Check device*, *Needs rest* or *On track*, each with the figures behind it. No data is treated as a device issue, not a health problem; anyone who met their goal is never flagged.
- **AI weekly plan, inside limits.** The AI chooses only from an approved activity menu (no brisk walking for limited mobility), within session and weekly limits set by code. The code checks every activity, minute, number (digits and number words) and certain words; failures are retried, then replaced by a safe template.
- **Tamil.** Members who prefer Tamil get their plan and their app in Tamil, with an English translation for the health worker. The checks cover Tamil too: Tamil numerals are rejected so no number slips past the number check, and Tamil medical words are blocked.
- **Member phone view and daily check-in.** Members see their week and their health worker's plan, and check in with how they feel and whether they took their medicine. "Not feeling well" moves them to the top of the health worker's list straight away, live, and the next plan is lighter.
- **Act and follow up.** Record a call, visit, plan sent or device check, with a follow-up date. The app compares steps in the 3 days after contact with the 3 days before: *more active*, *no change yet* or *waiting for data*.
- **Member journey.** This week's goal rings, the last 4 weeks against goals, streak, plan and contact history.
- **Community view.** Share of members meeting their goal week by week, status split, goals met, outcomes after contact, and an AI weekly summary checked like everything else.
- **Delete a member on request.** An admin can erase one member's records, contacts, check-ins and messages; their pseudonym goes on a do-not-import list so a later upload or device feed can't bring them back.
- **Data quality.** Column mapping, row validation with reasons, duplicates, watch-not-worn days and the incomplete latest day all handled and shown.

## Data

- **Activity and sleep are real:** the public [FitBit Fitness Tracker Data](https://www.kaggle.com/datasets/arashnic/fitbit) on Kaggle (CC0): 33 de-identified users, April to May 2016. Download it and put `dailyActivity_merged.csv` and `sleepDay_merged.csv` in `backend/data/fitbit/`.
- **Profiles are demo data, clearly labelled:** names, age bands, condition, mobility, preferences and language don't exist in any public dataset. In a real programme they'd come from onboarding, with consent.
- **No glucose data.** The app supports the habits around blood sugar control; it never gives medical advice.
- Real time is simulated by replaying the dataset day by day through the same authenticated API a device feed would use.
- Fields missing from the dataset are shown as unavailable, never invented.

## Privacy and security

- User ids become HMAC-SHA256 pseudonyms before storage. Pseudonymised data is still personal data, so access is controlled and logged.
- The AI receives about a dozen calculated figures, an age band, mobility, preferences and language, marked `"anonymous"`: no name, no id, no daily rows, no check-in details. For real patients, run the open-weight model on your own servers or use a zero-retention agreement.
- **Right to erasure:** one member's data can be deleted on request, and their pseudonym is blocked from future imports. The activity log records that it happened, without any of the deleted data.
- Sign-in on every page, API call and WebSocket; scrypt password hashing with constant-time comparison; JWT in an httpOnly, SameSite=Lax cookie; 10 sign-in attempts per 15 minutes per IP.
- Roles: **admin** (load, upload and clear data, delete a member, activity log) and **analyst** (health worker view: members, plans, contacts).
- The ingest API has its own key (machine to machine). Helmet security headers, one allowed origin (CORS and origin check), schema-validated input.
- Activity log of sign-ins, uploads, resets, AI requests, contacts, check-ins and deletions: actions only, no data values.
- Secrets live only in `backend/.env`, which isn't committed.

**Not built yet (production gaps):** encryption at rest, consent flows, a separate sign-in for members, per-worker access to only their own members, and a real database.

## Tech stack

TypeScript throughout. **Frontend:** Next.js 16, React, Tailwind CSS, Recharts, Socket.IO client. **Backend:** Node.js, Express, zod, csv-parse, SheetJS, Socket.IO. **AI:** `openai/gpt-oss-120b` via Groq's OpenAI-compatible API (switchable, including Claude or a local model).

```
shared/types.ts                 shared API contract
backend/src/ingestion/          column mapping, validation, pseudonymisation
backend/src/analytics/          KPIs, trends, alert rules
backend/src/programme/          goals and status (engine), demo profiles, AI plans (planner),
                                worker actions and outcomes, check-ins, erasure, community view
backend/src/llm/                model client, prompts, number and word checks
backend/src/config.ts           programme goals and rule thresholds
frontend/src/app/               Today, Members, member journey, member phone (/me), Community,
                                Data, How it works, Privacy
```

## Run it (Node.js 20+)

```bash
# backend
cd backend
npm install
cp .env.example .env        # add LLM_API_KEY (a Groq key) and change the passwords
npm run test:analytics      # should print "All checks passed"
npm run dev                 # http://localhost:4000/api/health

# frontend (second terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                 # http://localhost:3000
```

Sign in with the admin user from `backend/.env`, then click **Load the dataset** (or upload the Fitbit files on the Data page). Without the Fitbit files, `npm run sample` in `backend` generates synthetic test data for checking the app.

**Accounts** (set in `backend/.env`; change the passwords before sharing):

- `admin`: load, upload and clear data, delete a member, see the activity log
- `analyst`: health worker view: members, plans and follow-ups

**Member phone view:** open any member's page and click *Open phone view*. Put it next to the *Today* page and send a check-in to see the list update live.

**Live feed** (third terminal, in `backend`, uses `INGEST_API_KEY`):

```bash
npm run replay -- --reset --shift-to-today --interval 3000 --activity data/fitbit/dailyActivity_merged.csv --sleep data/fitbit/sleepDay_merged.csv
```

## AI configuration (`backend/.env`)

```
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=<your key>
LLM_MODEL=openai/gpt-oss-120b
LLM_REASONING_EFFORT=low
```

Any OpenAI-compatible endpoint works (OpenRouter, Ollama, OpenAI). Without a key, the app uses safe template plans and messages, in Tamil or English. Rejected AI answers are logged in the backend terminal as `[llm] ... rejected: <reason>`.

## Notes

- Data is kept in memory with a JSON snapshot (`backend/data/store.json`, pseudonymised). Contacts, check-ins and the do-not-import list live in `backend/data/actions.json`, `checkins.json` and `erased.json`. All are git-ignored. Replace `backend/src/store/memoryStore.ts` to use PostgreSQL.
- To bring back a deleted member in a demo, stop the backend, delete `backend/data/erased.json`, start it again and reload the dataset.
- The npm `xlsx` package has known advisories; uploads are size-limited. Use the official SheetJS build for production.

## Next steps

Test with real health workers; consent flows and a member sign-in (phone OTP); per-worker access; PostgreSQL with encryption; reviewed Tamil message templates and more languages; voice messages for members who prefer to listen; real device integration (Fitbit Web API or Health Connect); a pilot comparing contacted and not-contacted members.