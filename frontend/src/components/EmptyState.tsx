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
        <h1 className="display text-[2.6rem] font-bold leading-[1.05]">No activity data yet</h1>
        <p className="mt-3 max-w-[52ch] text-slate">
          Load a dataset to see who is meeting their step target, where activity or sleep has dropped, and to write an insight for any person.
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
      <div className="text-sm">
        <p className="font-bold">What “Load the dataset” does</p>
        <p className="mt-2 text-slate">
          It reads the Fitbit files in backend/data/fitbit, or the synthetic test files in backend/data/sample if the real ones aren’t there,
          and runs them through the same checks as an upload.
        </p>
        <p className="mt-5 font-bold">Or stream it live, one day at a time</p>
        <code className="mt-2 block rounded bg-fog px-2 py-1.5 text-ink">npm run replay -- --reset --shift-to-today</code>
        <p className="mt-1 text-slate">Run in the backend folder. This page fills in by itself.</p>
      </div>
    </section>
  );
}
