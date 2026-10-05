"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@shared/types";
import { dec, int, shortDate } from "@/lib/format";

const AXIS = { fontSize: 12, fill: "#64748B" };

/** Minimal shape we read from Recharts' tooltip props. */
type TipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; label?: unknown };

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col p-6">
      <h2 className="display text-[1.35rem] font-bold leading-tight">{title}</h2>
      <p className="mb-4 mt-0.5 text-sm text-slate">{note}</p>
      <div className="h-[280px] w-full">{children}</div>
    </section>
  );
}

function TipBox({ label, rows }: { label: string; rows: [string, string, string][] }) {
  return (
    <div className="rounded-lg border border-rule bg-paper px-3 py-2 text-[0.82rem] shadow-[0_6px_18px_-8px_rgba(19,41,61,0.35)]">
      <div className="mb-1 font-bold">{label}</div>
      {rows.map(([name, value, color]) => (
        <div key={name} className="num flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-slate">{name}</span>
          <span className="ml-auto pl-4">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function StepsTrend({ data, target }: { data: TrendPoint[]; target: number }) {
  const Tip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as TrendPoint;
    return (
      <TipBox
        label={shortDate(String(label))}
        rows={[
          ["Average steps", int(p.avgSteps), "#BCE3EE"],
          ["7-day average", int(p.rolling7), "#0C4A6E"],
          ["People reporting", String(p.users), "transparent"],
        ]}
      />
    );
  };
  return (
    <Panel title="Daily steps" note={`Average across the selection, with a 7-day rolling line. Dashed line is the ${int(target)}-step target.`}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#EEF0F6" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} width={44} />
          <Tooltip content={(props) => <Tip {...(props as TipProps)} />} cursor={{ fill: "rgba(15,118,110,0.07)" }} />
          <Bar dataKey="avgSteps" fill="#BCE3EE" radius={[2, 2, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          <ReferenceLine y={target} stroke="#0E9F8E" strokeDasharray="5 4" strokeWidth={1.5} />
          <Line dataKey="rolling7" stroke="#0C4A6E" strokeWidth={2.4} dot={false} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

export function ComplianceSleep({ data, hasSleep, single = false }: { data: TrendPoint[]; hasSleep: boolean; single?: boolean }) {
  const Tip = ({ active, payload, label }: TipProps) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as TrendPoint;
    return (
      <TipBox
        label={shortDate(String(label))}
        rows={[
          ["Target met", `${dec(p.compliancePct, 0)}%`, "#0E9F8E"],
          ...(hasSleep ? ([["Average sleep", p.avgSleepHours === null ? "—" : `${dec(p.avgSleepHours)} h`, "#8B5CF6"]] as [string, string, string][]) : []),
        ]}
      />
    );
  };
  return (
    <Panel
      title={single ? (hasSleep ? "Goal days and sleep" : "Goal days") : hasSleep ? "Target met and sleep" : "Target met"}
      note={
        single
          ? `A bar marks each day this person reached the step goal${hasSleep ? "; the line is hours slept" : ""}.`
          : hasSleep
          ? "Share of people who reached the step target each day, with average hours slept."
          : "Share of people who reached the step target each day. This dataset has no sleep data."
      }
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: hasSleep ? 0 : 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="compFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0E9F8E" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0E9F8E" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#EEF0F6" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis yAxisId="pct" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={44} />
          {hasSleep && (
            <YAxis yAxisId="sleep" orientation="right" domain={[0, 10]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} width={36} />
          )}
          <Tooltip content={(props) => <Tip {...(props as TipProps)} />} />
          {single ? (
            // One person: each day is simply reached (100) or not (0), so bars read better than an area.
            <Bar yAxisId="pct" dataKey="compliancePct" fill="#2EC4AE" radius={[3, 3, 0, 0]} maxBarSize={10} isAnimationActive={false} />
          ) : (
            <Area yAxisId="pct" dataKey="compliancePct" stroke="#0E9F8E" strokeWidth={1.8} fill="url(#compFill)" isAnimationActive={false} />
          )}
          {hasSleep && (
            <Line yAxisId="sleep" dataKey="avgSleepHours" stroke="#8B5CF6" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}
