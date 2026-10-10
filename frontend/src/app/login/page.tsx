"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Mark } from "@/components/Sidebar";
import {
  IconBell,
  IconEye,
  IconEyeOff,
  IconLock,
  IconShield,
  IconSparkle,
  IconSteps,
  IconTarget,
  IconUser,
  IconUsers,
} from "@/components/icons";

// Everything in the preview is an illustration, not real data.
const HEAT = [
  [1, 2, 2, 3, 1, 2, 3, 3, 4],
  [3, 3, 4, 3, 4, 4, 3, 4, 4],
  [0, 1, 1, 0, 2, 1, 1, 0, 1],
  [2, 3, 3, 4, 3, 2, 4, 3, 3],
];
const SHADE = ["#F08A3C", "#F7B955", "#FBE2B0", "#A7F3D0", "#34D399"];

const TRUST = [
  { Icon: IconShield, text: "No names sent to AI" },
  { Icon: IconSparkle, text: "Every AI plan checked" },
  { Icon: IconLock, text: "Sign-in and roles" },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Read from the form too, so browser-autofilled values are used even if React missed them.
    const form = new FormData(e.currentTarget);
    const u = (String(form.get("username") ?? "") || username).trim();
    const p = String(form.get("password") ?? "") || password;
    if (!u || !p) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(u, p);
    } catch (err) {
      setError((err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Desktop: one screen, no scrolling. Phones scroll as they must.
    <div className="grid min-h-screen bg-[#F2F8F6] text-ink lg:h-screen lg:grid-cols-[1.25fr_1fr] lg:overflow-hidden">
      {/* ---------- left: rich panel, medium-dark ---------- */}
      <section className="relative hidden overflow-hidden px-14 py-10 text-white lg:flex lg:flex-col xl:px-20">
        <div className="absolute inset-0 bg-gradient-to-br from-[#047857] via-[#0F766E] to-[#0C4A6E]" aria-hidden />
        <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#34D399] opacity-40 blur-[110px]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-[420px] w-[420px] rounded-full bg-[#38BDF8] opacity-35 blur-[110px]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)", backgroundSize: "44px 44px" }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <Mark size={44} />
          <div className="leading-tight">
            <p className="display text-[1.6rem] font-extrabold">
              Recovery<span className="text-[#A7F3D0]">.AI</span>
            </p>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-white/60">Assistant</p>
          </div>
        </div>

        <div className="relative my-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90 backdrop-blur">
            <IconSparkle className="h-4 w-4 text-[#A7F3D0]" />
            Community diabetes programme
          </span>
          <h1 className="display mt-5 max-w-[24ch] text-[2.7rem] font-extrabold leading-[1.08] xl:text-[3.2rem] [@media(max-height:820px)]:text-[2.4rem]">
            Healthy habits, kept up. <span className="text-[#A7F3D0]">Help before people slip.</span>
          </h1>
          <p className="mt-4 max-w-[48ch] text-[1.1rem] leading-relaxed text-white/75">
            Shows health workers who needs them today and why, sets goals that start from each person&apos;s own level, and suggests a safe weekly plan written by AI and checked by the app.
          </p>

          {/* product preview: three glass cards in a row, no gaps to fill */}
          <div className="mt-8 grid max-w-[820px] grid-cols-[1.35fr_1fr] gap-4 [@media(max-height:820px)]:mt-6" aria-hidden>
            <div className="row-span-2 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Today&apos;s list</p>
                <span className="flex items-center gap-1.5 rounded-full bg-[#A7F3D0]/20 px-2.5 py-0.5 text-[0.7rem] font-bold text-[#D1FAE5]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#A7F3D0] motion-reduce:animate-none" />
                  Live
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { Icon: IconBell, label: "Need support", value: "1" },
                  { Icon: IconTarget, label: "Slipping", value: "3" },
                  { Icon: IconUsers, label: "On track", value: "20" },
                ].map(({ Icon, label, value }) => (
                  <div key={label} className="rounded-2xl bg-white/10 px-3 py-2.5">
                    <Icon className="h-4 w-4 text-[#D1FAE5]" />
                    <p className="mt-1.5 text-[0.7rem] text-white/65">{label}</p>
                    <p className="num text-lg font-extrabold leading-tight">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[0.75rem] font-semibold text-white/65">Recent days, member by member</p>
              <div className="mt-2 space-y-1.5">
                {HEAT.map((row, r) => (
                  <div key={r} className="flex items-center gap-1.5">
                    <span className="w-14 text-[0.7rem] text-white/60">{["Deepa", "Arjun", "Pooja", "Revathi"].at(r)}</span>
                    {row.map((v, c) => (
                      <span key={c} className="h-4 flex-1 rounded-[5px]" style={{ background: SHADE.at(v) }} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <div className="flex items-center gap-2 text-[0.75rem] text-white/70">
                <IconSteps className="h-4 w-4 text-[#D1FAE5]" />
                Met their weekly goal
              </div>
              <p className="num mt-1 text-2xl font-extrabold">62%</p>
              <p className="text-[0.72rem] font-bold text-[#A7F3D0]">▲ 3 points this week</p>
              <svg viewBox="0 0 120 32" className="mt-2 h-8 w-full">
                <defs>
                  <linearGradient id="login-spark" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#A7F3D0" stopOpacity="0.45" />
                    <stop offset="1" stopColor="#A7F3D0" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 26 L15 22 L30 24 L45 16 L60 19 L75 12 L90 14 L105 6 L120 8 L120 32 L0 32Z" fill="url(#login-spark)" />
                <path d="M0 26 L15 22 L30 24 L45 16 L60 19 L75 12 L90 14 L105 6 L120 8" fill="none" stroke="#A7F3D0" strokeWidth="2.2" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="rounded-3xl bg-white p-4 text-ink shadow-[0_24px_50px_-24px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#0369A1] text-white">
                  <IconSparkle className="h-3.5 w-3.5" />
                </span>
                <span className="text-[0.75rem] font-bold">This week&apos;s plan</span>
              </div>
              <p className="mt-2 text-[0.84rem] leading-snug">Walk after a meal, 15 min, Mon Wed Fri. Stretching, 10 min, Tue Thu.</p>
              <p className="mt-2 text-[0.7rem] font-bold text-[#047857]">✓ Inside limits, checked by the app</p>
            </div>
          </div>
        </div>

        <ul className="relative grid grid-cols-3 gap-6 border-t border-white/15 pt-6 [@media(max-height:800px)]:hidden">
          {TRUST.map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[0.92rem] font-semibold text-white/85">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#A7F3D0]">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- right: the form, filling its column ---------- */}
      <section className="flex flex-col px-6 py-8 sm:px-12 xl:px-16">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Mark size={32} />
            <span className="display text-lg font-extrabold">
              Recovery<span className="text-brand">.AI</span>
            </span>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-rule bg-white px-3 py-1 text-[0.8rem] font-semibold text-slate">
            <span className="h-2 w-2 rounded-full bg-stride" />
            Secure connection
          </span>
        </div>

        <div className="mx-auto my-auto w-full max-w-[460px] py-8">
          <h2 className="display text-[2.4rem] font-extrabold leading-tight">Welcome back</h2>
          <p className="mt-1.5 text-[1.05rem] text-slate">Sign in to see who needs you today.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <div>
              <label className="block text-sm font-bold" htmlFor="username">
                Username
              </label>
              <div className="relative mt-2">
                <IconUser className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate/70" />
                <input
                  id="username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="Enter your username"
                  className="h-14 w-full rounded-2xl border border-[#D6E4E1] bg-white pl-12 pr-4 text-base shadow-sm outline-none transition placeholder:text-slate/60 focus:border-brand focus:ring-4 focus:ring-brand/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold" htmlFor="password">
                Password
              </label>
              <div className="relative mt-2">
                <IconLock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate/70" />
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="h-14 w-full rounded-2xl border border-[#D6E4E1] bg-white pl-12 pr-12 text-base shadow-sm outline-none transition placeholder:text-slate/60 focus:border-brand focus:ring-4 focus:ring-brand/15"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate/70 hover:text-ink"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-2xl border border-alarm/20 bg-alarm-pale px-4 py-3 text-sm font-semibold text-alarm">
                {error}
              </p>
            )}

            {/* Not disabled while empty: browser autofill doesn't always notify React, which left the button greyed out. */}
            <button
              type="submit"
              disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#0369A1] text-[1.05rem] font-bold text-white shadow-[0_16px_32px_-14px_rgba(12,74,110,0.7)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#D6E4E1] bg-white p-4">
              <span className="rounded-md bg-[#D1FAE5] px-2 py-0.5 text-[0.72rem] font-bold text-[#047857]">ADMIN</span>
              <p className="mt-2 text-[0.88rem] leading-snug text-slate">Loads data and sees the activity log.</p>
            </div>
            <div className="rounded-2xl border border-[#D6E4E1] bg-white p-4">
              <span className="rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[0.72rem] font-bold text-[#0369A1]">ANALYST</span>
              <p className="mt-2 text-[0.88rem] leading-snug text-slate">Health worker view: members, plans and follow-ups.</p>
            </div>
          </div>
        </div>

        <p className="text-center text-[0.82rem] text-slate">Activity and sleep are real Fitbit data; member profiles are demo data. After 10 wrong tries, sign-in pauses for 15 minutes.</p>
      </section>
    </div>
  );
}