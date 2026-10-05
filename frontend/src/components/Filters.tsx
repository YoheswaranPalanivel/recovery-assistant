"use client";

import type { UserSummary } from "@shared/types";
import type { Filters as F } from "@/lib/api";
import { userLabel } from "@/lib/format";

type Props = {
  value: F;
  onChange: (f: F) => void;
  users: UserSummary[];
  range: { min: string | null; max: string | null };
};

const PRESETS = [7, 14, 30];

export function Filters({ value, onChange, users, range }: Props) {
  const set = (patch: Partial<F>) => onChange({ ...value, ...patch });
  const lastN = (n: number) => {
    if (!range.max) return;
    const d = new Date(`${range.max}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (n - 1));
    set({ from: d.toISOString().slice(0, 10), to: range.max });
  };
  const activePreset = PRESETS.find((n) => {
    if (!range.max || value.to !== range.max || !value.from) return false;
    const d = new Date(`${range.max}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (n - 1));
    return d.toISOString().slice(0, 10) === value.from;
  });
  const filtered = Boolean(value.userId || value.from || value.to);

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <label className="flex flex-col gap-1 text-sm text-slate">
        Person
        <select
          value={value.userId ?? ""}
          onChange={(e) => set({ userId: e.target.value || undefined })}
          className="h-10 min-w-48 rounded-md border border-rule bg-paper px-3 text-ink"
        >
          <option value="">Everyone ({users.length})</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {userLabel(u.userId)}, {Math.round(u.compliancePct)}% on target{u.openAlerts ? `, ${u.openAlerts} alert${u.openAlerts > 1 ? "s" : ""}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate">
        From
        <input
          type="date"
          value={value.from ?? ""}
          min={range.min ?? undefined}
          max={value.to ?? range.max ?? undefined}
          onChange={(e) => set({ from: e.target.value || undefined })}
          className="h-10 rounded-md border border-rule bg-paper px-3 text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate">
        To
        <input
          type="date"
          value={value.to ?? ""}
          min={value.from ?? range.min ?? undefined}
          max={range.max ?? undefined}
          onChange={(e) => set({ to: e.target.value || undefined })}
          className="h-10 rounded-md border border-rule bg-paper px-3 text-ink"
        />
      </label>

      <div className="flex h-10 items-center rounded-md border border-rule bg-paper p-0.5" role="group" aria-label="Quick ranges">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => lastN(n)}
            disabled={!range.max}
            aria-pressed={activePreset === n}
            className={`h-full rounded px-3 text-sm transition-colors ${
              activePreset === n ? "bg-brand text-white" : "text-slate hover:text-ink"
            }`}
          >
            Last {n} days
          </button>
        ))}
      </div>

      {filtered && (
        <button type="button" onClick={() => onChange({})} className="h-10 px-2 text-sm text-stride underline-offset-4 hover:underline">
          Show everything
        </button>
      )}
    </div>
  );
}
