"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function EmptyState({ onLoaded }: { onLoaded: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.loadDemo();
      onLoaded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 grid gap-10 card p-8 md:grid-cols-[1.1fr_1fr] md:p-12">
      <div>
        <h1 className="display text-[2.6rem] font-bold leading-[1.05]">No member data yet</h1>
        <p className="mt-3 max-w-[52ch] text-slate">
          Load the programme&apos;s activity and sleep data to see who needs your help today, why, and what to suggest for their week.
        </p>
        {isAdmin ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={load} disabled={busy} className="h-11 rounded-md brand-gradient px-5 font-bold text-white hover:brightness-110 disabled:opacity-60">
              {busy ? "Loading…" : "Load the dataset"}
            </button>
            <Link href="/data" className="inline-flex h-11 items-center rounded-md border border-rule px-5 hover:border-ink/40">
              Upload files instead
            </Link>
          </div>
        ) : (
          <p className="mt-6 rounded-md bg-fog px-4 py-3 text-sm">An admin needs to load a dataset first. You are signed in as an analyst.</p>
        )}
        {error && <p className="mt-3 text-sm text-alarm">{error}</p>}
      </div>
      <div>
        <p className="text-[0.8rem] font-bold uppercase tracking-[0.1em] text-slate">What happens next</p>
        <ol className="mt-3 space-y-3">
          {[
            ["Checked and protected", "Every row is validated, and member ids are replaced with codes before anything is stored."],
            ["Who needs you today", "Each member gets a personal goal and a status with reasons, and the Today list puts the most urgent first."],
            ["Plan and follow up", "Suggest a safe weekly plan, record your call or visit, and see whether it helped."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.85rem] font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-bold">{t}</p>
                <p className="text-[0.9rem] text-slate">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-[0.8rem] text-slate">Activity and sleep are real Fitbit data; member profiles are demo data.</p>
      </div>
    </section>
  );
}