"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActionKind, CarePlan, MemberAction, MemberStatus, MemberWeek } from "@shared/types";
import { api } from "@/lib/api";
import { IconSparkle } from "./icons";

export const STATUS: Record<MemberStatus, { label: string; badge: string; avatar: string }> = {
  needs_support: { label: "Needs support", badge: "bg-alarm-pale text-alarm", avatar: "#C2410C" },
  slipping: { label: "Slipping", badge: "bg-amber-pale text-amber", avatar: "#B7791F" },
  check_device: { label: "Check device", badge: "bg-fog text-slate", avatar: "#64748B" },
  needs_rest: { label: "Needs rest", badge: "bg-[#E0F2FE] text-[#0369A1]", avatar: "#0369A1" },
  on_track: { label: "On track", badge: "bg-stride-pale text-stride-deep", avatar: "#0F766E" },
};

const DOT: Record<string, string> = { none: "#EEF3F2", low: "#E8892B", some: "#F7C978", good: "#7FD6C6", great: "#0E9F8E" };
const DAY = ["S", "M", "T", "W", "T", "F", "S"];

const KIND: Record<ActionKind, string> = { call: "Called", visit: "Visited", plan_sent: "Plan sent", device_check: "Watch checked" };
const FOLLOW = [
  { label: "No follow-up", days: null },
  { label: "Follow up tomorrow", days: 1 },
  { label: "Follow up in 3 days", days: 3 },
  { label: "Follow up next week", days: 7 },
] as const;

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Did it help?": steps in the 3 days after contact vs the 3 days before. */
function OutcomeLine({ a }: { a: MemberAction }) {
  const o = a.outcome;
  const tone = o.status === "more_active" ? "bg-stride-pale text-stride-deep" : o.status === "no_change" ? "bg-amber-pale text-amber" : "bg-fog text-slate";
  const text =
    o.status === "waiting"
      ? "Waiting for the next days of data"
      : `${o.status === "more_active" ? "More active since contact" : "No change yet"}: ${o.beforeSteps?.toLocaleString("en-IN")} → ${o.afterSteps?.toLocaleString("en-IN")} daily steps${o.changePct !== null ? ` (${o.changePct > 0 ? "+" : ""}${o.changePct}%)` : ""}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.82rem]">
      <span className="rounded-lg bg-fog px-2.5 py-1">
        ✓ {KIND[a.kind]} {new Date(a.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        {a.followUp ? ` · follow up ${fmtDate(a.followUp)}` : ""}
      </span>
      <span className={`rounded-lg px-2.5 py-1 font-semibold ${tone}`}>{text}</span>
    </div>
  );
}

export function MemberCard({ m, onChanged }: { m: MemberWeek; onChanged?: () => void }) {
  const s = STATUS[m.status];
  const p = m.profile;
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<CarePlan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [follow, setFollow] = useState<number | null>(3);
  const [saving, setSaving] = useState<ActionKind | null>(null);

  const act = async (kind: ActionKind) => {
    setSaving(kind);
    setErr(null);
    try {
      await api.recordAction({ userId: p.userId, kind, note: kind === "plan_sent" && plan ? plan.message : "", followUpDays: follow });
      onChanged?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const suggest = async () => {
    setBusy(true);
    setErr(null);
    try {
      setPlan(await api.plan(p.userId));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card grid gap-5 p-5 md:grid-cols-[1fr_240px]">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: s.avatar }}>
            {p.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="display text-[1.15rem] font-extrabold">
                    <Link href={`/members/${encodeURIComponent(p.userId)}`} className="hover:text-brand hover:underline">
                      {p.name}
                    </Link>
                  </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ${s.badge}`}>● {s.label}</span>
            </div>
            <p className="mt-0.5 text-[0.84rem] text-slate">
              {p.ageBand} · {p.condition}
              {p.mobility === "limited" ? " · limited mobility" : ""} · prefers {p.prefers} · {p.language}
            </p>
          </div>
        </div>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {m.reasons.map((r) => (
            <li key={r} className="rounded-lg bg-fog px-2.5 py-1 text-[0.82rem]">
              {r}
            </li>
          ))}
        </ul>

        {m.checkIn && (
          <p className={`mt-2 inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[0.82rem] font-semibold ${m.checkIn.mood === "not_well" ? "bg-alarm-pale text-alarm" : "bg-stride-pale text-stride-deep"}`}>
            📱 Check-in {new Date(m.checkIn.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}:{" "}
            {m.checkIn.mood === "good" ? "😊 feeling good" : m.checkIn.mood === "okay" ? "😐 okay" : "😟 not feeling well"}
            {m.checkIn.medicineTaken === false ? " · missed medicine" : m.checkIn.medicineTaken ? " · medicine taken" : ""}
          </p>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-slate">
          <span className="mr-1">Last 7 days</span>
          {m.week.map((d) => (
            <span
              key={d.date}
              title={`${d.date}: ${d.level === "none" ? "no data" : d.level}`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[0.62rem] font-bold text-ink/60"
              style={{ background: DOT[d.level] }}
            >
              {DAY[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}
            </span>
          ))}
        </div>

        {m.status === "check_device" ? (
          <p className="mt-3 rounded-xl bg-fog px-3.5 py-2.5 text-[0.88rem]">
            Suggested action: call to check the watch is worn, charged and syncing. No health message is sent without data.
          </p>
        ) : plan ? (
          <div className="mt-3 rounded-xl bg-[linear-gradient(135deg,#E3F6EF,#E4F0FA)] px-4 py-3 text-[0.9rem]">
            <p className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-bold text-brand">
              <IconSparkle className="h-3.5 w-3.5" />
              This week&apos;s plan ·{" "}
              {plan.source === "llm" ? `AI, checked by the app${plan.check.attempts > 1 ? ` (attempt ${plan.check.attempts})` : ""}` : "safe template"}
            </p>
            <ul className="space-y-1">
              {plan.actions.map((a) => (
                <li key={a.activity} className="flex flex-wrap items-baseline gap-x-2">
                  <b>{a.label}</b>
                  <span className="num">{a.minutes} min</span>
                  <span className="text-slate">
                    {a.days.join(" ")} · {a.when}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[0.78rem] text-slate">{plan.totalMinutes} minutes in total, within their personal limit</p>
             <p className="mt-2.5 border-t border-white/70 pt-2.5" lang={plan.language === "Tamil" ? "ta" : "en"}>
              “{plan.message}”
            </p>
            {plan.language === "Tamil" && plan.messageEnglish && (
              <p className="mt-1 text-[0.8rem] text-slate">
                <span className="mr-1 rounded bg-white/70 px-1.5 py-0.5 text-[0.7rem] font-bold">Tamil</span>
                In English: {plan.messageEnglish}
              </p>
            )}
            {plan.workerNote && <p className="mt-1.5 text-[0.8rem] text-slate">For you: {plan.workerNote}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={suggest}
            disabled={busy}
            className="brand-gradient mt-3 flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-bold text-white disabled:opacity-60"
          >
            {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <IconSparkle className="h-4 w-4" />}
            {busy ? "Planning…" : "Suggest a weekly plan"}
          </button>
        )}
        {m.lastAction && <OutcomeLine a={m.lastAction} />}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(m.status === "check_device" ? (["device_check", "call"] as ActionKind[]) : (["call", "visit", ...(plan ? (["plan_sent"] as ActionKind[]) : [])] as ActionKind[])).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => act(k)}
              disabled={saving !== null}
              className={`rounded-lg border px-3 py-1.5 text-[0.82rem] font-semibold transition-colors disabled:opacity-60 ${
                k === "plan_sent" ? "border-brand bg-brand text-white hover:brightness-110" : "border-rule bg-paper hover:border-brand hover:text-brand"
              }`}
            >
              {saving === k ? "Saving…" : k === "plan_sent" ? "✓ Mark plan as sent" : `✓ ${KIND[k]}`}
            </button>
          ))}
          <select
            aria-label="Follow-up"
            value={follow ?? ""}
            onChange={(e) => setFollow(e.target.value === "" ? null : Number(e.target.value))}
            className="rounded-lg border border-rule bg-paper px-2 py-1.5 text-[0.82rem] text-slate"
          >
            {FOLLOW.map((f) => (
              <option key={f.label} value={f.days ?? ""}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        {err && <p className="mt-2 text-sm text-alarm">{err}</p>}
      </div>

      <dl className="flex flex-col gap-3 border-rule md:border-l md:pl-5">
        {m.goals.map((g) => {
          const pct = g.value === null ? 0 : Math.min(100, (g.value / g.target) * 100);
          const color = g.value === null ? "#EEF3F2" : pct >= 100 ? "#0E9F8E" : pct >= 70 ? "#7FD6C6" : pct >= 40 ? "#F2A93B" : "#E8892B";
          return (
            <div key={g.key} className="text-[0.82rem]">
              <div className="mb-1 flex justify-between gap-2">
                <dt className="text-slate">{g.label}</dt>
                <dd className="num font-bold">
                  {g.value === null ? "No data" : `${g.value.toLocaleString("en-IN")} / ${g.target.toLocaleString("en-IN")}${g.unit === "h" ? " h" : ""}`}
                </dd>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#EEF3F2]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
        <p className="mt-auto text-[0.75rem] text-slate">Goals are personal: built gradually from their usual level.</p>
      </dl>
    </article>
  );
}