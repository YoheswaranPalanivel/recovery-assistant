
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { GoalProgress, MemberDetail } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { MemberCard, STATUS } from "@/components/MemberCard";

const KIND = { call: "Called", visit: "Visited", plan_sent: "Plan sent", device_check: "Watch checked" } as const;
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function Ring({ g }: { g: GoalProgress }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = g.value === null ? 0 : Math.min(1, g.value / g.target);
  const color = g.value === null ? "#E5EFEC" : pct >= 1 ? "#0E9F8E" : pct >= 0.7 ? "#7FD6C6" : pct >= 0.4 ? "#F2A93B" : "#E8892B";
  return (
    <div className="card flex flex-col items-center p-4 text-center">
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="#E5EFEC" strokeWidth="9" />
        {pct > 0 && (
          <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 42 42)" />
        )}
        <text x="42" y="47" textAnchor="middle" fontSize="15" fontWeight="800" fill="#10283A">
          {g.value === null ? "—" : `${Math.round(pct * 100)}%`}
        </text>
      </svg>
      <p className="mt-2 text-[0.85rem] font-bold">{g.label}</p>
      <p className="num text-[0.8rem] text-slate">
        {g.value === null ? "No data" : `${g.value.toLocaleString("en-IN")} of ${g.target.toLocaleString("en-IN")}${g.unit === "h" ? " h" : g.unit === "days" ? " days" : g.unit === "min" ? " min" : ""}`}
      </p>
    </div>
  );
}

/** One member's wellness journey: this week, the last 4 weeks, streak, plan and contacts. */
export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const userId = decodeURIComponent(id);
  const { version } = useLive();
  const [d, setD] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.member(userId).then(setD).catch((e) => setError(e.message));
  }, [userId, version, reload]);

  if (error) return <p className="mt-10 text-alarm">{error}</p>;
  if (!d) return <p className="mt-10 text-slate">Loading…</p>;

  const m = d.member;
  const p = m.profile;
  const s = STATUS[m.status];
  const maxBar = Math.max(...d.history.map((w) => Math.max(w.activeMinutes, w.target)), 1);

  return (
    <div className="flex flex-col gap-5 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/members" className="text-sm text-slate hover:text-brand">
          ← All members
        </Link>
        <a href={`/me/${encodeURIComponent(userId)}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand hover:underline">
          📱 Open {p.name}&apos;s phone view ↗
        </a>
      </div>

      <section className="card flex flex-wrap items-center gap-5 p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: s.avatar }}>
          {p.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="display text-[2rem] font-extrabold leading-none">{p.name}</h1>
            <span className={`rounded-full px-3 py-1 text-[0.8rem] font-bold ${s.badge}`}>● {s.label}</span>
            <span className="rounded-full border border-[#F7D9A8] bg-amber-pale px-2.5 py-0.5 text-[0.72rem] font-semibold text-amber">Demo profile</span>
          </div>
          <p className="mt-2 text-[0.95rem] text-slate">
            {p.ageBand} · {p.condition} · {p.mobility === "limited" ? "limited mobility" : "no mobility limits"} · prefers {p.prefers} · {p.language}
          </p>
        </div>
        <div className="rounded-2xl bg-[linear-gradient(135deg,#E3F6EF,#E4F0FA)] px-5 py-3 text-center">
          <p className="display num text-[2rem] font-extrabold leading-none">{d.streak}</p>
          <p className="text-[0.8rem] text-slate">{d.streak === 1 ? "active day" : "active days"} in a row 🔥</p>
        </div>
      </section>

      <div>
        <h2 className="mb-3 text-[0.8rem] font-bold uppercase tracking-[0.1em] text-slate">
          This week · {fmt(m.weekStart)} to {fmt(m.weekEnd)}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {m.goals.map((g) => (
            <Ring key={g.key} g={g} />
          ))}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="display text-[1.15rem] font-extrabold">The last 4 weeks</h2>
        <p className="mt-0.5 text-[0.85rem] text-slate">Active minutes each week against that week&apos;s personal goal. The goal rises gently as they improve.</p>
        <div className="mt-5 grid h-48 grid-cols-4 items-end gap-6">
          {d.history.map((w) => (
            <div key={w.weekEnd} className="flex h-full flex-col justify-end text-center">
              <div className="relative flex flex-1 items-end justify-center">
                <div
                  className="w-full max-w-[72px] rounded-t-lg"
                  style={{ height: `${(w.activeMinutes / maxBar) * 100}%`, background: w.met ? "#0E9F8E" : "#F2A93B", minHeight: 4 }}
                  title={`${w.activeMinutes} of ${w.target} min`}
                />
                <div className="absolute inset-x-0 border-t-2 border-dashed border-ink/40" style={{ bottom: `${(w.target / maxBar) * 100}%` }} aria-hidden />
              </div>
              <p className="num mt-2 text-[0.85rem] font-bold">
                {w.activeMinutes} / {w.target} min
              </p>
              <p className="text-[0.75rem] text-slate">
                {fmt(w.weekStart)} – {fmt(w.weekEnd)} {w.met ? "· met ✓" : ""}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[0.75rem] text-slate">Dashed line: that week&apos;s goal. Green: goal met. Amber: not yet.</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section>
          <h2 className="mb-3 text-[0.8rem] font-bold uppercase tracking-[0.1em] text-slate">What to do this week</h2>
          <MemberCard m={{ ...m, lastAction: d.actions[0] ?? null }} onChanged={() => setReload((n) => n + 1)} />
        </section>

        <section className="card p-5">
          <h2 className="display text-[1.05rem] font-extrabold">Contact history</h2>
          {!d.actions.length ? (
            <p className="mt-2 text-[0.86rem] text-slate">No contacts yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-rule text-[0.86rem]">
              {d.actions.map((a) => (
                <li key={a.id} className="py-2.5">
                  <div className="flex justify-between gap-2">
                    <b>{KIND[a.kind]}</b>
                    <span className="text-slate">{new Date(a.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                  <p className={`mt-0.5 text-[0.8rem] ${a.outcome.status === "more_active" ? "text-stride" : "text-slate"}`}>
                    {a.outcome.status === "waiting"
                      ? "Waiting for the next days of data"
                      : `${a.outcome.status === "more_active" ? "More active afterwards" : "No change yet"}: ${a.outcome.beforeSteps?.toLocaleString("en-IN")} → ${a.outcome.afterSteps?.toLocaleString("en-IN")} steps`}
                  </p>
                  <p className="text-[0.75rem] text-slate">by {a.by}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}