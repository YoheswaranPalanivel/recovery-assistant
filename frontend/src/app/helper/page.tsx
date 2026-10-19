"use client";

import { useEffect, useState } from "react";
import type { CareAlertView, Helper, VisitReport } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { LABELS, LANG_NAME, render, type MessageKey } from "@shared/messages";
import { when } from "@/components/Glucose";
import { AlertTrail } from "@/components/AlertTrail";

const KEY: Record<CareAlertView["kind"], MessageKey> = {
  glucose_low: "alert_glucose_low",
  glucose_high: "alert_glucose_high",
  not_well: "alert_not_well",
  help: "alert_help",
};
const EMPTY: VisitReport["checks"] = { seen: false, talking: false, plan_followed: false, care_team_told: false, ambulance: false };

/** One accepted alert: the visit report form, a checklist in the helper's own language. */
function ReportForm({ a, helper, onDone }: { a: CareAlertView; helper: Helper; onDone: () => void }) {
  const [checks, setChecks] = useState(EMPTY);
  const [recheck, setRecheck] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    try {
      await api.reportAlert(a.id, { helperId: helper.id, checks, recheckMgdl: recheck ? Number(recheck) : null, note });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-rule p-3">
      <p className="text-[0.82rem] font-bold uppercase tracking-[0.08em] text-slate">Visit report</p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {(Object.keys(EMPTY) as (keyof VisitReport["checks"])[]).map((k) => (
          <label key={k} className="flex items-center gap-2 text-[0.9rem]">
            <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} className="h-4 w-4" />
            {LABELS.check[k][helper.language]}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="text-[0.82rem] text-slate">
          Recheck reading (mg/dL)
          <input type="number" value={recheck} onChange={(e) => setRecheck(e.target.value)} className="mt-1 block h-9 w-32 rounded-lg border border-rule bg-paper px-2 text-ink" />
        </label>
        <label className="min-w-[240px] flex-1 text-[0.82rem] text-slate">
          Note (shown to others exactly as written)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="mt-1 block h-9 w-full rounded-lg border border-rule bg-paper px-2 text-ink" />
        </label>
      </div>
      <button type="button" onClick={send} disabled={!checks.seen} className="brand-gradient mt-3 rounded-xl px-4 py-2 font-bold text-white disabled:opacity-50">
        Send report to family and care team
      </button>
      {err && <p className="mt-2 text-sm text-alarm">{err}</p>}
    </div>
  );
}

/** Demo: what a community helper sees on their phone. Staff choose which helper to act as. */
export default function HelperPage() {
  const { version } = useLive();
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [me, setMe] = useState<string>("");
  const [list, setList] = useState<CareAlertView[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.helpers().then((h) => {
      setHelpers(h);
      setMe((m) => m || h[0]?.id || "");
    });
  }, []);
  useEffect(() => {
    if (me) api.helperAlerts(me).then(setList).catch((e) => setErr(e.message));
  }, [me, version, reload]);

  const helper = helpers.find((h) => h.id === me);
  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      setReload((n) => n + 1);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[2rem] font-extrabold leading-tight">Helper requests</h1>
          <p className="mt-1 text-slate">What a community helper sees on their phone. Accept, or say you can&apos;t go so the backup is asked straight away.</p>
        </div>
        <label className="text-[0.85rem] text-slate">
          Demo: act as
          <select value={me} onChange={(e) => setMe(e.target.value)} className="ml-2 h-10 rounded-xl border border-rule bg-paper px-3 text-ink">
            {helpers.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} · {h.area} · {LANG_NAME[h.language]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err && <p className="text-sm text-alarm">{err}</p>}
      {!list.length && <p className="card p-6 text-slate">No requests for {helper?.name ?? "this helper"} right now.</p>}
      {helper &&
        list.map((a) => (
          <article key={a.id} className={`card p-5 ${a.severity === "urgent" ? "border-alarm/40" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="display text-[1.2rem] font-extrabold">
                  {a.name}
                  <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[0.72rem] font-bold ${a.severity === "urgent" ? "bg-alarm-pale text-alarm" : "bg-amber-pale text-amber"}`}>
                    {a.severity === "urgent" ? "Urgent" : "Today"}
                  </span>
                </p>
                <p className="mt-0.5 text-[0.95rem]">
                  {render(KEY[a.kind], helper.language, { mgdl: a.data.mgdl ?? "-", low: a.data.low ?? "-", high: a.data.high ?? "-", time: when(a.at) })}
                </p>
                <p className="text-[0.82rem] text-slate">
                  {a.circle.primary.area} · speaks {a.language}
                  {a.circle.family ? ` · family: ${a.circle.family.name} (${a.circle.family.relation}, ${a.circle.family.place})` : ""}
                </p>
              </div>
              {a.status === "open" ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => act(() => api.acceptAlert(a.id, helper.id))} className="brand-gradient rounded-xl px-4 py-2 font-bold text-white">
                    Accept, I&apos;m going
                  </button>
                  <button type="button" onClick={() => act(() => api.declineAlert(a.id, helper.id))} className="rounded-xl border border-rule px-4 py-2 font-semibold">
                    Can&apos;t go
                  </button>
                </div>
              ) : (
                <span className="rounded-full bg-stride-pale px-3 py-1 text-[0.82rem] font-bold text-stride-deep">You accepted</span>
              )}
            </div>
            <AlertTrail a={a} />
            {a.status === "accepted" && <ReportForm a={a} helper={helper} onDone={() => setReload((n) => n + 1)} />}
          </article>
        ))}
    </div>
  );
}