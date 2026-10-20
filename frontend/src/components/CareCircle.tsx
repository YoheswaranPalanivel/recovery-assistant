"use client";

import { useEffect, useState } from "react";
import type { CareAlertView, CareCircle as Circle } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useStaffLang } from "@/lib/lang";
import { AlertTrail, ReportView } from "./AlertTrail";

/** Who responds for this member, and their recent alerts with visit reports. Demo circle, labelled. */
export function CareCirclePanel({ userId }: { userId: string }) {
  const { version } = useLive();
  const { lang } = useStaffLang();
  const [d, setD] = useState<{ circle: Circle; alerts: CareAlertView[] } | null>(null);
  useEffect(() => {
    api.circle(userId).then(setD).catch(() => setD(null));
  }, [userId, version]);
  if (!d) return null;
  const c = d.circle;
  const row = (label: string, value: string) => (
    <li className="flex justify-between gap-3 py-1.5">
      <span className="text-slate">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </li>
  );
  return (
    <section className="card p-5">
      <h2 className="display text-[1.15rem] font-extrabold">
        Care circle <span className="ml-2 rounded-full bg-amber-pale px-2 py-0.5 align-middle text-[0.72rem] font-semibold text-amber">Demo</span>
      </h2>
      <p className="text-[0.85rem] text-slate">Who is asked when something is wrong, in this order.</p>
      <ul className="mt-2 divide-y divide-rule text-[0.9rem]">
        {row("1. Helper nearby", `${c.primary.name} · ${c.primary.area} · ${c.primary.language}`)}
        {row("2. Backup helper", `${c.backup.name} · ${c.backup.area} · ${c.backup.language}`)}
        {row("Family (shared with consent)", c.family ? `${c.family.name}, ${c.family.relation} · ${c.family.place} · ${c.family.language}` : "Not shared")}
        {c.family && (
          <li className="py-1.5 text-right">
            <a href={`/family/${encodeURIComponent(userId)}`} target="_blank" rel="noreferrer" className="text-[0.85rem] font-semibold text-brand hover:underline">
              👨‍👩‍👦 Open family view (what {c.family.name} sees on their phone) ↗
            </a>
          </li>
        )}
        {row("Care team", `${c.careTeam.name} · ${c.careTeam.language}`)}
      </ul>
      {d.alerts.length > 0 && (
        <div className="mt-4">
          <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">Recent alerts</p>
          <ul className="mt-1 divide-y divide-rule">
            {d.alerts.map((a) => (
              <li key={a.id} className="py-2">
                <p className="text-[0.88rem] font-semibold">
                  {a.status === "resolved" ? "✓ Resolved" : a.status === "accepted" ? `${a.acceptedBy} is going` : "Waiting"} · {a.kind.replace("_", " ")}
                </p>
                <AlertTrail a={a} max={4} />
                {a.report && <ReportView r={a.report} lang={lang} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}