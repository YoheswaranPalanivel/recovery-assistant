"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CommunitySummary, CommunityView, MemberStatus } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { STATUS } from "@/components/MemberCard";
import { IconSparkle } from "@/components/icons";

const ORDER: MemberStatus[] = ["needs_support", "slipping", "check_device", "needs_rest", "on_track"];
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** The programme lead's view: is the community improving, where to focus, did contact help. */
export default function CommunityPage() {
  const { version } = useLive();
  const [v, setV] = useState<CommunityView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommunitySummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.community().then(setV).catch((e) => setError(e.message));
  }, [version]);

  const write = async () => {
    setBusy(true);
    try {
      setSummary(await api.communitySummary());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !v) return <p className="mt-10 text-alarm">{error}</p>;
  if (!v) return <p className="mt-10 text-slate">Loading the community view…</p>;
  if (!v.asOf) return <p className="mt-10 text-slate">No data yet. Load the dataset from the Today page.</p>;

  const last = v.weeks.at(-1);
  const prev = v.weeks.at(-2);
  const change = last && prev ? last.metGoalPct - prev.metGoalPct : null;
  const total = ORDER.reduce((t, k) => t + v.counts[k], 0) || 1;
  const a = v.actions;

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[2rem] font-extrabold leading-tight">Community overview</h1>
          <p className="mt-1 text-slate">
            For the programme lead: is the community improving, where should health workers focus, and is contact helping?
          </p>
        </div>
        <Link href="/community/details" className="text-sm font-semibold text-brand hover:underline">
          Detailed activity data →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card px-5 py-4">
          <p className="text-[0.82rem] text-slate">Members</p>
          <p className="display num text-[2rem] font-extrabold">{v.members}</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-[0.82rem] text-slate">Met their weekly goal</p>
          <p className="display num text-[2rem] font-extrabold">{last?.metGoalPct ?? 0}%</p>
          {change !== null && (
            <p className={`text-[0.8rem] font-bold ${change >= 0 ? "text-stride" : "text-alarm"}`}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)} points vs last week
            </p>
          )}
        </div>
        <div className="card px-5 py-4">
          <p className="text-[0.82rem] text-slate">Need a health worker</p>
          <p className="display num text-[2rem] font-extrabold">{v.counts.needs_support + v.counts.slipping}</p>
          <p className="text-[0.8rem] text-slate">+ {v.counts.check_device} device checks</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-[0.82rem] text-slate">More active after contact</p>
          <p className="display num text-[2rem] font-extrabold">
            {a.moreActive}
            <span className="text-[1rem] text-slate"> of {a.contacted}</span>
          </p>
          <p className="text-[0.8rem] text-slate">{a.waiting} waiting for data</p>
        </div>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="display text-[1.15rem] font-extrabold">This week&apos;s summary</h2>
            <p className="text-[0.84rem] text-slate">Written by AI from the figures on this page, then checked: every number must match.</p>
          </div>
          <button
            type="button"
            onClick={write}
            disabled={busy}
            className="brand-gradient flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-bold text-white disabled:opacity-60"
          >
            <IconSparkle className="h-4 w-4" />
            {busy ? "Writing…" : summary ? "Write again" : "Write this week's summary"}
          </button>
        </div>
        {summary && (
          <div className="mt-4 rounded-xl bg-[linear-gradient(135deg,#E3F6EF,#E4F0FA)] px-4 py-3">
            <p className="text-[1rem] leading-relaxed">{summary.text}</p>
            <p className="mt-2 text-[0.75rem] font-semibold text-brand">
              {summary.source === "llm"
                ? `✓ Written by ${summary.model}, every number matches${summary.check.attempts > 1 ? ` (attempt ${summary.check.attempts})` : ""}`
                : "Safe template summary"}
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="display text-[1.15rem] font-extrabold">Members meeting their goal, week by week</h2>
          <p className="text-[0.84rem] text-slate">Each member against their own weekly goal.</p>
          <div className="mt-5 grid h-44 items-end gap-4" style={{ gridTemplateColumns: `repeat(${v.weeks.length}, minmax(0, 1fr))` }}>
            {v.weeks.map((w, i) => (
              <div key={w.weekEnd} className="flex h-full flex-col justify-end text-center">
                <div className="flex flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-[64px] rounded-t-lg"
                    style={{ height: `${Math.max(3, w.metGoalPct)}%`, background: i === v.weeks.length - 1 ? "#0F766E" : "#7FD6C6" }}
                  />
                </div>
                <p className="num mt-2 font-bold">{w.metGoalPct}%</p>
                <p className="text-[0.72rem] text-slate">
                  {fmt(w.weekStart)} – {fmt(w.weekEnd)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="display text-[1.15rem] font-extrabold">Where people are this week</h2>
          <div className="mt-4 flex h-5 overflow-hidden rounded-full" role="img" aria-label="Members by status">
            {ORDER.map((k) => (
              <span key={k} style={{ width: `${(v.counts[k] / total) * 100}%`, background: STATUS[k].avatar }} />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-[0.9rem]">
            {ORDER.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: STATUS[k].avatar }} />
                <span className="flex-1">{STATUS[k].label}</span>
                <b className="num">{v.counts[k]}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="display text-[1.15rem] font-extrabold">Programme goals this week</h2>
        <p className="text-[0.84rem] text-slate">Share of members meeting each goal (members with data for that goal; device checks left out).</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {v.goals.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex justify-between text-[0.9rem]">
                <span>{g.label}</span>
                <span className="num font-bold">
                  {g.metPct}% <span className="font-normal text-slate">of {g.members}</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF3F2]">
                <div className="h-full rounded-full" style={{ width: `${g.metPct}%`, background: g.metPct >= 70 ? "#0E9F8E" : g.metPct >= 40 ? "#F2A93B" : "#E8892B" }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}