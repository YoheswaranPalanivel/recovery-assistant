"use client";

import { useEffect, useState } from "react";
import type { TodayView } from "@shared/types";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLive } from "@/lib/live";
import { EmptyState } from "@/components/EmptyState";
import { MemberCard, STATUS } from "@/components/MemberCard";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The health worker's start page: who needs attention today, why, and what to do. */
export default function TodayPage() {
  const { user } = useAuth();
  const { version } = useLive();
  const [view, setView] = useState<TodayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.today().then(setView).catch((e) => setError(e.message));
  }, [version, reload]);

  if (error && !view) return <p className="mt-10 text-alarm">{error}</p>;
  if (!view) return <p className="mt-10 text-slate">Loading today's list…</p>;
  if (!view.asOf) return <EmptyState onLoaded={() => setReload((n) => n + 1)} />;

  const act = view.priorities.filter((m) => m.status !== "check_device");
  const devices = view.priorities.filter((m) => m.status === "check_device");
  const c = view.community;
  const trend = c.previousMetGoalPct === null ? null : c.metGoalPct - c.previousMetGoalPct;
  const r = 36;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[2rem] font-extrabold leading-tight sm:text-[2.3rem]">
            {greeting()}
            {user ? `, ${user.username}` : ""}
          </h1>
          <p className="mt-1 text-[1.02rem] text-slate">
            {act.length
              ? `${act.length} member${act.length > 1 ? "s" : ""} need you today. Start with the red ones.`
              : "Everyone is on track today."}
          </p>
        </div>
        <span className="rounded-full border border-[#F7D9A8] bg-amber-pale px-3 py-1 text-[0.78rem] font-semibold text-amber">
          Demo profiles · activity and sleep are real (Fitbit)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["needs_support", "slipping", "check_device", "on_track"] as const).map((k) => (
          <div key={k} className="card flex items-center gap-3 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[k].avatar }} />
            <div>
              <p className="display num text-[1.6rem] font-extrabold leading-none">{view.counts[k]}</p>
              <p className="text-[0.8rem] text-slate">{STATUS[k].label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <section aria-labelledby="prio">
          <h2 id="prio" className="mb-3 text-[0.8rem] font-bold uppercase tracking-[0.1em] text-slate">
            Today's priorities
          </h2>
          <div className="flex flex-col gap-4">
            {act.length ? act.map((m) => <MemberCard key={m.profile.userId} m={m} onChanged={() => setReload((n) => n + 1)} />) : <p className="card p-6 text-slate">No one needs attention today.</p>}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="card p-5">
            <h3 className="display text-[1.05rem] font-extrabold">Community this week</h3>
            <div className="mt-3 flex items-center gap-4">
              <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
                <circle cx="44" cy="44" r={r} fill="none" stroke="#E5EFEC" strokeWidth="10" />
                <circle cx="44" cy="44" r={r} fill="none" stroke="#0F766E" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c.metGoalPct / 100) * circ} ${circ}`} transform="rotate(-90 44 44)" />
                <text x="44" y="49" textAnchor="middle" fontSize="18" fontWeight="800" fill="#10283A">
                  {c.metGoalPct}%
                </text>
              </svg>
              <p className="text-[0.86rem] leading-snug">
                of {c.members} members met their weekly activity goal
                {trend !== null && (
                  <span className={`mt-1 block font-bold ${trend >= 0 ? "text-stride" : "text-alarm"}`}>
                    {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} points vs last week ({c.previousMetGoalPct}%)
                  </span>
                )}
              </p>
            </div>
          </section>

          {view.actions && (
            <section className="card p-5">
              <h3 className="display text-[1.05rem] font-extrabold">Did it help?</h3>
              <p className="mt-1 text-[0.8rem] text-slate">Daily steps in the 3 days after contact vs the 3 days before.</p>
              {view.actions.contacted === 0 ? (
                <p className="mt-2 text-[0.86rem] text-slate">No contacts recorded yet. Mark a call, visit or plan on a card.</p>
              ) : (
                <ul className="mt-2 divide-y divide-rule text-[0.86rem]">
                  <li className="flex justify-between py-1.5"><span>Members contacted</span><b className="num">{view.actions.contacted}</b></li>
                  <li className="flex justify-between py-1.5"><span>More active afterwards</span><b className="num text-stride">{view.actions.moreActive}</b></li>
                  <li className="flex justify-between py-1.5"><span>No change yet</span><b className="num">{view.actions.noChange}</b></li>
                  <li className="flex justify-between py-1.5"><span>Waiting for data</span><b className="num text-slate">{view.actions.waiting}</b></li>
                </ul>
              )}
            </section>
          )}

          {view.actions && view.actions.followUps.length > 0 && (
            <section className="card p-5">
              <h3 className="display text-[1.05rem] font-extrabold">Follow-ups</h3>
              <ul className="mt-2 divide-y divide-rule text-[0.86rem]">
                {view.actions.followUps.slice(0, 6).map((f) => (
                  <li key={f.userId} className="flex justify-between gap-2 py-1.5">
                    <span>{f.name}</span>
                    <b>{new Date(`${f.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5">
            <h3 className="display text-[1.05rem] font-extrabold">Programme goals</h3>
            <ul className="mt-2 space-y-1.5 text-[0.86rem]">
              <li>🚶 150 active minutes a week, built up gradually</li>
              <li>📅 Active on 5 days a week (4 with limited mobility)</li>
              <li>😴 7 hours of sleep</li>
              <li>👣 Personal step goal: their usual + 10%</li>
            </ul>
          </section>

          {devices.length > 0 && (
            <section className="card p-5">
              <h3 className="display text-[1.05rem] font-extrabold">Check their watch ({devices.length})</h3>
              <p className="mt-1 text-[0.8rem] text-slate">No data for 3 days. A quick call to check it's worn and syncing.</p>
              <ul className="mt-2 divide-y divide-rule text-[0.86rem]">
                {devices.map((m) => (
                  <li key={m.profile.userId} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {m.profile.name} <span className="text-slate">· {m.profile.ageBand}</span>
                    </span>
                    {m.lastAction?.kind === "device_check" ? (
                      <span className="text-[0.78rem] font-semibold text-stride">✓ Checked</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          api
                            .recordAction({ userId: m.profile.userId, kind: "device_check", followUpDays: 3 })
                            .then(() => setReload((n) => n + 1))
                            .catch((e) => setError(e.message))
                        }
                        className="rounded-md border border-rule px-2 py-0.5 text-[0.78rem] font-semibold hover:border-brand hover:text-brand"
                      >
                        Mark checked
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}