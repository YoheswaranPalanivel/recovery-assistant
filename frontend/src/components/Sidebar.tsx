"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { api, type Status } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLive } from "@/lib/live";
import { timeAgo } from "@/lib/format";
import { IconDatabase, IconFlow, IconGrid, IconLogout, IconMenu, IconShield, IconTarget, IconUsers } from "./icons";

const NAV = [
  { href: "/", label: "Today", Icon: IconTarget },
    { href: "/members", label: "Members", Icon: IconUsers },
  { href: "/community", label: "Community", Icon: IconGrid },
  { href: "/data", label: "Data", Icon: IconDatabase },
  { href: "/how-it-works", label: "How it works", Icon: IconFlow },
  { href: "/security", label: "Privacy & security", Icon: IconShield },
];

export function Mark({ size = 32 }: { size?: number }) {
  // Each copy needs its own gradient id: a hidden copy's gradient would not paint the visible one.
  const gid = `mark-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#059669" />
          <stop offset="0.55" stopColor="#0F766E" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
      </defs>
      <rect width="30" height="30" rx="9" fill={`url(#${gid})`} />
      <path d="M5 17h5l2.5-6 4 11 2.5-7H25" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar() {
  const path = usePathname();
  const { user, signOut } = useAuth();
  const { connected, lastEvent, version } = useLive();
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
  }, [version, connected]);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setOpen(false), [path]);

  const initials = (user?.username ?? "?").slice(0, 2).toUpperCase();

  const body = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-3 px-5 pb-6 pt-6">
        <Mark />
        <span className="display whitespace-nowrap text-[1.15rem] font-extrabold leading-none text-ink">
          Recovery<span className="text-brand">.AI</span>
        </span>
      </Link>

      <p className="px-6 pb-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-slate/70">Menu</p>
      <nav aria-label="Main" className="flex flex-col gap-1 px-3">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.95rem] transition-colors ${
                active ? "bg-brand-soft font-semibold text-brand" : "text-slate hover:bg-fog hover:text-ink"
              }`}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand" aria-hidden />}
              <Icon className={`h-5 w-5 ${active ? "text-brand" : ""}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 px-3 pb-4">
               <div className="soft-gradient rounded-2xl px-4 py-3.5 text-[0.84rem]">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <span
              key={lastEvent?.at}
              className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-stride" : "bg-slate/40"} ${lastEvent ? "pulse" : ""}`}
            />
            {connected ? (lastEvent ? `Live, updated ${timeAgo(lastEvent.at)}` : "Live") : "Offline"}
          </div>
          <ul className="mt-2.5 space-y-1.5 text-slate">
            {[
              { on: true, text: "Secure session" },
              { on: true, text: "IDs pseudonymised" },
              { on: Boolean(status?.llm), text: status?.llm ? "AI replies checked" : "AI off, templates used" },
            ].map((x) => (
              <li key={x.text} className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold ${
                    x.on ? "bg-stride-pale text-stride-deep" : "bg-amber-pale text-amber"
                  }`}
                  aria-hidden
                >
                  {x.on ? "✓" : "!"}
                </span>
                {x.text}
              </li>
            ))}
          </ul>
        </div>

        {user && (
          <div className="flex items-center gap-3 rounded-2xl border border-rule px-3 py-2.5">
            <span className="brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-bold text-white">{initials}</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[0.92rem] font-semibold text-ink">{user.username}</p>
              <p className="text-[0.78rem] capitalize text-slate">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg p-2 text-slate transition-colors hover:bg-alarm-pale hover:text-alarm"
              aria-label="Sign out"
              title="Sign out"
            >
              <IconLogout />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark size={28} />
          <span className="display text-[1.15rem] font-extrabold text-ink">
            Recovery<span className="text-brand">.AI</span>
          </span>
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 text-ink" aria-label="Open menu">
          <IconMenu />
        </button>
      </div>

      {/* desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-rule bg-paper lg:block">{body}</aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <aside className="relative h-full w-[260px] bg-paper">{body}</aside>
        </div>
      )}
    </>
  );
}
