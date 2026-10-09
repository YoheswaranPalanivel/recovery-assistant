"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CheckIn, MemberApp } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";

const DOT: Record<string, string> = { none: "#EEF3F2", low: "#E8892B", some: "#F7C978", good: "#7FD6C6", great: "#0E9F8E" };
const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const MOODS: { key: CheckIn["mood"]; emoji: string; label: string }[] = [
  { key: "good", emoji: "😊", label: "Good" },
  { key: "okay", emoji: "😐", label: "Okay" },
  { key: "not_well", emoji: "😟", label: "Not well" },
];

/**
 * What a member sees on their phone: their week, their health worker's message, and a 10-second check-in.
 * Demo: opened by staff to show the member's side; a real member app would have its own sign-in.
 */
export default function MemberPhone() {
  const { id } = useParams<{ id: string }>();
  const userId = decodeURIComponent(id);
  const { version } = useLive();
  const [d, setD] = useState<MemberApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<CheckIn["mood"] | null>(null);
  const [med, setMed] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.memberApp(userId).then(setD).catch((e) => setError(e.message));
  }, [userId, version]);

  const send = async () => {
    if (!mood) return;
    setSending(true);
    try {
      await api.checkIn({ userId, mood, medicineTaken: med });
      setD(await api.memberApp(userId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const tamil = d?.language === "Tamil";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#E3F6EF,#E4F0FA)] p-6">
      <div className="w-full max-w-[380px] overflow-hidden rounded-[2.5rem] border-[10px] border-ink bg-fog shadow-2xl">
        <div className="flex items-center justify-between bg-paper px-5 pb-2 pt-3 text-[0.72rem] font-semibold text-slate">
          <span>9:41</span>
          <span className="rounded-full bg-amber-pale px-2 py-0.5 text-amber">Demo: member&apos;s phone</span>
        </div>

        {error && <p className="p-5 text-sm text-alarm">{error}</p>}
        {!d && !error && <p className="p-5 text-slate">Loading…</p>}

        {d && (
          <div className="flex flex-col gap-3 p-4">
            <div className="brand-gradient rounded-3xl px-5 py-4 text-white">
              <p className="text-[0.85rem] opacity-80">{tamil ? "Vanakkam" : "Hello"},</p>
              <p className="display text-[1.6rem] font-extrabold leading-tight">{d.name}</p>
              <p className="mt-1 text-[0.85rem]">
                {d.streak > 0 ? `🔥 ${d.streak} active day${d.streak > 1 ? "s" : ""} in a row` : "Every small step counts this week"}
              </p>
            </div>

            <div className="rounded-3xl bg-paper p-4">
              <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">This week</p>
              <div className="mt-3 space-y-3">
                {d.goals
                  .filter((g) => g.key !== "steps")
                  .map((g) => {
                    const pct = g.value === null ? 0 : Math.min(100, (g.value / g.target) * 100);
                    return (
                      <div key={g.key}>
                        <div className="mb-1 flex justify-between text-[0.88rem]">
                          <span>{g.label}</span>
                          <b className="num">{g.value === null ? "—" : `${g.value} / ${g.target}${g.unit === "h" ? " h" : ""}`}</b>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF3F2]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#0E9F8E" : pct >= 60 ? "#7FD6C6" : "#F2A93B" }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-3 flex justify-between">
                {d.week.map((w) => (
                  <span key={w.date} className="flex h-8 w-8 items-center justify-center rounded-lg text-[0.7rem] font-bold text-ink/60" style={{ background: DOT[w.level] }}>
                    {DAY[new Date(`${w.date}T00:00:00Z`).getUTCDay()]}
                  </span>
                ))}
              </div>
            </div>

            {d.message && (
              <div className="rounded-3xl bg-paper p-4">
                <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">From your health worker</p>
                <p className="mt-2 text-[0.95rem] leading-snug">“{d.message.text}”</p>
              </div>
            )}

            <div className="rounded-3xl bg-paper p-4">
              <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-slate">Today&apos;s check-in</p>
              {d.todayCheckIn ? (
                <p className="mt-2 text-[0.95rem]">
                  ✓ Thanks! You said you&apos;re{" "}
                  <b>{d.todayCheckIn.mood === "good" ? "feeling good 😊" : d.todayCheckIn.mood === "okay" ? "okay 😐" : "not feeling well 😟"}</b>
                  {d.todayCheckIn.mood === "not_well" ? ". Your health worker will contact you." : "."}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[0.95rem]">How are you feeling today?</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {MOODS.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMood(m.key)}
                        className={`flex flex-col items-center rounded-2xl border-2 py-2 text-[0.8rem] font-semibold ${mood === m.key ? "border-brand bg-brand-soft" : "border-rule bg-paper"}`}
                      >
                        <span className="text-[1.6rem]">{m.emoji}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[0.95rem]">Did you take your medicine today?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { v: true, l: "Yes" },
                      { v: false, l: "Not yet" },
                    ].map((o) => (
                      <button
                        key={o.l}
                        type="button"
                        onClick={() => setMed(o.v)}
                        className={`rounded-2xl border-2 py-2 text-[0.88rem] font-semibold ${med === o.v ? "border-brand bg-brand-soft" : "border-rule bg-paper"}`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={send}
                    disabled={!mood || sending}
                    className="brand-gradient mt-4 w-full rounded-2xl py-3 font-bold text-white disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </>
              )}
            </div>
            <p className="px-2 pb-2 text-center text-[0.72rem] text-slate">Your health worker sees your check-in. This app never gives medical advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}