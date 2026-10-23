"use client";

import { useState } from "react";
import type { GlucoseBand, GlucoseKind, GlucoseSummary } from "@shared/types";
import { api } from "@/lib/api";
import { useStaffLang } from "@/lib/lang";
import { LABELS, UI, render } from "@shared/messages";

export const BAND: Record<GlucoseBand, { label: string; ta: string; chip: string; dot: string }> = {
  low: { label: "Low", ta: "குறைவு", chip: "bg-alarm-pale text-alarm", dot: "var(--color-alarm)" },
  in_range: { label: "In range", ta: "சரியான அளவு", chip: "bg-stride-pale text-stride-deep", dot: "#0E9F8E" },
  high: { label: "High", ta: "அதிகம்", chip: "bg-amber-pale text-amber", dot: "#D97706" },
};
export const KIND: Record<GlucoseKind, { label: string; ta: string }> = {
  fasting: { label: "Before breakfast", ta: "காலை உணவுக்கு முன்" },
  post_meal: { label: "After a meal", ta: "சாப்பிட்ட பின்" },
  random: { label: "Other time", ta: "வேறு நேரம்" },
};

export const when = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return today ? `today ${t}` : `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${t}`;
};

/** One-line chip for a member card: the latest reading against their care team's levels. */
export function GlucoseChip({ g }: { g: GlucoseSummary | null | undefined }) {
  const { lang } = useStaffLang();
  if (!g?.latest) return null;
  const r = g.latest;
  const text = render("glucose_staff", lang, {
    mgdl: r.mgdl,
    band: LABELS.band[r.band][lang],
    low: g.limits.low,
    high: g.limits.high,
    kind: LABELS.kind[r.kind][lang],
    time: when(r.at),
  });
  return <p className={`mt-2 inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[0.82rem] font-semibold ${BAND[r.band].chip}`}>🩸 {text}</p>;
}

/** The member page panel: latest reading, the care team's levels, 14 days of readings, and entry. */
export function GlucosePanel({ userId, g, isAdmin, onChanged }: { userId: string; g: GlucoseSummary; isAdmin: boolean; onChanged: () => void }) {
  const [mgdl, setMgdl] = useState("");
  const [kind, setKind] = useState<GlucoseKind>("fasting");
  const [low, setLow] = useState(String(g.limits.low));
  const [high, setHigh] = useState(String(g.limits.high));
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const demo = g.readings.some((r) => r.source === "demo");
  const { lang } = useStaffLang();

  const add = async () => {
    setErr(null);
    try {
      await api.addGlucose(userId, Number(mgdl), kind);
      setMgdl("");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const saveLimits = async () => {
    setErr(null);
    try {
      await api.setGlucoseLimits(userId, Number(low), Number(high));
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // chart: 14 days left to right, mg/dL bottom to top, the care team's range shaded
  const W = 640, H = 190, padL = 44, padR = 16, padT = 14, padB = 28;
  const now = Date.now(), from = now - 14 * 864e5;
  const yMin = 40, yMax = Math.max(320, ...g.readings.map((r) => r.mgdl + 20));
  const X = (iso: string) => padL + ((Date.parse(iso) - from) / (now - from)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const l = g.limits;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display text-[1.15rem] font-extrabold">Blood sugar</h2>
          <p className="text-[0.85rem] text-slate">
            Alert levels: below {l.low} or above {l.high} mg/dL ·{" "}
            {l.setBy === "care_team" ? `set by the care team${l.at ? ` on ${new Date(l.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}` : "programme default until the care team sets them"}
            {demo && <span className="ml-2 rounded-full bg-amber-pale px-2 py-0.5 text-[0.72rem] font-semibold text-amber">Demo readings</span>}
          </p>
        </div>
        {g.latest ? (
          <div className="text-right">
            <p className="display num text-[2rem] font-extrabold leading-none">
              {g.latest.mgdl} <span className="text-[0.9rem] font-semibold text-slate">mg/dL</span>
            </p>
            <p className="mt-1 text-[0.8rem] text-slate">
              {LABELS.kind[g.latest.kind][lang]} · {when(g.latest.at)} · {g.latest.source === "device" ? "📟 from meter" : g.latest.source === "demo" ? "demo" : "⌨️ typed"}{" "}
              <span className={`ml-1 rounded-full px-2 py-0.5 font-bold ${BAND[g.latest.band].chip}`}>{LABELS.band[g.latest.band][lang]}</span>
            </p>
          </div>
        ) : (
          <p className="text-slate">No readings yet</p>
        )}
      </div>

      {g.readings.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="Blood sugar readings over the last 14 days">
            <rect x={padL} y={Y(l.high)} width={W - padL - padR} height={Y(l.low) - Y(l.high)} fill="#0E9F8E" fillOpacity="0.08" />
            {[l.low, l.high].map((v) => (
              <g key={v}>
                <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="#8AA0A8" strokeDasharray="4 4" />
                <text x={padL - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-slate)">
                  {v}
                </text>
              </g>
            ))}
            <polyline points={g.readings.filter((r) => r.kind === "fasting").map((r) => `${X(r.at)},${Y(r.mgdl)}`).join(" ")} fill="none" stroke="#8AA0A8" strokeWidth="1.25" />
            {g.readings.map((r) => {
              const b = r.mgdl < l.low ? "low" : r.mgdl > l.high ? "high" : "in_range";
              return (
                <circle key={r.id} cx={X(r.at)} cy={Y(r.mgdl)} r={r.kind === "fasting" ? 4.5 : 3.5} fill={BAND[b].dot} fillOpacity={r.kind === "fasting" ? 1 : 0.55}>
                  <title>{`${r.mgdl} mg/dL, ${KIND[r.kind].label.toLowerCase()}, ${when(r.at)}, ${r.source === "device" ? "from meter" : r.source === "demo" ? "demo" : "typed"}`}</title>
                </circle>
              );
            })}
            <text x={padL} y={H - 8} fontSize="11" fill="var(--color-slate)">14 days ago</text>
            <text x={W - padR} y={H - 8} fontSize="11" textAnchor="end" fill="var(--color-slate)">today</text>
          </svg>
          <p className="mt-1 text-[0.8rem] text-slate">
            Last 7 days: {g.last7.count} readings, {g.last7.inRangePct ?? 0}% in range, {g.last7.low} low, {g.last7.high} high. Solid dots: before breakfast; light
            dots: after a meal. Shaded band: the care team&apos;s range.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-rule pt-4">
        <label className="text-[0.82rem] text-slate">
          New reading (mg/dL)
          <input
            type="number"
            inputMode="numeric"
            min={20}
            max={600}
            value={mgdl}
            onChange={(e) => setMgdl(e.target.value)}
            className="mt-1 block h-9 w-28 rounded-lg border border-rule bg-paper px-2 text-ink"
          />
        </label>
        <select value={kind} onChange={(e) => setKind(e.target.value as GlucoseKind)} aria-label="When it was taken" className="h-9 rounded-lg border border-rule bg-paper px-2 text-[0.85rem]">
          {(Object.keys(KIND) as GlucoseKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND[k].label}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={!mgdl} className="h-9 rounded-lg border border-brand px-3 text-[0.85rem] font-semibold text-brand disabled:opacity-50">
          Add reading
        </button>
        {isAdmin &&
          (editing ? (
            <span className="ml-auto flex items-end gap-2 text-[0.82rem] text-slate">
              <label>
                Low
                <input type="number" value={low} onChange={(e) => setLow(e.target.value)} className="mt-1 block h-9 w-20 rounded-lg border border-rule bg-paper px-2 text-ink" />
              </label>
              <label>
                High
                <input type="number" value={high} onChange={(e) => setHigh(e.target.value)} className="mt-1 block h-9 w-20 rounded-lg border border-rule bg-paper px-2 text-ink" />
              </label>
              <button type="button" onClick={saveLimits} className="h-9 rounded-lg bg-brand px-3 font-semibold text-white">
                Save levels
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="ml-auto h-9 rounded-lg px-3 text-[0.85rem] text-slate hover:text-brand">
              Care team: set alert levels
            </button>
          ))}
      </div>
      {err && <p className="mt-2 text-sm text-alarm">{err}</p>}
    </section>
  );
}

/** The phone card: the member's own latest reading and a quick way to add one. */
export function PhoneGlucose({ userId, g, tamil, onSaved }: { userId: string; g: GlucoseSummary; tamil: boolean; onSaved: () => void }) {
  const t = (en: string, ta: string) => (tamil ? ta : en);
  const [mgdl, setMgdl] = useState("");
  const [kind, setKind] = useState<GlucoseKind>("fasting");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
    // simulated glucometer: in a real app the reading arrives over Bluetooth (the standard Glucose Service)
  const [meterStep, setMeterStep] = useState<null | "connect" | "strip" | "blood" | "measure">(null);
  const [count, setCount] = useState(5);
  const [demoValue, setDemoValue] = useState(58);

  const checkWithMeter = async () => {
    setErr(null);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      setMeterStep("connect");
      await wait(1800);
      setMeterStep("strip");
      await wait(1800);
      setMeterStep("blood");
      await wait(1800);
      setMeterStep("measure");
      for (let n = 5; n >= 1; n--) {
        setCount(n);
        await wait(700);
      }
      await api.addGlucose(userId, demoValue, kind, "meter");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setMeterStep(null);
    }
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.addGlucose(userId, Number(mgdl), kind);
      setMgdl("");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const b = g.latest ? BAND[g.latest.band] : null;
  const lang = tamil ? "Tamil" : "English";
  const note = g.latest
    ? render(g.latest.band === "low" ? "glucose_low_patient" : g.latest.band === "high" ? "glucose_high_patient" : "glucose_in_range_patient", lang, {
        mgdl: g.latest.mgdl,
        low: g.limits.low,
        high: g.limits.high,
      })
    : null;
  return (
    <div className="rounded-3xl bg-paper p-4">
      <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">{t("Blood sugar", "இரத்த சர்க்கரை")}</p>
      {g.latest && b && (
        <div className="mt-2 flex items-baseline justify-between">
          <p className="display num text-[1.8rem] font-extrabold">
            {g.latest.mgdl} <span className="text-[0.85rem] font-semibold text-slate">mg/dL</span>
          </p>
          <span className={`rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold ${b.chip}`}>{tamil ? b.ta : b.label}</span>
        </div>
      )}
      {g.latest && (
        <p className="text-[0.78rem] text-slate">
          {tamil ? KIND[g.latest.kind].ta : KIND[g.latest.kind].label} · {when(g.latest.at)}
          {g.latest.source !== "demo" && (
            <span className="font-semibold"> · {g.latest.source === "device" ? `📟 ${UI.meter_from[lang]}` : `⌨️ ${UI.meter_typed[lang]}`}</span>
          )}
        </p>
      )}
      {note && <p className={`mt-2 rounded-2xl px-3 py-2 text-[0.85rem] leading-snug ${g.latest?.band === "low" ? "bg-alarm-pale" : g.latest?.band === "high" ? "bg-amber-pale" : "bg-stride-pale"}`}>{note}</p>}
       {meterStep ? (
        <div className="mt-3 rounded-2xl border-2 border-brand bg-brand-soft px-4 py-5 text-center">
          <p className="text-[2rem]" aria-hidden>
            {meterStep === "connect" ? "📶" : meterStep === "strip" ? "🧪" : meterStep === "blood" ? "🩸" : "⏳"}
          </p>
          <p className="mt-1 font-bold">
            {meterStep === "connect"
              ? UI.meter_connecting[lang]
              : meterStep === "strip"
                ? UI.meter_strip[lang]
                : meterStep === "blood"
                  ? UI.meter_blood[lang]
                  : `${UI.meter_measuring[lang]} ${count}`}
          </p>
        </div>
      ) : (
        <>
          <button type="button" onClick={checkWithMeter} className="brand-gradient mt-3 w-full rounded-2xl py-3 text-[1.05rem] font-extrabold text-white">
            🩸 {UI.meter_check[lang]}
          </button>
          <label className="mt-1.5 flex items-center justify-center gap-1.5 text-[0.7rem] text-slate">
            Simulated meter (demo) reads
            <select value={demoValue} onChange={(e) => setDemoValue(Number(e.target.value))} className="rounded-md border border-rule bg-paper px-1 py-0.5">
              <option value={58}>58 (low)</option>
              <option value={112}>112 (in range)</option>
              <option value={285}>285 (high)</option>
            </select>
          </label>
        </>
      )}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(Object.keys(KIND) as GlucoseKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`min-w-0 rounded-xl border-2 px-1 py-1.5 text-center leading-tight ${tamil ? "text-[0.66rem]" : "text-[0.74rem]"} font-semibold ${kind === k ? "border-brand bg-brand-soft" : "border-rule bg-paper"}`}
          >
            {tamil ? KIND[k].ta : KIND[k].label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          placeholder="mg/dL"
          value={mgdl}
          onChange={(e) => setMgdl(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-rule bg-paper px-3 text-[1.05rem]"
        />
        <button type="button" onClick={save} disabled={!mgdl || busy} className="brand-gradient rounded-2xl px-4 font-bold text-white disabled:opacity-50">
          {t("Save", "சேமி")}
        </button>
      </div>
      {err && <p className="mt-2 text-[0.8rem] text-alarm">{err}</p>}
    </div>
  );
}