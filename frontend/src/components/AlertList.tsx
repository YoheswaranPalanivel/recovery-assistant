"use client";

import { useState } from "react";
import type { Alert } from "@shared/types";
import { shortDate, userLabel } from "@/lib/format";

const TYPE_LABEL: Record<Alert["type"], string> = {
  activity_drop: "Activity drop",
  low_sleep: "Low sleep",
  compliance_streak: "Missed-target streak",
  recovery_drop: "Recovery drop",
};

type Props = { alerts: Alert[]; onSelectUser: (id: string) => void; selectedUser?: string };

export function AlertList({ alerts, onSelectUser, selectedUser }: Props) {
  const [only, setOnly] = useState<"all" | "attention">("all");
  const shown = alerts.filter((a) => only === "all" || a.severity === "attention");
  const attention = alerts.filter((a) => a.severity === "attention").length;

  return (
    <section aria-labelledby="alerts-title" className="flex max-h-[680px] flex-col card">
      <div className="border-b border-rule px-5 pb-3 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="alerts-title" className="display text-[1.35rem] font-bold">
            Alerts
          </h2>
          <span className="num text-sm text-slate">{alerts.length} in range</span>
        </div>
        <p className="mt-0.5 text-sm text-slate">Rule-based. Each one shows the values that triggered it.</p>
        <div className="mt-3 flex gap-1 text-sm" role="group" aria-label="Filter alerts">
          {(
            [
              ["all", `All`],
              ["attention", `Needs attention (${attention})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={only === k}
              onClick={() => setOnly(k)}
              className={`rounded-md px-2.5 py-1 ${only === k ? "bg-brand text-white" : "text-slate hover:bg-fog hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate">
          No alerts for this selection. Alerts appear when someone drops well below their own recent baseline, sleeps much less than usual, or
          misses the target several days running.
        </p>
      ) : (
        <ol className="flex-1 divide-y divide-rule overflow-y-auto">
          {shown.slice(0, 60).map((a) => (
            <li key={a.id} className="px-5 py-3.5">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.severity === "attention" ? "bg-alarm" : "bg-amber/70"}`}
                  aria-label={a.severity === "attention" ? "Needs attention" : "Watch"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-x-3">
                    <span className="min-w-0 font-bold leading-snug">{a.title}</span>
                    <span className="num shrink-0 whitespace-nowrap text-[0.8rem] text-slate">{shortDate(a.date)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.82rem] text-slate">
                    <span>{TYPE_LABEL[a.type]}</span>
                    {a.userId !== selectedUser && (
                      <button type="button" onClick={() => onSelectUser(a.userId)} className="text-stride underline-offset-2 hover:underline">
                        Focus on {userLabel(a.userId)}
                      </button>
                    )}
                  </div>
                  <dl className="num mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[0.82rem]">
                    {a.evidence.map((e) => (
                      <div key={e.label} className="contents">
                        <dt className="text-slate">{e.label}</dt>
                        <dd className="text-ink">{e.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
