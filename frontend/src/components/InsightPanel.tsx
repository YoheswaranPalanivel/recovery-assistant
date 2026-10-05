"use client";

import { useEffect, useState } from "react";
import type { Insight, LlmContext, MessageType } from "@shared/types";
import { api, type Filters } from "@/lib/api";
import { timeAgo, userLabel } from "@/lib/format";
import { IconBell, IconSparkle } from "./icons";

const TYPES: { value: MessageType | ""; label: string }[] = [
  { value: "", label: "Let the rules decide" },
  { value: "reminder", label: "Reminder" },
  { value: "encouragement", label: "Encouragement" },
  { value: "progress_update", label: "Progress update" },
  { value: "attention_alert", label: "Attention alert" },
  { value: "general_insight", label: "General insight" },
];
const typeLabel = (t: MessageType) => TYPES.find((x) => x.value === t)?.label ?? t;

type Props = { filters: Filters; dataVersion: number; llmModel: string | null };

export function InsightPanel({ filters, dataVersion, llmModel }: Props) {
  const { userId, from, to } = filters;
  const [ctx, setCtx] = useState<LlmContext | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [type, setType] = useState<MessageType | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Insight | null>(null);
  const [history, setHistory] = useState<Insight[]>([]);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    setResult(null);
    setError(null);
    if (!userId) {
      setCtx(null);
      return;
    }
    api
      .context({ userId, from, to })
      .then((c) => {
        setCtx(c);
        setCtxError(null);
      })
      .catch((e) => {
        setCtx(null);
        setCtxError(e.message);
      });
    api.insights(userId).then(setHistory).catch(() => setHistory([]));
  }, [userId, from, to, dataVersion]);

  const generate = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.generate({ userId, from, to, messageType: type || undefined });
      setResult(r);
      setCtx(r.context);
      setHistory((h) => [r, ...h].slice(0, 20));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="ai-title" className="card relative overflow-hidden">
      <div className="brand-gradient pointer-events-none absolute inset-x-0 top-0 h-1" aria-hidden />
      <div className="soft-gradient border-b border-rule px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ai-title" className="display flex items-center gap-3 text-[1.5rem] font-extrabold">
            <span className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_8px_20px_-8px_rgba(4,120,87,0.6)]">
              <IconSparkle className="h-5 w-5" />
            </span>
            AI message writer
          </h2>
          <span className="rounded-full border border-brand/20 bg-paper px-3 py-1 text-[0.8rem] font-semibold text-brand">
            {llmModel ? `Model: ${llmModel}` : "Template mode, no API key"}
          </span>
        </div>
        <p className="mt-2 max-w-[70ch] text-[0.95rem] text-slate">
          Step 1: the app works out the numbers. Step 2: only that short summary goes to the AI, which writes the words. Step 3: the app checks
          the AI did not change or add any number.
        </p>
      </div>

      {!userId ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <IconSparkle className="h-6 w-6" />
          </span>
          <p className="display mt-4 text-[1.2rem] font-bold">Pick a person first</p>
          <p className="mt-1 max-w-[46ch] text-slate">Click a row in the step goal chart, choose a person in the filter, or click “Focus” on an alert.</p>
        </div>
      ) : ctxError ? (
        <p className="px-6 py-8 text-sm text-alarm">{ctxError}</p>
      ) : (
        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <StepLabel n={1} text="What the AI receives" />
            {ctx && <ContextSummary ctx={ctx} userId={userId} showJson={showJson} onToggle={() => setShowJson((s) => !s)} />}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <StepLabel n={2} text="What the AI wrote" />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate">
                Message type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MessageType | "")}
                  className="h-11 rounded-xl border border-rule bg-paper px-3 font-normal text-ink"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.value === "" && ctx ? `Let the rules decide (${typeLabel(ctx.message_type)})` : t.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={generate}
                disabled={busy || !ctx}
                className="brand-gradient flex h-11 items-center gap-2 rounded-xl px-5 font-bold text-white shadow-[0_10px_24px_-10px_rgba(4,120,87,0.65)] transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <IconSparkle className="h-4 w-4" />}
                {busy ? "Writing…" : result ? "Write again" : "Write insight"}
              </button>
            </div>

            {error && <p className="text-sm text-alarm">{error}</p>}
            {result ? (
              <Result r={result} />
            ) : (
              <p className="rounded-2xl border border-dashed border-rule px-5 py-8 text-center text-slate">
                Click “Write insight” to see the message the AI writes from the summary on the left.
              </p>
            )}

            {history.length > (result ? 1 : 0) && (
              <details className="text-sm text-slate">
                <summary className="cursor-pointer select-none font-semibold">Earlier messages for {userLabel(userId)}</summary>
                <ul className="mt-3 space-y-3">
                  {history
                    .filter((h) => h.id !== result?.id)
                    .slice(0, 5)
                    .map((h) => (
                      <li key={h.id} className="border-l-2 border-brand/30 pl-3">
                        <span className="text-[0.78rem]">
                          {typeLabel(h.context.message_type)}, {timeAgo(h.createdAt)}
                        </span>
                        <p className="text-ink">{h.message}</p>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-[0.82rem] font-bold uppercase tracking-[0.08em] text-slate">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-[0.75rem] text-brand">{n}</span>
      {text}
    </p>
  );
}

function ContextSummary({ ctx, userId, showJson, onToggle }: { ctx: LlmContext; userId: string; showJson: boolean; onToggle: () => void }) {
  const facts: [string, string][] = [
    ["Average steps", `${ctx.avg_steps.toLocaleString("en-IN")} of ${ctx.target_steps.toLocaleString("en-IN")}`],
    ["Days goal reached", `${ctx.compliance_pct}%${ctx.previous_compliance_pct !== null ? ` (was ${ctx.previous_compliance_pct}%)` : ""}`],
    ["Trend", ctx.trend],
    ["Sleep", ctx.avg_sleep_hours === null ? "not available" : `${ctx.avg_sleep_hours} h`],
  ];
  return (
    <div className="rounded-2xl border border-rule bg-fog/60">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-3 text-sm">
        <span>
          For <b className="text-brand">{userLabel(userId)}</b>, {ctx.days_tracked} days tracked
        </span>
        <button type="button" onClick={onToggle} className="text-[0.82rem] font-semibold text-brand underline-offset-2 hover:underline">
          {showJson ? "Show as cards" : "Show exact JSON"}
        </button>
      </div>
      {showJson ? (
        <pre className="num max-h-72 overflow-auto rounded-b-2xl bg-ink-deep px-4 py-3 text-[0.8rem] leading-relaxed text-[#A7F3D0]">{JSON.stringify(ctx, null, 2)}</pre>
      ) : (
        <div className="p-4">
          <dl className="grid grid-cols-2 gap-3">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-paper px-3.5 py-3">
                <dt className="text-[0.78rem] text-slate">{k}</dt>
                <dd className="num mt-0.5 font-bold">{v.charAt(0).toUpperCase() + v.slice(1)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 rounded-xl bg-paper px-3.5 py-3">
            <p className="text-[0.78rem] text-slate">Alerts</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ctx.alerts.length ? (
                ctx.alerts.map((a) => (
                  <span key={a} className="rounded-full bg-alarm-pale px-2.5 py-0.5 text-[0.8rem] font-semibold text-alarm">
                    {a}
                  </span>
                ))
              ) : (
                <span className="font-bold">none</span>
              )}
            </div>
          </div>
          <p className="mt-3 text-[0.8rem] text-slate">No name, no ID and no daily rows are sent. Period: {ctx.period}.</p>
        </div>
      )}
    </div>
  );
}

function Result({ r }: { r: Insight }) {
  const rejected = r.guard.unknownNumbers.length > 0;
  const blocked = r.guard.blockedWords ?? [];
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <p className="max-w-[64ch] text-[1.02rem] leading-relaxed">{r.insight}</p>

      {/* the engagement message, shown the way it would arrive on a phone */}
      <div className="flex max-w-md gap-3 rounded-2xl border border-rule bg-paper px-4 py-3 shadow-[0_16px_36px_-22px_rgba(12,74,110,0.45)]">
        <span className="brand-gradient mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
          <IconBell className="h-[18px] w-[18px]" />
        </span>
        <div>
          <div className="flex items-baseline justify-between gap-3 text-[0.75rem] text-slate">
            <span className="font-bold text-ink">Recovery.AI</span>
            <span>{typeLabel(r.context.message_type)}</span>
          </div>
          <p className="mt-0.5 leading-snug">{r.message}</p>
        </div>
      </div>

         <p
        className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[0.85rem] ${
          r.source === "llm" ? "bg-stride-pale text-stride-deep" : rejected || blocked.length ? "bg-alarm-pale text-alarm" : "bg-fog text-slate"
        }`}
      >
        {r.source === "llm" ? (
          <>
            <b>✓</b>
            <span>
              Step 3 passed: written by {r.model}, every number matches the summary and no blocked words were used
              {r.guard.attempts > 1 ? ` (accepted on attempt ${r.guard.attempts})` : ""}.
            </span>
          </>
        ) : rejected ? (
          <>
            <b>✕</b>
            <span>
              The AI used numbers that were not in the summary ({r.guard.unknownNumbers.join(", ")}), so the app showed its own template message
              instead.
            </span>
          </>
        ) : blocked.length ? (
          <>
            <b>✕</b>
            <span>
              The AI used words it is not allowed to ({blocked.join(", ")}), so the app showed its own template message instead.
            </span>
          </>
        ) : (
          <span>Template message built directly from the summary. Add an LLM_API_KEY to backend/.env to have the AI write it.</span>
        )}
      </p>
    </div>
  );
}
