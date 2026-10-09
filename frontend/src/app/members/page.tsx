"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MemberStatus, MemberWeek } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { STATUS } from "@/components/MemberCard";

const FILTERS: (MemberStatus | "all")[] = ["all", "needs_support", "slipping", "check_device", "needs_rest", "on_track"];

/** Every member in the programme, most urgent first, with search and status filter. */
export default function MembersPage() {
  const { version } = useLive();
  const [list, setList] = useState<MemberWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MemberStatus | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.members().then(setList).catch((e) => setError(e.message));
  }, [version]);

  const shown = useMemo(
    () => (list ?? []).filter((m) => (filter === "all" || m.status === filter) && m.profile.name.toLowerCase().includes(q.trim().toLowerCase())),
    [list, filter, q],
  );

  if (error) return <p className="mt-10 text-alarm">{error}</p>;
  if (!list) return <p className="mt-10 text-slate">Loading members…</p>;

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[2rem] font-extrabold leading-tight">Members</h1>
          <p className="mt-1 text-slate">{list.length} people in the programme. Open anyone to see their journey.</p>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name"
          aria-label="Search members"
          className="h-10 w-64 rounded-xl border border-rule bg-paper px-3 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const n = f === "all" ? list.length : list.filter((m) => m.status === f).length;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold ${filter === f ? "border-brand bg-brand-soft text-brand" : "border-rule bg-paper text-slate hover:text-ink"}`}
            >
              {f === "all" ? "All" : STATUS[f].label} <span className="num opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="card divide-y divide-rule">
        {shown.map((m) => {
          const s = STATUS[m.status];
          const g = m.goals[0];
          const pct = Math.min(100, ((g.value ?? 0) / g.target) * 100);
          return (
            <Link key={m.profile.userId} href={`/members/${encodeURIComponent(m.profile.userId)}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 hover:bg-fog/60 md:grid-cols-[auto_1.2fr_1fr_200px_auto]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-[0.8rem] font-bold text-white" style={{ background: s.avatar }}>
                {m.profile.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-bold">{m.profile.name}</p>
                <p className="truncate text-[0.8rem] text-slate">
                  {m.profile.ageBand} · {m.profile.condition}
                  {m.profile.mobility === "limited" ? " · limited mobility" : ""}
                </p>
              </div>
              <p className="hidden truncate text-[0.82rem] text-slate md:block">{m.reasons[0]}</p>
              <div className="hidden md:block">
                <div className="mb-1 flex justify-between text-[0.75rem] text-slate">
                  <span>Active minutes</span>
                  <span className="num">
                    {g.value ?? 0} / {g.target}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#EEF3F2]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#0E9F8E" : pct >= 70 ? "#7FD6C6" : "#F2A93B" }} />
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ${s.badge}`}>{s.label}</span>
            </Link>
          );
        })}
        {!shown.length && <p className="px-5 py-6 text-slate">No members match.</p>}
      </div>
    </div>
  );
}