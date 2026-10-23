"use client";

import { useEffect, useState } from "react";
import type { DoseSlot, Medicine, MedicinesView } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useStaffLang } from "@/lib/lang";
import { LABELS, UI, type Lang } from "@shared/messages";

const SLOTS: DoseSlot[] = ["morning", "afternoon", "night"];
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Name, strength and dose exactly as the doctor entered them. Never translated, never changed. */
export const asPrescribed = (m: Medicine) => `${m.name} ${m.strength.value} ${m.strength.unit} · ${m.dose.count} ${m.dose.unit}${m.dose.count === 1 ? "" : "s"}`;

/** Today's doses for one medicine: taken (with the time) or not yet. */
function Doses({ m, v, lang, onTake }: { m: Medicine; v: MedicinesView; lang: Lang; onTake?: (slot: DoseSlot) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {m.times.map((slot) => {
        const s = v.today.find((d) => d.medicineId === m.id && d.slot === slot);
        return s?.takenAt ? (
          <span key={slot} className="rounded-xl bg-stride-pale px-2.5 py-1 text-[0.8rem] font-semibold text-stride-deep">
            ✓ {LABELS.slot[slot][lang]} · {UI.meds_taken[lang]} {time(s.takenAt)}
          </span>
        ) : onTake ? (
          <button key={slot} type="button" onClick={() => onTake(slot)} className="rounded-xl border-2 border-brand px-2.5 py-1 text-[0.82rem] font-bold text-brand">
            {LABELS.slot[slot][lang]}: {UI.meds_mark[lang]}
          </button>
        ) : (
          <span key={slot} className="rounded-xl bg-fog px-2.5 py-1 text-[0.8rem] text-slate">
            {LABELS.slot[slot][lang]} · {UI.meds_not_yet[lang]}
          </span>
        );
      })}
    </div>
  );
}

/** The member's phone: their medicines as prescribed, and a button to mark each dose. */
export function PhoneMeds({ userId, v, lang, onChanged }: { userId: string; v: MedicinesView; lang: Lang; onChanged: () => void }) {
  if (!v.medicines.length) return null;
  const take = async (m: Medicine, slot: DoseSlot) => {
    await api.markTaken(m.id, userId, slot);
    onChanged();
  };
  return (
    <div className="rounded-3xl bg-paper p-4">
      <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">💊 {UI.meds_title[lang]}</p>
      {v.medicines.map((m) => (
        <div key={m.id} className="mt-3 border-t border-rule pt-3 first:mt-2 first:border-0 first:pt-0">
          <p className="text-[1rem] font-extrabold" lang="en">
            {asPrescribed(m)}
          </p>
          <p className="text-[0.82rem] text-slate">
            {m.times.map((s) => LABELS.slot[s][lang]).join(", ")} · {LABELS.food[m.food][lang]}
          </p>
          <Doses m={m} v={v} lang={lang} onTake={(slot) => take(m, slot)} />
        </div>
      ))}
    </div>
  );
}

/** The family's phone: which doses were taken today. */
export function FamilyMeds({ v, lang }: { v: MedicinesView; lang: Lang }) {
  if (!v.medicines.length) return null;
  return (
    <div className="rounded-3xl bg-paper p-4">
      <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">💊 {UI.meds_today[lang]}</p>
      {v.medicines.map((m) => (
        <div key={m.id} className="mt-2">
          <p className="font-bold" lang="en">
            {asPrescribed(m)}
          </p>
          <Doses m={m} v={v} lang={lang} />
        </div>
      ))}
    </div>
  );
}

/** The member page: current prescriptions, today's doses, and (for the care team) entering or stopping one. */
export function MedicinesPanel({ userId, isAdmin, defaultDoctor }: { userId: string; isAdmin: boolean; defaultDoctor: string }) {
  const { version } = useLive();
  const { lang } = useStaffLang();
  const [v, setV] = useState<MedicinesView | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", sv: "", su: "mg", dc: "1", du: "tablet", times: ["morning"] as DoseSlot[], food: "after", by: defaultDoctor });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.medicines(userId).then(setV).catch(() => setV(null));
  }, [userId, version, reload]);

  const add = async () => {
    setErr(null);
    try {
      await api.addMedicine({
        userId,
        name: f.name,
        strength: { value: Number(f.sv), unit: f.su as Medicine["strength"]["unit"] },
        dose: { count: Number(f.dc), unit: f.du as Medicine["dose"]["unit"] },
        times: f.times,
        food: f.food as Medicine["food"],
        prescribedBy: f.by,
      });
      setOpen(false);
      setF({ ...f, name: "", sv: "" });
      setReload((n) => n + 1);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const stop = async (id: string) => {
    if (!confirm("Stop this medicine? It stays in the record but is no longer shown as current.")) return;
    await api.stopMedicine(id);
    setReload((n) => n + 1);
  };

  const input = "mt-1 block h-9 rounded-lg border border-rule bg-paper px-2 text-ink";
  return (
    <section className="card p-5">
      <h2 className="display text-[1.15rem] font-extrabold">💊 Medicines</h2>
      <p className="text-[0.85rem] text-slate">
        Shown to the member and family exactly as the care team entered them. The app never suggests, calculates, changes or translates a medicine or a
        dose; only the timing words are shown in each reader&apos;s language.
      </p>
      {!v?.medicines.length && <p className="mt-3 text-slate">No current medicines.</p>}
      <ul className="mt-2 divide-y divide-rule">
        {v?.medicines.map((m) => (
          <li key={m.id} className="py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-extrabold">{asPrescribed(m)}</p>
                <p className="text-[0.82rem] text-slate">
                  {m.times.map((s) => LABELS.slot[s][lang]).join(", ")} · {LABELS.food[m.food][lang]} · prescribed by {m.prescribedBy}
                  {m.demo && <span className="ml-2 rounded-full bg-amber-pale px-2 py-0.5 text-[0.7rem] font-semibold text-amber">Demo</span>}
                </p>
              </div>
              {isAdmin && (
                <button type="button" onClick={() => stop(m.id)} className="text-[0.82rem] text-slate hover:text-alarm">
                  Stop
                </button>
              )}
            </div>
            {v && <Doses m={m} v={v} lang={lang} />}
          </li>
        ))}
      </ul>
      {isAdmin &&
        (open ? (
          <div className="mt-3 rounded-xl border border-rule p-3 text-[0.82rem] text-slate">
            <p className="font-bold text-ink">Care team: enter a prescription</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label>
                Medicine
                <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Metformin" className={`${input} w-40`} />
              </label>
              <label>
                Strength
                <span className="flex gap-1">
                  <input type="number" value={f.sv} onChange={(e) => setF({ ...f, sv: e.target.value })} placeholder="500" className={`${input} w-20`} />
                  <select value={f.su} onChange={(e) => setF({ ...f, su: e.target.value })} className={input}>
                    {["mg", "g", "mcg", "ml", "units"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </span>
              </label>
              <label>
                Dose
                <span className="flex gap-1">
                  <input type="number" value={f.dc} onChange={(e) => setF({ ...f, dc: e.target.value })} className={`${input} w-16`} />
                  <select value={f.du} onChange={(e) => setF({ ...f, du: e.target.value })} className={input}>
                    {["tablet", "capsule", "units", "ml"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </span>
              </label>
              <span>
                When
                <span className="mt-1 flex gap-2">
                  {SLOTS.map((s) => (
                    <label key={s} className="flex items-center gap-1 text-ink">
                      <input
                        type="checkbox"
                        checked={f.times.includes(s)}
                        onChange={(e) => setF({ ...f, times: e.target.checked ? [...f.times, s] : f.times.filter((x) => x !== s) })}
                      />
                      {LABELS.slot[s].English}
                    </label>
                  ))}
                </span>
              </span>
              <label>
                Food
                <select value={f.food} onChange={(e) => setF({ ...f, food: e.target.value })} className={input}>
                  <option value="after">After food</option>
                  <option value="before">Before food</option>
                  <option value="any">With or without food</option>
                </select>
              </label>
              <label>
                Prescribed by
                <input value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} className={`${input} w-56`} />
              </label>
              <button type="button" onClick={add} disabled={!f.name || !f.sv || !f.times.length} className="h-9 rounded-lg bg-brand px-3 font-semibold text-white disabled:opacity-50">
                Save
              </button>
            </div>
            {err && <p className="mt-2 text-alarm">{err}</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[0.85rem] font-semibold text-brand hover:underline">
            + Care team: enter a prescription
          </button>
        ))}
    </section>
  );
}