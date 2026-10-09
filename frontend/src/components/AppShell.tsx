"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LiveProvider } from "@/lib/live";
import { Sidebar } from "./Sidebar";

/** Nothing private renders until the session is confirmed. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const path = usePathname();

  if (path === "/login") return <>{children}</>;
  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate" aria-busy="true">
        Checking your session…
      </div>
    );
  }
    // the member's phone view is shown on its own, without the staff sidebar
  if (path.startsWith("/me/")) return <LiveProvider>{children}</LiveProvider>;
  
  return (
    <LiveProvider>
      <Sidebar />
      <div className="lg:pl-[248px]">
        <main className="mx-auto w-full max-w-[1360px] px-4 pb-16 pt-2 sm:px-6 lg:px-10 lg:pt-6">{children}</main>
      </div>
    </LiveProvider>
  );
}
