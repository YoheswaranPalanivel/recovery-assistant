"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import type { Kpis, TrendPoint } from "@shared/types";
import { dec, int, longDate } from "@/lib/format";
import { IconBolt, IconHeart, IconMoon, IconSteps, IconTarget, IconUsers } from "./icons";

function Spark({ data, k, color }: { data: TrendPoint[]; k: "avgSteps" | "avgSleepHours"; color: string }) {
  const pts = data.slice(-30);
  if (pts.length < 3) return null;
  return (
    <div className="h-10 w-full" aria-hidden>
      <ResponsiveContainer>
        <LineChart data={pts} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line dataKey={k} stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#EEF0F6" strokeWidth="7" />
      <circle
        cx="34"
        cy="34"
        r={r}
        fill="none"
        stroke={v >= 50 ? "#0E9F8E" : "#F2A93B"}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        transform="rotate(-90 34 34)"
      />
    </svg>
  );
}

type CardProps = {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  unit?: string;
  note: React.ReactNode;
  muted?: boolean;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
};

function Card({ icon, tint, label, value, unit, note, muted, aside, footer }: CardProps) {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center gap-2.5 text-sm text-slate">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tint}`}>{icon}</span>
        {label}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className={`display num text-[2.5rem] font-semibold leading-none ${muted ? "text-slate/40" : ""}`}>
            {value}
            {unit && <span className="ml-0.5 text-[1.3rem] font-medium text-slate">{unit}</span>}
          </p>
          <p className="mt-2 text-[0.8rem] text-slate">{note}</p>
        </div>
        {aside}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

export function KpiLedger({ k, trend, scopeLabel }: { k: Kpis; trend: TrendPoint[]; scopeLabel: string }) {
  const change = k.stepsChangePct;
  return (
    <section aria-label="Key figures">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate">
        <span>{scopeLabel}</span>
        <span className="num">
          {longDate(k.periodStart)} to {longDate(k.periodEnd)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          icon={<IconUsers className="h-[18px] w-[18px]" />}
          tint="bg-brand-soft text-brand"
          label="People"
          value={int(k.users)}
          note={`${int(k.records)} days of data`}
        />
        <Card
          icon={<IconSteps className="h-[18px] w-[18px]" />}
          tint="bg-brand-soft text-brand"
          label="Average steps"
          value={int(k.avgSteps)}
          note={
            change === null ? (
              `Goal ${int(k.target)} a day`
            ) : (
              <span title={k.changeLabel ?? undefined}>
                <span className={change >= 0 ? "font-bold text-stride" : "font-bold text-alarm"}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
                </span>{" "}
                vs the period before
              </span>
            )
          }
          footer={<Spark data={trend} k="avgSteps" color="#0369A1" />}
        />
        <Card
          icon={<IconTarget className="h-[18px] w-[18px]" />}
          tint="bg-ochre-pale text-amber"
          label="Days goal reached"
          value={dec(k.compliancePct, 0)}
          unit="%"
          note={`Days with ${int(k.target)}+ steps`}
          aside={<Ring pct={k.compliancePct} />}
        />
        <Card
          icon={<IconMoon className="h-[18px] w-[18px]" />}
          tint="bg-[#F1EBFF] text-violet"
          label="Average sleep"
          value={k.avgSleepHours === null ? "—" : dec(k.avgSleepHours)}
          unit={k.avgSleepHours === null ? undefined : "h"}
          note={k.avgSleepHours === null ? "Not in this dataset" : "Per night tracked"}
          muted={k.avgSleepHours === null}
          footer={k.avgSleepHours !== null ? <Spark data={trend} k="avgSleepHours" color="#8B5CF6" /> : undefined}
        />
        <Card
          icon={<IconBolt className="h-[18px] w-[18px]" />}
          tint="bg-stride-pale text-stride-deep"
          label="Active minutes"
          value={int(k.avgActiveMinutes)}
          note={k.avgActiveMinutes === null ? "Not in this dataset" : "Brisk activity, per day"}
          muted={k.avgActiveMinutes === null}
        />

        <Card
          icon={<IconFlame className="h-[18px] w-[18px]" />}
          tint="bg-ochre-pale text-amber"
          label="Calories burned"
          value={int(k.avgCalories)}
          unit={k.avgCalories === null ? undefined : "kcal"}
          note={k.avgCalories === null ? "Not in this dataset" : "Average per day"}
          muted={k.avgCalories === null}
        />
        <ActivityMix mix={k.activityMix} />
        <Card
          icon={<IconHeart className="h-[18px] w-[18px]" />}
          tint="bg-alarm-pale text-alarm"
          label="Recovery score"
          value={int(k.avgRecoveryScore)}
          note={k.avgRecoveryScore === null ? "Not in this dataset" : "Average, 0 to 100"}
          muted={k.avgRecoveryScore === null}
        />
      </div>
    </section>
  );
}


/** Flame icon for calories (kept here so icons.tsx doesn't change). */
function IconFlame({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21c-3.6 0-6.5-2.7-6.5-6.3 0-2.9 1.9-4.6 3.3-6.4.4 1.7 1.3 2.7 2.4 3.2-.2-3.1 1.1-5.8 3.3-7.5.2 2.8 1.6 4.3 2.9 5.9 1.1 1.4 1.6 2.9 1.6 4.8 0 3.6-3.4 6.3-7 6.3z" />
      <path d="M12 21c-1.6 0-2.8-1.2-2.8-2.8 0-1.5 1.1-2.4 1.9-3.4.2 1 .8 1.5 1.5 1.7 0-1 .5-2 1.2-2.6.3 1.1.9 1.8 1.4 2.5.4.6.6 1.1.6 1.8 0 1.6-1.4 2.8-3.8 2.8z" />
    </svg>
  );
}

const MIX = [
  { key: "very", label: "Very active", color: "#0B6F64" },
  { key: "fairly", label: "Fairly active", color: "#14B8A6" },
  { key: "lightly", label: "Lightly active", color: "#99E2D6" },
  { key: "sedentary", label: "Sedentary", color: "#DCE5E3" },
] as const;

const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/** How an average day is split by intensity. The dataset has no activity *type*, so intensity stands in for it. */
function ActivityMix({ mix }: { mix: Kpis["activityMix"] }) {
  const total = mix ? mix.very + mix.fairly + mix.lightly + mix.sedentary : 0;
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center gap-2.5 text-sm text-slate">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stride-pale text-stride-deep">
          <IconBolt className="h-[18px] w-[18px]" />
        </span>
        Activity mix
      </div>
      {!mix || !total ? (
        <>
          <p className="display mt-3 text-[2.5rem] font-semibold leading-none text-slate/40">—</p>
          <p className="mt-2 text-[0.8rem] text-slate">Not in this dataset</p>
        </>
      ) : (
        <>
          <div className="mt-4 flex h-3.5 overflow-hidden rounded-full" role="img" aria-label="Average day split by activity intensity">
            {MIX.map((x) => (
              <span key={x.key} style={{ width: `${(mix[x.key] / total) * 100}%`, background: x.color }} />
            ))}
          </div>
          <dl className="mt-3 space-y-1 text-[0.8rem]">
            {MIX.map((x) => (
              <div key={x.key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: x.color }} />
                <dt className="text-slate">{x.label}</dt>
                <dd className="num ml-auto font-semibold">{mins(mix[x.key])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[0.75rem] text-slate">Average day, by intensity</p>
        </>
      )}
    </div>
  );
}