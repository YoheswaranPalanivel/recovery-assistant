"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CareAlertView, FamilyView } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { LABELS, UI, render, type Lang, type MessageKey } from "@shared/messages";
import { when } from "@/components/Glucose";
import { ReportView } from "@/components/AlertTrail";

const KEY: Record<CareAlertView["kind"], MessageKey> = {
  glucose_low: "alert_glucose_low",
  glucose_high: "alert_glucose_high",
  not_well: "alert_not_well",
  help: "alert_help",
  family_request: "alert_family_request",
};

/**
 * What a family member far away sees on their phone, in their own language: is she okay, what is happening
 * right now, who is on the way, and the visit report. Demo: opened by staff to show the family's side.
 */
export default function FamilyPhone() {
  const { id } = useParams<{ id: string }>();
  const userId = decodeURIComponent(id);
  const { version } = useLive();
  const [d, setD] = useState<FamilyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.family(userId).then(setD).catch((e) => setError(e.message));
  }, [userId, version]);

  const ask = async () => {
    setBusy(true);
    try {
      await api.familyRequest(userId);
      setD(await api.family(userId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const lang: Lang = d?.family?.language ?? "English";
  const a = d?.alert ?? null;
  const name = d?.name ?? "";
  const status: { key: MessageKey; tone: string; params: Record<string, string> } = !a
    ? { key: "fam_all_ok" as MessageKey, tone: "bg-stride-pale", params: { name } }
    : a.status === "accepted"
      ? { key: "fam_on_way" as MessageKey, tone: "bg-stride-pale", params: { name, helper: a.acceptedBy ?? "" } }
      : a.level === 2
        ? { key: "fam_emergency" as MessageKey, tone: "bg-alarm text-white", params: { name } }
        : a.level === 1
          ? { key: "fam_call_now" as MessageKey, tone: "bg-amber-pale", params: { name } }
          : { key: "fam_waiting" as MessageKey, tone: "bg-amber-pale", params: { name, helper: a.circle.primary.name } };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#E4F0FA,#E3F6EF)] p-6">
      <div className="w-full max-w-[380px] overflow-hidden rounded-[2.5rem] border-[10px] border-ink bg-fog shadow-2xl">
        <div className="flex items-center justify-between bg-paper px-5 pb-2 pt-3 text-[0.72rem] font-semibold text-slate">
          <span>9:41</span>
          <span className="rounded-full bg-amber-pale px-2 py-0.5 text-amber">Demo: family&apos;s phone</span>
        </div>
        {error && <p className="p-5 text-sm text-alarm">{error}</p>}
        {!d && !error && <p className="p-5 text-slate">Loading…</p>}
        {d && (
          <div className="flex flex-col gap-3 p-4">
            <div className="brand-gradient rounded-3xl px-5 py-4 text-white">
              <p className="text-[0.85rem] opacity-80">
                {d.family ? `${d.family.name} · ${d.family.place}` : ""}
              </p>
              <p className="display text-[1.6rem] font-extrabold leading-tight">{d.name}</p>
            </div>

            {!d.sharing ? (
              <p className="rounded-3xl bg-paper p-4 text-[0.95rem]">{UI.fam_not_shared[lang]}</p>
            ) : (
              <>
                <div className={`rounded-3xl p-4 ${status.tone}`}>
                  <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] opacity-80">{UI.fam_today[lang]}</p>
                  {a && (
                    <p className="mt-1 text-[0.85rem] font-semibold">
                      {render(KEY[a.kind], lang, { mgdl: a.data.mgdl ?? "-", low: a.data.low ?? "-", high: a.data.high ?? "-", time: when(a.at), family: d.family?.name ?? "" })}
                    </p>
                  )}
                  <p className="mt-1 text-[1.05rem] font-bold leading-snug">{render(status.key, lang, status.params)}</p>
                  {a?.level === 2 && a.status === "open" && (
                    <a href="tel:108" className="mt-3 block rounded-2xl bg-white py-3 text-center text-[1.1rem] font-extrabold text-alarm">
                      📞 108
                    </a>
                  )}
                </div>

                {!a && (
                  <button type="button" onClick={ask} disabled={busy} className="rounded-3xl border-2 border-brand bg-paper px-4 py-3 font-bold text-brand disabled:opacity-50">
                    {render("fam_ask_button", lang, { name })}
                  </button>
                )}

                {d.glucose?.latest && (
                  <div className="rounded-3xl bg-paper p-4">
                    <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">{UI.fam_latest[lang]}</p>
                    <p className="mt-1 text-[0.95rem]">
                      {render("glucose_staff", lang, {
                        mgdl: d.glucose.latest.mgdl,
                        band: LABELS.band[d.glucose.latest.band][lang],
                        low: d.glucose.limits.low,
                        high: d.glucose.limits.high,
                        kind: LABELS.kind[d.glucose.latest.kind][lang],
                        time: when(d.glucose.latest.at),
                      })}
                    </p>
                  </div>
                )}

                {d.checkIn && (
                  <div className="rounded-3xl bg-paper p-4">
                    <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">{UI.fam_checkin[lang]}</p>
                    <p className="mt-1 text-[0.95rem]">
                      {LABELS.mood[d.checkIn.mood][lang]} · {when(d.checkIn.at)}
                    </p>
                  </div>
                )}

                {d.reports.length > 0 && (
                  <div className="rounded-3xl bg-paper p-4">
                    <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">{UI.fam_reports[lang]}</p>
                    {d.reports.map((r) => r.report && <ReportView key={r.id} r={r.report} lang={lang} />)}
                  </div>
                )}
              </>
            )}
            <p className="px-2 pb-2 text-center text-[0.72rem] text-slate">Shared by {d.name} with consent. This app never gives medical advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}