"use client";

import { useEffect, useRef, useState } from "react";
import type { IngestionBatch, IngestionStatus, PipelineStatus } from "@shared/types";
import { api } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useAuth } from "@/lib/auth";
import { int, longDate, timeAgo } from "@/lib/format";
import { IconDatabase, IconFlow, IconUsers } from "@/components/icons";

export default function DataPage() {
  const { version } = useLive();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<IngestionBatch[] | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.ingestion().then(setStatus).catch((e) => setError(e.message));
  }, [version]);

  const pick = (list: FileList | null) => {
    if (!list) return;
    const ok = [...list].filter((f) => /\.(csv|xlsx|xls)$/i.test(f.name));
    setError(ok.length < list.length ? "Some files were skipped: only .csv, .xlsx and .xls are accepted." : null);
    setFiles(ok.slice(0, 5));
  };

  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.upload(files);
      setLastUpload(r.batches);
      setFiles([]);
      setStatus(await api.ingestion());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm("Remove all loaded data, alerts and messages from the server?")) return;
    await api.reset();
    setLastUpload(null);
    setStatus(await api.ingestion());
  };

  const t = status?.totals;

  return (
    <div className="flex flex-col gap-5 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[2.4rem] font-bold leading-none sm:text-[2.9rem]">Data and ingestion</h1>
          <p className="mt-2 max-w-[66ch] text-slate">
            Upload daily activity and sleep files, or stream them in. Every row is checked; rows that can't be trusted are set aside with a reason
            instead of being counted.
          </p>
        </div>
        {isAdmin && t && t.rows > 0 && (
          <button type="button" onClick={reset} className="h-10 rounded-md border border-rule bg-paper px-4 text-sm text-alarm hover:bg-alarm-pale">
            Clear all data
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* upload */}
        {!isAdmin ? (
          <section className="card p-5">
            <h2 className="display text-[1.35rem] font-bold">Upload files</h2>
            <p className="mt-2 max-w-[56ch] text-slate">
              Only admins can add or clear data. You are signed in as an analyst, so you can review what was received and why rows were rejected.
            </p>
          </section>
        ) : (
        <section className="card p-5">
          <h2 className="display text-[1.35rem] font-bold">Upload files</h2>
          <p className="mt-0.5 text-sm text-slate">CSV or Excel, up to 5 files. Upload a sleep file together with its activity file and they are joined by person and day.</p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files);
            }}
            className={`mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
              drag ? "border-stride bg-stride-pale/40" : "border-rule bg-fog/50"
            }`}
          >
            <p className="font-bold">Drop files here</p>
            <p className="mt-1 text-sm text-slate">e.g. dailyActivity_merged.csv and sleepDay_merged.csv</p>
            <button type="button" onClick={() => input.current?.click()} className="mt-4 h-10 rounded-md border border-ink/20 bg-paper px-4 text-sm hover:border-ink/50">
              Choose files
            </button>
            <input ref={input} type="file" multiple accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </div>

          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <ul className="text-sm">
                {files.map((f) => (
                  <li key={f.name} className="num">
                    {f.name} <span className="text-slate">({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={upload} disabled={busy} className="h-10 rounded-md brand-gradient px-5 font-bold text-white hover:brightness-110 disabled:opacity-60">
                {busy ? "Checking rows…" : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
              </button>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-alarm">{error}</p>}

          {lastUpload && (
            <div className="mt-5 space-y-4 border-t border-rule pt-5">
              {lastUpload.map((b) => (
                <BatchReport key={b.id} b={b} />
              ))}
            </div>
          )}
        </section>
        )}

        <DataHealth status={status} />
      </div>

      {/* totals */}
      {t && (
        <section aria-label="Totals" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule md:grid-cols-4">
          {(
            [
              ["Rows received", t.rows, ""],
              ["Accepted", t.accepted, "text-stride"],
              ["Rejected", t.rejected, t.rejected ? "text-alarm" : ""],
              ["Duplicates skipped", t.duplicates, ""],
            ] as const
          ).map(([label, v, cls]) => (
            <div key={label} className="bg-paper px-5 py-4">
              <div className="text-sm text-slate">{label}</div>
              <div className={`display num text-[2.2rem] font-semibold leading-tight ${cls}`}>{int(v)}</div>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="display border-b border-rule px-5 py-4 text-[1.35rem] font-bold">Batches</h2>
          {!status?.batches.length ? (
            <p className="px-5 py-6 text-sm text-slate">Nothing received yet.</p>
          ) : (
            <div className="max-h-[460px] overflow-auto">
              <table className="num w-full text-left text-sm">
                <thead className="sticky top-0 bg-paper text-slate">
                  <tr className="border-b border-rule">
                    <th className="px-5 py-2 font-normal">Source</th>
                    <th className="px-3 py-2 text-right font-normal">Rows</th>
                    <th className="px-3 py-2 text-right font-normal">Accepted</th>
                    <th className="px-3 py-2 text-right font-normal">Rejected</th>
                    <th className="px-5 py-2 text-right font-normal">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {status.batches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-5 py-2">
                        <span className={`mr-2 inline-block rounded px-1.5 text-[0.72rem] ${b.source === "stream" ? "bg-stride-pale text-stride-deep" : "bg-fog text-slate"}`}>
                          {b.source === "stream" ? "Live" : "Upload"}
                        </span>
                        {b.fileName}
                      </td>
                      <td className="px-3 py-2 text-right">{int(b.totalRows)}</td>
                      <td className="px-3 py-2 text-right">{int(b.accepted)}</td>
                      <td className={`px-3 py-2 text-right ${b.rejected ? "text-alarm" : ""}`}>{int(b.rejected)}</td>
                      <td className="whitespace-nowrap px-5 py-2 text-right text-slate">{timeAgo(b.receivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="display border-b border-rule px-5 py-4 text-[1.35rem] font-bold">Rejected rows</h2>
          {status && status.rejectionReasons.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-b border-rule px-5 py-3 text-sm" aria-label="Rejections by reason">
              {status.rejectionReasons.map((r) => (
                <li key={r.reason} className="rounded-md bg-alarm-pale px-2.5 py-1 text-ink">
                  <span className="num font-bold text-alarm">{int(r.count)}</span> {r.reason}
                </li>
              ))}
            </ul>
          )}
          {!status?.recentRejections.length ? (
            <p className="px-5 py-6 text-sm text-slate">No rows rejected so far.</p>
          ) : (
            <div className="max-h-[460px] overflow-auto">
              <table className="num w-full text-left text-sm">
                <thead className="sticky top-0 bg-paper text-slate">
                  <tr className="border-b border-rule">
                    <th className="px-5 py-2 font-normal">File</th>
                    <th className="px-3 py-2 text-right font-normal">Row</th>
                    <th className="px-5 py-2 font-normal">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {status.recentRejections.map((r, i) => (
                    <tr key={`${r.source}-${r.rowNumber}-${i}`}>
                      <td className="max-w-[180px] truncate px-5 py-2 text-slate" title={r.source}>
                        {r.source}
                      </td>
                      <td className="px-3 py-2 text-right">{r.rowNumber}</td>
                      <td className="px-5 py-2">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BatchReport({ b }: { b: IngestionBatch }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold">{b.fileName}</span>
        <span className="text-sm text-slate">Detected: {b.detectedFormat}</span>
      </div>
      <p className="num mt-1 text-sm">
        {int(b.totalRows)} rows: <span className="text-stride">{int(b.accepted)} accepted</span>,{" "}
        <span className={b.rejected ? "text-alarm" : ""}>{int(b.rejected)} rejected</span>, {int(b.duplicates)} duplicates skipped
      </p>
      <table className="mt-3 w-full text-left text-[0.85rem]">
        <thead className="text-slate">
          <tr className="border-b border-rule">
            <th className="py-1 pr-4 font-normal">App field</th>
            <th className="py-1 font-normal">Taken from column</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(b.mappedFields).map(([k, v]) => (
            <tr key={k} className="border-b border-rule/60">
              <td className="py-1 pr-4">{k}</td>
              <td className="py-1">
                <code className="text-ink-soft">{v}</code>
              </td>
            </tr>
          ))}
          {b.unavailableFields.map((k) => (
            <tr key={k} className="border-b border-rule/60 text-slate">
              <td className="py-1 pr-4">{k}</td>
              <td className="py-1 italic">Not in this file, shown as unavailable</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A live picture of the data's health: how much was trusted, what was loaded, and recent batches. */
function DataHealth({ status }: { status: IngestionStatus | null }) {
  const { version, connected } = useLive();
  const [p, setP] = useState<PipelineStatus | null>(null);

  useEffect(() => {
    api.pipeline().then(setP).catch(() => setP(null));
  }, [version]);

  const t = status?.totals;
  const pct = t && t.rows ? Math.round((t.accepted / t.rows) * 100) : 0;
  const batches = status?.batches ?? [];
  const lastStream = batches.find((b) => b.source === "stream");
  const streaming = Boolean(lastStream && Date.now() - Date.parse(lastStream.receivedAt) < 30_000);
  const uploads = batches.filter((b) => b.source === "upload");
  const source =
    (uploads.find((b) => !/sleep/i.test(b.detectedFormat)) ?? uploads[0])?.detectedFormat.replace(/ export$/, " data") ??
    (lastStream ? "Live device feed" : "No data yet");
  // last 20 batches, oldest first
  const recent = batches.slice(0, 20).reverse();
  const maxRows = Math.max(1, ...recent.map((b) => b.totalRows));

  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <section className="card relative overflow-hidden p-5" aria-labelledby="health-title">
      <div className="brand-gradient pointer-events-none absolute inset-x-0 top-0 h-1" aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <h2 id="health-title" className="display text-[1.35rem] font-bold">
          Data health
        </h2>
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-[0.78rem] font-bold ${
            streaming ? "bg-stride-pale text-stride-deep" : "bg-fog text-slate"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${streaming ? "pulse bg-stride" : connected ? "bg-slate/50" : "bg-alarm"}`} />
          {streaming ? "Live feed receiving" : connected ? "Live feed idle" : "Offline"}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-5">
        {/* share of received rows that passed every check */}
        <div className="relative shrink-0" role="img" aria-label={`${pct}% of rows accepted`}>
          <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden>
            <defs>
              <linearGradient id="health-g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#059669" />
                <stop offset="1" stopColor="#0369A1" />
              </linearGradient>
            </defs>
            <circle cx="52" cy="52" r={r} fill="none" stroke="#E5EFEC" strokeWidth="10" />
            <circle
              cx="52"
              cy="52"
              r={r}
              fill="none"
              stroke="url(#health-g)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * c} ${c}`}
              transform="rotate(-90 52 52)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="display num text-[1.5rem] font-extrabold leading-none">{pct}%</span>
            <span className="text-[0.68rem] text-slate">rows trusted</span>
          </div>
        </div>

        <dl className="grid min-w-0 flex-1 gap-2.5 text-sm">
          <HealthRow icon={<IconDatabase className="h-4 w-4" />} label="Source" value={source} />
          <HealthRow icon={<IconUsers className="h-4 w-4" />} label="People" value={p ? `${int(p.users)}, pseudonymised` : "—"} />
          <HealthRow
            icon={<IconFlow className="h-4 w-4" />}
            label="Covers"
            value={p?.dateRange.min ? `${longDate(p.dateRange.min)} to ${longDate(p.dateRange.max)}` : "—"}
          />
        </dl>
      </div>

      {/* one bar per batch: height = rows received */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between text-[0.78rem] text-slate">
          <span>Recent batches</span>
          <span>{batches[0] ? `last one ${timeAgo(batches[0].receivedAt)}` : "none yet"}</span>
        </div>
        <div className="mt-2 flex h-14 items-end gap-1.5 rounded-xl bg-fog/70 px-2.5 pb-1.5 pt-2" aria-hidden>
          {recent.length === 0 ? (
            <span className="m-auto text-[0.78rem] text-slate">Upload a file or start the live feed</span>
          ) : (
            recent.map((b) => (
              <span
                key={b.id}
                title={`${b.fileName}: ${b.accepted} accepted, ${b.rejected} rejected`}
                className="max-w-[22px] flex-1 rounded-t-[4px]"
                style={{
                  height: `${Math.max(14, (b.totalRows / maxRows) * 100)}%`,
                  background: b.source === "stream" ? "#0369A1" : "#059669",
                }}
              />
            ))
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-slate">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#059669]" /> File upload
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#0369A1]" /> Live feed (API key)
          </span>
        </div>
      </div>
    </section>
  );
}

function HealthRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[0.75rem] text-slate">{label}</dt>
        <dd className="truncate font-semibold" title={value}>
          {value}
        </dd>
      </div>
    </div>
  );
}