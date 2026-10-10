"use client";

import { useEffect, useState } from "react";
import type { AuditEntry, PipelineStatus } from "@shared/types";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLive } from "@/lib/live";
import { timeAgo } from "@/lib/format";

type Control = { name: string; how: string; on: boolean };

const ACTION_LABEL: Record<string, string> = {
  login: "Signed in",
  login_failed: "Failed sign-in",
  upload: "Uploaded a file",
  load_dataset: "Loaded the dataset",
  reset: "Cleared data",
  generate_insight: "Wrote an insight",
  stream_batch: "Received live data",
};

export default function SecurityPage() {
  const { user } = useAuth();
  const { version } = useLive();
  const [p, setP] = useState<PipelineStatus | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    api.pipeline().then(setP).catch(() => {});
    if (user?.role === "admin") api.audit().then(setAudit).catch(() => setAudit([]));
  }, [version, user]);

  if (!p) return <p className="mt-10 text-slate">Loading…</p>;
  const s = p.security;

  const groups: { title: string; intro: string; controls: Control[] }[] = [
    {
      title: "Who can get in",
      intro: "Nothing in the app or the API is reachable without signing in.",
      controls: [
        { name: "Sign-in on every page and API call", how: "Except the health check and the sign-in itself.", on: s.authRequired },
        { name: "Session in an httpOnly cookie", how: `${s.cookie}. Page scripts can't read it, and other sites can't use it.`, on: true },
        { name: "Hashed passwords", how: "scrypt with a random salt, compared in constant time; unknown usernames take the same time.", on: true },
        { name: "Two roles", how: "Admins load and clear data; analysts and health workers view members, record contacts and write plans.", on: true },
        { name: "Sign-in attempt limit", how: s.loginRateLimit, on: true },
        { name: "Separate key for device data", how: "The ingest API takes an API key, not a browser session.", on: s.ingestKeyRequired },
      ],
    },
    {
      title: "What data is kept",
      intro: "Only what the analysis needs, and never a real identifier.",
      controls: [
        { name: "Pseudonymised ids", how: "Dataset user ids become HMAC-SHA256 pseudonyms before storage.", on: s.pseudonymisation },
        { name: "Strict file checks", how: `.csv, .xlsx, .xls only, up to ${s.maxUploadMb} MB, file names sanitised.`, on: true },
        { name: "Row validation", how: "Impossible or missing values are rejected with a reason, not stored.", on: true },
        { name: "No invented fields", how: "Metrics the dataset lacks are shown as unavailable.", on: true },
        { name: "Delete a member on request", how: "An admin can erase one member: records, contacts, check-ins and messages. Their pseudonym is blocked from future imports.", on: true },
        { name: "Demo profiles, clearly labelled", how: "Names, age bands and preferences are sample data; the dataset has none. Real ones would come from onboarding, with consent.", on: true },
        { name: "Local snapshot", how: "Pseudonymised records only, so a restart doesn't empty the dashboard.", on: s.persistence },
      ],
    },
    {
      title: "What the AI sees",
      intro: "The model never receives the dataset.",
      controls: [
        { name: "Summary only", how: "A dozen calculated figures per request. No rows, no ids.", on: true },
        { name: "No names, no ids", how: "Requests say \"anonymous\"; names stay in the app, for the health worker only.", on: true },
        { name: "Number and word check", how: "Any number (digits or words) not in the summary, or a medical word, means the answer is rejected and retried.", on: true },
        { name: "Plans inside limits", how: "Weekly plans may only use the approved activity menu, within session and weekly limits set by code.", on: true },
        { name: "Human in the loop", how: "Plans and messages are suggestions; a health worker decides what to send.", on: true },
        { name: "Key kept on the server", how: "The browser never sees the LLM API key.", on: true },
        { name: "Request limit", how: s.insightRateLimit, on: true },
      ],
    },
    {
      title: "How requests are protected",
      intro: "Defences that apply to every request.",
      controls: [
        { name: "Security headers", how: "Helmet: no MIME sniffing, no framing, strict referrer policy.", on: true },
        { name: "One allowed origin", how: "CORS and an origin check accept only the frontend's address.", on: true },
        { name: "Validated input", how: "Every query and body is checked against a schema.", on: true },
        { name: "Quiet errors", how: "Clients get a plain message; no stack traces or data in responses or logs.", on: true },
      ],
    },
  ];

  return (
    <div className="pt-6">
      <h1 className="display text-[2.4rem] font-bold leading-none sm:text-[2.9rem]">Privacy and security</h1>
      <p className="mt-3 max-w-[70ch] text-slate">What protects the data at each point, and a record of who did what.</p>

      {s.defaultPasswordsInUse && (
        <p role="status" className="mt-5 rounded-lg border border-amber/30 bg-amber-pale px-4 py-3 text-sm">
          The default passwords from .env.example are still in use. Change ADMIN_PASSWORD and ANALYST_PASSWORD in backend/.env before anyone
          else uses this.
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="card">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="display text-[1.35rem] font-bold">{g.title}</h2>
              <p className="text-sm text-slate">{g.intro}</p>
            </div>
            <ul className="divide-y divide-rule">
              {g.controls.map((c) => (
                <li key={c.name} className="flex gap-3 px-5 py-3">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                      c.on ? "bg-stride-pale text-stride-deep" : "bg-amber-pale text-amber"
                    }`}
                    aria-label={c.on ? "On" : "Off"}
                  >
                    {c.on ? "✓" : "!"}
                  </span>
                  <div>
                    <p className="font-bold leading-snug">{c.name}</p>
                    <p className="text-sm text-slate">{c.on ? c.how : `Off. ${c.how}`}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-5 card">
        <div className="border-b border-rule px-5 py-4">
          <h2 className="display text-[1.35rem] font-bold">Activity log</h2>
          <p className="text-sm text-slate">Sign-ins, uploads and AI requests. It records actions only, never data values.</p>
        </div>
        {user?.role !== "admin" ? (
          <p className="px-5 py-6 text-sm text-slate">Only admins can see the activity log.</p>
        ) : !audit?.length ? (
          <p className="px-5 py-6 text-sm text-slate">Nothing recorded yet.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-paper text-slate">
                <tr className="border-b border-rule">
                  <th className="px-5 py-2 font-normal">When</th>
                  <th className="px-3 py-2 font-normal">Who</th>
                  <th className="px-3 py-2 font-normal">What</th>
                  <th className="px-5 py-2 font-normal">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {audit.map((a, i) => (
                  <tr key={`${a.at}-${i}`}>
                    <td className="whitespace-nowrap px-5 py-2 text-slate" title={a.at}>
                      {timeAgo(a.at)}
                    </td>
                    <td className="px-3 py-2">{a.user}</td>
                    <td className={`whitespace-nowrap px-3 py-2 ${a.action === "login_failed" ? "text-alarm" : ""}`}>{ACTION_LABEL[a.action] ?? a.action}</td>
                    <td className="px-5 py-2 text-slate">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
