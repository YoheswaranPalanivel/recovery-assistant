"use client";

import type { CareAlertView, VisitReport } from "@shared/types";
import { LABELS, type Lang } from "@shared/messages";
import { when } from "./Glucose";

const ICON: Record<string, string> = { raised: "•", sent: "→", accepted: "✓", declined: "✕", escalated: "↗", family_call: "📞", emergency: "🚑", reported: "📝" };

/** Who was asked, who answered, what happened: the alert's trail, oldest first. */
export function AlertTrail({ a, max = 6 }: { a: CareAlertView; max?: number }) {
  const items = a.timeline.slice(-max);
  return (
    <ol className="mt-1.5 space-y-0.5 text-[0.8rem] text-slate">
      {items.map((e, i) => (
        <li key={i} className={e.kind === "emergency" ? "font-semibold text-alarm" : e.kind === "accepted" || e.kind === "reported" ? "text-stride-deep" : ""}>
          <span className="mr-1">{ICON[e.kind]}</span>
          {e.text} <span className="opacity-70">· {when(e.at)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The visit report as a checklist in the reader's language; the note is shown exactly as written. */
export function ReportView({ r, lang }: { r: VisitReport; lang: Lang }) {
  return (
    <div className="mt-2 rounded-xl bg-fog px-3 py-2 text-[0.84rem]">
      <p className="font-semibold">
        Visit report by {r.by} · {when(r.at)}
        {r.recheckMgdl ? ` · recheck ${r.recheckMgdl} mg/dL` : ""}
      </p>
      <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
        {(Object.keys(r.checks) as (keyof VisitReport["checks"])[]).map((k) => (
          <li key={k} className={r.checks[k] ? "" : "text-slate line-through"}>
            {r.checks[k] ? "☑" : "☐"} {LABELS.check[k][lang]}
          </li>
        ))}
      </ul>
      {r.note && (
        <p className="mt-1 text-[0.8rem]">
          <span className="text-slate">Note, as written (not translated): </span>
          {r.note}
        </p>
      )}
    </div>
  );
}