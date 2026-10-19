"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CareAlertView } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useStaffLang } from "@/lib/lang";
import { render, type MessageKey } from "@shared/messages";
import { when } from "./Glucose";

const KEY: Record<CareAlertView["kind"], MessageKey> = {
  glucose_low: "alert_glucose_low",
  glucose_high: "alert_glucose_high",
  not_well: "alert_not_well",
  help: "alert_help",
};
const ICON: Record<CareAlertView["kind"], string> = { glucose_low: "🩸", glucose_high: "🩸", not_well: "😟", help: "🆘" };

/** Alerts that need someone to respond now, at the top of the Today page. Text is from approved templates. */
export function OpenAlerts() {
  const { version } = useLive();
  const { lang } = useStaffLang();
  const [alerts, setAlerts] = useState<CareAlertView[] | null>(null);

  useEffect(() => {
    api.alerts().then(setAlerts).catch(() => setAlerts([]));
  }, [version]);

  if (!alerts?.length) return null;
  const urgent = alerts.filter((a) => a.severity === "urgent").length;

  return (
    <section aria-labelledby="alerts" className="card border-alarm/30 p-5">
      <h2 id="alerts" className="display flex flex-wrap items-center gap-2 text-[1.15rem] font-extrabold">
        Needs a response now
        <span className="rounded-full bg-alarm px-2.5 py-0.5 text-[0.78rem] font-bold text-white">{alerts.length}</span>
        {urgent > 0 && <span className="text-[0.82rem] font-semibold text-alarm">{urgent} urgent</span>}
      </h2>
      <ul className="mt-3 divide-y divide-rule">
        {alerts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="text-[1.3rem]" aria-hidden>
              {ICON[a.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                <Link href={`/members/${encodeURIComponent(a.userId)}`} className="hover:text-brand hover:underline">
                  {a.name}
                </Link>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.72rem] font-bold ${a.severity === "urgent" ? "bg-alarm-pale text-alarm" : "bg-amber-pale text-amber"}`}>
                  {a.severity === "urgent" ? "Urgent" : "Today"}
                </span>
              </p>
              <p className="text-[0.88rem] text-slate">
                {render(KEY[a.kind], lang, { mgdl: a.data.mgdl ?? "-", low: a.data.low ?? "-", high: a.data.high ?? "-", time: when(a.at) })}
              </p>
            </div>
            <span className="text-[0.8rem] text-slate">{a.status === "accepted" ? `Accepted by ${a.acceptedBy}` : "Waiting for a helper"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}