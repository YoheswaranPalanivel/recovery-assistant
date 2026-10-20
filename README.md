# Diabetes home safety and community response

A web app that helps **older people with diabetes who live alone** get help quickly when something goes wrong, while their family far away stays informed. A low or high blood sugar reading, "not feeling well" or the **I need help** button alerts the nearest community helper and the family; if nobody responds in time it escalates, and the helper's visit report reaches the family and the doctor, each in their own language.

> **One rule throughout:** the app never gives medical or dose advice. Code makes every decision, the care team sets every limit, and everything a patient reads comes from an approved, reviewed message list, never from AI or machine translation.

## The problem

Many older people with type 2 diabetes live alone while their children work in another city or abroad. When blood sugar drops too low or climbs too high, or they feel unwell or stop responding, nobody nearby knows in time. The family hears about it only after a hospital visit. Apps that send alerts to family solve half of it: a son in Singapore who gets an alert still can't knock on the door.

## Who it's for

| User | Example | What they get |
| --- | --- | --- |
| **Person with diabetes** | Karthik, 68, Madurai | A phone view in their language: blood sugar entry, a 10-second check-in, a big **I need help** button |
| **Family far away** | His daughter Divya, Bengaluru | A family view: is he okay right now, who is on the way, the emergency number if nobody is, the visit report, and *Ask someone to check on him* |
| **Community helper** | Ravi nearby, Selvi as backup | Requests with the reason: *Accept* or *Can't go*, then a checklist visit report |
| **Care team and staff** | Dr. Sharma, who reads Hindi | Alerts that need a response, each member's care circle, blood sugar with the levels they set, and reports in their own language |

## How it works

```
Karthik enters 58 mg/dL (his doctor's low level is 70)
  → his phone shows an approved message in his language
  → alert to Ravi (nearest helper) and Divya (daughter)
  → nobody accepts in 10 minutes: Selvi (backup) is asked, Divya is asked to call
  → still nobody in 20 minutes: Divya is shown the emergency number (108)
  → Selvi accepts: Divya sees "Selvi is on the way"
  → Selvi's visit report (checklist, recheck reading, note) reaches Divya and Dr. Sharma
```

The demo uses 30 and 60 seconds instead of 10 and 20 minutes so escalation can be shown live (`ESCALATE_AFTER_SECONDS`, `EMERGENCY_AFTER_SECONDS` in `backend/.env`).

## What it does

- **Blood glucose.** Readings in mg/dL (before breakfast, after a meal, other times), a 14-day chart, and the share in range. **Low and high alert levels are set per person by the care team**; until they are, a programme default (70 and 250 mg/dL) is shown and labelled as such. Readings outside 20 to 600 mg/dL are rejected as typing mistakes.
- **Alerts.** A low or high reading, a "not feeling well" check-in, the help button or a family request raises an alert. Urgent ones go first; pressing help three times still makes one alert. The help button always works, even if the member has stopped sharing.
- **Care circle and escalation.** Each member has a nearest helper, a backup helper, family they chose to share with, and a care team. Alerts go to the nearest helper (and the family, if urgent); *Can't go* asks the backup at once; no answer escalates automatically. Every step is recorded with its time.
- **Visit reports.** The helper ticks a checklist (saw the person, awake and talking, care-plan steps followed, care team told, ambulance called), adds a recheck reading and a note. The checklist means the same in every language; the note is shown exactly as written, never machine-translated.
- **Family view.** What a family member sees on their phone, in their language: the current alert and who is handling it, the latest reading, today's check-in, visit reports, and a button to ask for someone to check in.
- **Safe languages.** Tamil, English, Hindi, Telugu and Malayalam. Patient-facing text comes only from the approved message list; readings, limits and minutes are filled in from the data as digits, so a translation can never change a number or a dose. A message missing in any language fails the build. Staff choose the language they read in.
- **Activity, sleep and weekly plans.** Personal activity goals from real wearable data, status with reasons, and a weekly activity plan: the AI chooses activities from an approved menu within code-set limits, and the words the patient reads come from the approved templates.
- **Consent and erasure.** Members can stop sharing and agree again from their phone; family see nothing without consent. An admin can delete one member's data on request, and they are blocked from future imports.

## Safety rules

1. The app never suggests, calculates or changes a medicine or a dose.
2. Low and high levels belong to the care team; the app only compares readings with them.
3. Everything a patient reads comes from the approved message list. AI is never used for patient-facing health text.
4. Numbers come from data, never from translation.
5. Notes are shown as written, labelled "not translated".
6. Asking for help is never blocked.
7. No alert stops at one person: it escalates until someone responds.
8. Family see only what the member agreed to share.

All Tamil, Hindi, Telugu and Malayalam texts are **drafts**, marked as needing review by a clinician and a native speaker before real use (see *Approved messages* in the app).

## Data

- **Activity and sleep are real:** the public [FitBit Fitness Tracker Data](https://www.kaggle.com/datasets/arashnic/fitbit) on Kaggle (CC0): 33 de-identified users, April to May 2016. Put `dailyActivity_merged.csv` and `sleepDay_merged.csv` in `backend/data/fitbit/`.
- **Blood glucose readings are demo data:** the dataset has none, so 14 days of readings are generated when the dataset loads and labelled *Demo readings*. In real use they come from a glucometer or CGM, or are entered by the member or helper.
- **Profiles, helpers, family and care teams are demo data**, clearly labelled. In a real programme they come from enrolment, with consent.

## Privacy and security

- Encrypted at rest: every data file (records, readings, alerts, contacts, check-ins, consents, erasure list) uses AES-256-GCM; a changed file is rejected, not read.
- User ids become HMAC-SHA256 pseudonyms before storage. The AI receives calculated figures marked `"anonymous"`, never a name or id.
- Consent with withdrawal; right to erasure with a do-not-import list; activity log of actions without data values.
- Sign-in on every page, API call and WebSocket; scrypt password hashing; JWT in an httpOnly, SameSite=Lax cookie; sign-in rate limit; roles (admin, analyst); schema-validated input; Helmet headers; one allowed origin.
- Secrets live only in `backend/.env`, which isn't committed.

## Tech stack

TypeScript throughout. **Frontend:** Next.js 16, React, Tailwind CSS, Recharts, Socket.IO client. **Backend:** Node.js, Express, zod, csv-parse, SheetJS, Socket.IO. **AI:** `openai/gpt-oss-120b` via Groq's OpenAI-compatible API (switchable).

```
shared/types.ts                 shared API contract
shared/messages.ts              approved messages and words in five languages
backend/src/programme/          glucose, alerts and escalation, care circles, consent, check-ins,
                                activity goals (engine), weekly plans (planner), erasure
backend/src/security/vault.ts   encryption at rest
backend/src/ingestion/          column mapping, validation, pseudonymisation
frontend/src/app/               Today, Members, member page, Helper requests, Approved messages,
                                patient phone (/me), family phone (/family), Privacy
```

## Run it (Node.js 20+)

```bash
# backend
cd backend
npm install
cp .env.example .env        # add LLM_API_KEY (optional) and change the passwords
npm run dev                 # http://localhost:4000/api/health

# frontend (second terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                 # http://localhost:3000
```

Sign in with the admin user from `backend/.env` and click **Load the dataset**. Without the Fitbit files, `npm run sample` in `backend` generates synthetic test data.

## Demo walkthrough

1. **Members** → open a member whose care circle includes family.
2. Open **the phone view** (patient) and **the family view** in two tabs.
3. On the patient's phone, enter **58** and save. The family view shows who has been asked; *Today* shows the alert.
4. Wait 30 seconds: the backup helper is asked and the family is asked to call. At 60 seconds the family sees the emergency number.
5. **Helper requests** → act as the backup helper → **Accept**. The family sees who is on the way.
6. Send the visit report. Set *I read in* to **हिन्दी** and open the member page: the checklist is in Hindi, the note as written.

## Notes

- Data is kept in memory with encrypted JSON files in `backend/data/` (all git-ignored). Replace `backend/src/store/memoryStore.ts` to use PostgreSQL.
- To reset a demo, stop the backend, delete the JSON files in `backend/data/` (keep `.data-key` and `.pseudonym-secret`), start it again and reload the dataset.

## Next steps

Bluetooth glucometer and CGM readings (no typing); real SMS and automatic phone calls for urgent alerts; a helper app with location; member and family sign-in (phone OTP); clinician and native-speaker review of every message, with voice messages for members who prefer to listen; PostgreSQL; and a pilot with a community programme measuring response time and hospital visits.