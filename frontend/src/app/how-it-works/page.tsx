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
      title: "Set personal goals",
      what: (
        <>
          The programme goals are 150 active minutes a week, active on 5 days, 7 hours of sleep and a personal step goal. Nobody starts at 150:
          each member&apos;s weekly target is their usual level plus 10%, rising gently each week, with a lower cap for limited mobility.
          Walking counts too: meeting the personal step goal keeps someone on track.
        </>
      ),
      figures: [
        ["Daily records", int(p.records)],
        ["Covering", p.dateRange.min ? `${longDate(p.dateRange.min)} to ${longDate(p.dateRange.max)}` : "—"],
      ],
    },
    {
      title: "Find who needs help",
      what: (
        <>
          Plain rules give every member a status, with the figures behind it: no data for 3 days means check the device, not a health problem;
          3 days with almost no activity means needs support; well behind their weekly goal means slipping; a very active day after a very
          short night means needs rest. Anyone who met their goal is never flagged. The incomplete latest day is left out.
        </>
      ),
      figures: [["Members", int(p.users)]],
      extra: (
        <Link href="/" className="text-sm text-stride underline-offset-4 hover:underline">
          See today&apos;s list
        </Link>
      ),
    },
    {
      title: "Plan with AI, inside limits",
      what: (
        <>
          For one member, the AI ({p.llm.enabled ? `${p.llm.model} via ${p.llm.provider}` : "none configured, so a safe template is used"})
          receives about a dozen calculated figures, an age band, mobility, preferred time and the approved activity menu. No name and no id.
          It proposes a weekly plan and a short message. The code then checks every activity, every session length, the weekly total, every
          number and certain words. If anything fails, the AI is told what and asked again, up to three times, then a safe template plan is
          used.
        </>
      ),
      figures: [],
    },
    {
      title: "Act and follow up",
      what: (
        <>
          The health worker decides: a call, a visit, or sending the plan, with a follow-up date. The app then compares the member&apos;s daily
          steps in the 3 days after contact with the 3 days before, so everyone can see whether reaching out helped.
        </>
      ),
      figures: [],
    },
    {
      title: "See the community",
      what: (
        <>
          The programme lead sees the share of members meeting their goal week by week, where people are, how each goal is going and how many
          became more active after contact. The AI writes a short weekly summary from those figures, checked the same way. Everything updates
          live as data arrives.
        </>
      ),
      figures: [],
      extra: (
        <Link href="/community" className="text-sm text-stride underline-offset-4 hover:underline">
          Open the community view
        </Link>
      ),
    },
  ];

  return (
    <div className="pt-6">
      <h1 className="display text-[2.4rem] font-bold leading-none sm:text-[2.9rem]">How it works</h1>
      <p className="mt-3 max-w-[70ch] text-slate">
        From a wearable&apos;s daily data to a health worker&apos;s next action, in eight steps. The figures on the right are live. The rule
        throughout: code produces the numbers and decisions, the AI suggests the words and plans, and the app checks them.
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