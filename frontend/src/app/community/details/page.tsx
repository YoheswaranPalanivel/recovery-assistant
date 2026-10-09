"use client";

import { useCallback, useEffect, useState } from "react";
import type { Overview, UserSummary } from "@shared/types";
import { api, type Filters as F, type Status } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useAuth } from "@/lib/auth";
import { IconBell, IconSparkle, IconTarget, IconUsers } from "@/components/icons";
import { userLabel } from "@/lib/format";
import { Filters } from "@/components/Filters";
import { KpiLedger } from "@/components/KpiLedger";
import { AdherenceHeatmap } from "@/components/AdherenceHeatmap";
import { StepsTrend, ComplianceSleep } from "@/components/Charts";
import { AlertList } from "@/components/AlertList";
import { InsightPanel } from "@/components/InsightPanel";
import { LiveToasts } from "@/components/LiveToasts";
import { EmptyState } from "@/components/EmptyState";

export default function CommunityDetailsPage() {
  const { version, connected } = useLive();
  const { user } = useAuth();
  const [filters, setFilters] = useState<F>({});
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [health, setHealth] = useState<Status | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.overview(filters), api.users(), api.status()])
      .then(([o, u, h]) => {
        if (cancelled) return;
        setOverview(o);
        setUsers(u);
        setHealth(h);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, version, reload]);

  const selectUser = useCallback((userId: string | undefined) => {
    setFilters((f) => ({ ...f, userId }));
    if (userId) document.getElementById("insight")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  if (error && !overview) {
    return (
      <div className="mt-10 rounded-xl border border-alarm/30 bg-alarm-pale p-6">
        <p className="font-bold text-alarm">The dashboard can't load data.</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }
  if (loading || !overview) return <Skeleton />;
  if (overview.dateRange.max === null) return <EmptyState onLoaded={() => setReload((n) => n + 1)} />;

  const k = overview.kpis;
  const scope = filters.userId ? `Showing ${userLabel(filters.userId)}` : `Showing everyone`;

  return (
    <div className="flex flex-col gap-5 pt-6">
      <Banner
        name={user?.username ?? ""}
        live={connected}
        needHelp={users.filter((u) => u.openAlerts > 0).length}
        attention={overview.alerts.filter((a) => a.severity === "attention").length}
        lowGoal={overview.heatmap.filter((r) => r.compliancePct < 30).length}
      />
      <div className="card px-5 py-4">
        <Filters value={filters} onChange={setFilters} users={users} range={overview.dateRange} />
      </div>
      {error && <p className="text-sm text-alarm">{error}</p>}

      <KpiLedger k={k} trend={overview.trend} scopeLabel={scope} />

      <AdherenceHeatmap rows={overview.heatmap} target={k.target} selected={filters.userId} onSelect={selectUser} />

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          <StepsTrend data={overview.trend} target={k.target} />
          <ComplianceSleep data={overview.trend} hasSleep={k.avgSleepHours !== null} single={Boolean(filters.userId)} />
        </div>
        <AlertList alerts={overview.alerts} onSelectUser={selectUser} selectedUser={filters.userId} />
      </div>

      <div id="insight" className="scroll-mt-24">
        <InsightPanel filters={filters} dataVersion={version} llmModel={health?.llm ? health.model : null} />
      </div>

      <LiveToasts onSelectUser={selectUser} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-6 motion-reduce:animate-none" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-12 w-80 rounded bg-rule/60" />
      <div className="h-36 rounded-xl bg-rule/50" />
      <div className="h-96 rounded-xl bg-rule/40" />
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The page's one bold moment: a gradient summary of the selection in plain words. */
function Banner(p: { name: string; live: boolean; needHelp: number; attention: number; lowGoal: number }) {
  const stats = [
    { Icon: IconUsers, label: "People needing attention this week", value: p.needHelp.toLocaleString("en-IN") },
    { Icon: IconBell, label: "Serious alerts in this view", value: p.attention.toLocaleString("en-IN") },
    { Icon: IconTarget, label: "People under 30% of goal days", value: p.lowGoal.toLocaleString("en-IN") },
  ];
  return (
    <section className="brand-gradient relative overflow-hidden rounded-[22px] px-7 py-7 text-white shadow-[0_24px_60px_-30px_rgba(79,70,229,0.75)] sm:px-9">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[40rem]">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[0.8rem] font-semibold backdrop-blur">
            <span className={`h-2 w-2 rounded-full ${p.live ? "bg-[#A7F3D0]" : "bg-white/50"}`} />
            {p.live ? "Live data" : "Offline"}
          </span>
          <h1 className="display mt-3 text-[2.1rem] font-extrabold leading-tight sm:text-[2.5rem]">
            {greeting()}
            {p.name ? `, ${p.name}` : ""}
          </h1>
          <p className="mt-1.5 text-[1.02rem] text-white/85">
            Here is who is reaching their step goal, what has changed, and who may need a friendly message.
          </p>
        </div>
        <a
          href="#insight"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[0.95rem] font-bold text-brand-deep shadow-sm transition hover:bg-white/90"
        >
          <IconSparkle className="h-4 w-4" />
          Write a message with AI
        </a>
      </div>
      <dl className="relative mt-6 grid gap-3 sm:grid-cols-3">
        {stats.map(({ Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 backdrop-blur" style={{ background: "rgba(255,255,255,0.12)" }}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <dt className="text-[0.8rem] text-white/80">{label}</dt>
              <dd className="num text-[1.5rem] font-extrabold leading-tight">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
