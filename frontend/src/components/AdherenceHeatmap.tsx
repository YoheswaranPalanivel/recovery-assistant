"use client";

import { useState } from "react";
import type { HeatRow } from "@shared/types";
import { int, shortDate, userLabel } from "@/lib/format";

/** Diverging scale around the target: warm = under, cool = over, depth = distance. */
export function cellColor(ratio: number | null): string {
  if (ratio === null) return "transparent";
  if (ratio < 0.25) return "#E8892B";
  if (ratio < 0.5) return "#F2A93B";
  if (ratio < 0.75) return "#F7C978";
  if (ratio < 1) return "#FBE6BD";
  if (ratio < 1.25) return "#9FE3D6";
  if (ratio < 1.5) return "#2EC4AE";
  return "#0B7F72";
}

const LEGEND = [
  { r: 0.1, label: "< 25%" },
  { r: 0.4, label: "" },
  { r: 0.6, label: "" },
  { r: 0.9, label: "just under" },
  { r: 1.1, label: "met" },
  { r: 1.4, label: "" },
  { r: 1.6, label: "150%+" },
];

type Props = {
  rows: HeatRow[];
  target: number;
  selected?: string;
  onSelect: (userId: string | undefined) => void;
};

export function AdherenceHeatmap({ rows, target, selected, onSelect }: Props) {
  const [hover, setHover] = useState<{ user: string; date: string; steps: number | null } | null>(null);
  const days = rows[0]?.cells.map((c) => c.date) ?? [];
  const needsAttention = rows.filter((r) => r.compliancePct < 30).length;

  return (
    <section aria-labelledby="heat-title" className="card">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-5 pb-4 pt-5">
        <div className="max-w-[60ch]">
          <h2 id="heat-title" className="display text-[1.7rem] font-bold leading-tight">
            Step goal, person by person
          </h2>
          <p className="mt-1 text-[0.95rem] text-slate">
            Each square is one day. Orange means under {int(target)} steps, green means over. People who need the most help are at the top
            {needsAttention ? ` (${needsAttention} reached the goal on fewer than 30% of days)` : ""}. Click a row to focus on that person.
          </p>
        </div>
        <Legend />
      </div>

      <div className="overflow-x-auto px-5 pb-5">
        <div className="min-w-[720px]">
          {/* date axis: a tick every 7 days */}
          <div className="flex items-end pb-1 pl-[84px] pr-[56px] text-[0.72rem] text-slate">
            {days.map((d, i) => (
              <span key={d} className="num flex-1 whitespace-nowrap">
                {i % (days.length <= 10 ? 1 : days.length <= 21 ? 3 : 7) === 0 ? shortDate(d) : ""}
              </span>
            ))}
          </div>

          <div className="max-h-[440px] overflow-y-auto pr-1" role="list">
            {rows.map((row) => {
              const isSel = row.userId === selected;
              return (
                <button
                  key={row.userId}
                  type="button"
                  role="listitem"
                  onClick={() => onSelect(isSel ? undefined : row.userId)}
                  aria-pressed={isSel}
                  aria-label={`${userLabel(row.userId)}, target met on ${Math.round(row.compliancePct)}% of days`}
                  className={`group flex w-full items-center rounded-md py-[3px] text-left transition-colors ${
                    isSel ? "bg-brand-soft" : selected ? "opacity-55 hover:opacity-100" : "hover:bg-fog"
                  }`}
                >
                  <span
                    className={`num w-[84px] shrink-0 pl-1 text-[0.85rem] ${isSel ? "font-bold text-ink" : "text-slate group-hover:text-ink"}`}
                    title={row.userId}
                  >
                    {userLabel(row.userId)}
                  </span>
                  <span className="flex flex-1 gap-[3px]">
                    {row.cells.map((c) => (
                      <span
                        key={c.date}
                        onMouseEnter={() => setHover({ user: row.userId, date: c.date, steps: c.steps })}
                        onMouseLeave={() => setHover(null)}
                        className={`h-[18px] flex-1 rounded-[3px] ${c.ratio === null ? "cell-empty" : ""}`}
                        style={{ background: c.ratio === null ? undefined : cellColor(c.ratio) }}
                      />
                    ))}
                  </span>
                  <span className={`num w-[56px] shrink-0 text-right text-[0.85rem] ${row.compliancePct < 30 ? "font-bold text-amber" : "text-slate"}`}>
                    {Math.round(row.compliancePct)}%
                  </span>
                </button>
              );
            })}
          </div>

          <p className="num mt-2 h-5 pl-[84px] text-[0.82rem] text-slate" aria-live="polite">
            {hover
              ? `${userLabel(hover.user)} on ${shortDate(hover.date)}: ${
                  hover.steps === null ? "no data (device not worn or not synced)" : `${int(hover.steps)} steps, ${Math.round((hover.steps / target) * 100)}% of target`
                }`
              : "Point at a square to see that day's steps."}
          </p>
        </div>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[0.78rem] text-slate" aria-hidden>
      <span>Under target</span>
      <span className="flex gap-[3px]">
        {LEGEND.map((l) => (
          <span key={l.r} className="h-3.5 w-5 rounded-[3px]" style={{ background: cellColor(l.r) }} title={l.label} />
        ))}
      </span>
      <span>Over target</span>
      <span className="ml-2 flex items-center gap-1.5">
        <span className="cell-empty h-3.5 w-5 rounded-[3px] border border-rule" />
        No data
      </span>
    </div>
  );
}
