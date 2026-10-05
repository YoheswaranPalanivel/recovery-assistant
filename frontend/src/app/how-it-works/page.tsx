"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { PipelineStatus } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { int, longDate } from "@/lib/format";

export default function HowItWorks() {
  const { version } = useLive();
  const [p, setP] = useState<PipelineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.pipeline().then(setP).catch((e) => setError(e.message));
  }, [version]);

  if (error) return <p className="mt-10 text-alarm">{error}</p>;
  if (!p) return <p className="mt-10 text-slate">Loading…</p>;

  const r = p.rules;
  const steps: { title: string; what: ReactNode; figures: [string, string][]; extra?: ReactNode }[] = [
    {
      title: "Receive",
      what: (
        <>
          Data arrives two ways: an admin uploads CSV or Excel files, or a device integration pushes daily batches to the ingest API with its own
          key. Only .csv, .xlsx and .xls are accepted, up to {p.security.maxUploadMb} MB each.
        </>
      ),
      figures: [["Rows received", int(p.rowsReceived)]],
    },
    {
      title: "Check and clean",
      what: (
        <>
          Source columns are mapped to standard fields (for example TotalSteps becomes steps). Each row is validated: a real date, a user id,
          numbers in a possible range. Days where the device wasn’t worn are set aside so they don’t look like zero activity. The same person and
          day is only counted once. Fields the dataset doesn’t have are marked unavailable, never filled in.
        </>
      ),
      figures: [
        ["Accepted", int(p.accepted)],
        ["Rejected with a reason", int(p.rejected)],
        ["Duplicates skipped", int(p.duplicates)],
      ],
      extra: (
        <Link href="/data" className="text-sm text-stride underline-offset-4 hover:underline">
          See every rejection reason
        </Link>
      ),
    },
    {
      title: "Protect identity",
      what: (
        <>
          While a row is validated, its user id is replaced with a keyed pseudonym (HMAC-SHA256 with a server secret), such as P-3f2a9c1b. The
          same person always gets the same pseudonym, so per-person analysis still works, but the original id is never stored, shown or sent
          anywhere.
        </>
      ),
      figures: [["People, as pseudonyms", int(p.users)]],
    },
    {
      title: "Calculate",
      what: (
        <>
          Plain code computes the figures: averages, daily trend with a 7-day rolling average, change against the previous period, and days on
          target = days with at least {int(p.targetSteps)} steps ÷ days tracked × 100. The same input always gives the same answer.
        </>
      ),
      figures: [
        ["Daily records", int(p.records)],
        ["Covering", p.dateRange.min ? `${longDate(p.dateRange.min)} to ${longDate(p.dateRange.max)}` : "—"],
      ],
    },
    {
      title: "Detect",
      what: (
        <>
          Four written rules compare each day with that person’s own previous {r.baselineDays} days (once at least {r.minBaselineDays} exist):
          steps {r.activityDropPct}% or more below their baseline; sleep {r.sleepDropHours} h below their usual or under {r.minSleepHours} h; the
          target missed {r.missedTargetStreak} days running; a recovery score {r.recoveryDropPoints} points down, if the dataset has one. Every
          alert carries the values that triggered it.
        </>
      ),
      figures: [
        ["Alerts", int(p.alerts)],
        ["Needing attention", int(p.attentionAlerts)],
      ],
    },
    {
      title: "Summarise for the AI",
      what: (
        <>
          For one person and period, the app builds a small summary from the figures above and decides the kind of message by rule (reminder,
          encouragement, progress update, attention alert). No rows, no dates per day, no id: not even the pseudonym.
        </>
      ),
      figures: [],
      extra: p.exampleContext ? (
        <div className="mt-1">
          <p className="mb-1.5 text-sm text-slate">This is everything the model receives for one person, live from the current data:</p>
          <pre className="num max-h-72 overflow-auto rounded-xl bg-ink-deep px-4 py-3 text-[0.8rem] leading-relaxed text-[#C7D2FE]">
            {JSON.stringify(p.exampleContext, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-slate">Load data to see a live example.</p>
      ),
    },
    {
      title: "Write and verify",
      what: (
        <>
          The model ({p.llm.enabled ? `${p.llm.model} via ${p.llm.provider}` : "none configured, so a fixed template is used"}) writes a short
          insight and a message. Before anything is shown, the app checks that every number in the text is one it was given. If the model
          calculated or invented a number, the answer is rejected and it is asked again, up to three times; after that the app uses its own
          template. The API key stays on the server.
        </>
      ),
      figures: [
        ["Messages written", int(p.insights)],
        ["Written by the model", int(p.insightsByLlm)],
        ["Needed a retry or fallback", int(p.guardRejections)],
      ],
    },
    {
      title: "Show",
      what: (
        <>
          The dashboard reads the results through the signed-in API. A WebSocket, which also needs the session, tells it when new data lands, so
          it refreshes without reloading and new alerts appear as they happen.
        </>
      ),
      figures: [],
      extra: (
        <Link href="/" className="text-sm text-stride underline-offset-4 hover:underline">
          Open the dashboard
        </Link>
      ),
    },
  ];

  return (
    <div className="pt-6">
      <h1 className="display text-[2.4rem] font-bold leading-none sm:text-[2.9rem]">How it works</h1>
      <p className="mt-3 max-w-[70ch] text-slate">
        From a raw file to a message someone could receive, in eight steps. The figures on the right are live and update as data arrives. The
        rule throughout: code produces the numbers, the AI only puts them into words.
      </p>

      <ol className="mt-8 card">
        {steps.map((s, i) => (
          <li key={s.title} className={`grid gap-x-8 gap-y-4 px-5 py-6 md:grid-cols-[3rem_1fr_15rem] md:px-7 ${i ? "border-t border-rule" : ""}`}>
            <span className="brand-gradient display num flex h-11 w-11 items-center justify-center rounded-2xl text-[1.2rem] font-extrabold text-white" aria-hidden>
              {i + 1}
            </span>
            <div className="min-w-0">
              <h2 className="display text-[1.4rem] font-bold leading-tight">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h2>
              <p className="mt-1.5 max-w-[72ch] leading-relaxed text-ink/85">{s.what}</p>
              {s.extra && <div className="mt-3">{s.extra}</div>}
            </div>
            {s.figures.length > 0 && (
              <dl className="flex flex-col gap-3 md:border-l md:border-rule md:pl-6">
                {s.figures.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[0.8rem] text-slate">{k}</dt>
                    <dd className="display num text-[1.6rem] font-semibold leading-tight">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
