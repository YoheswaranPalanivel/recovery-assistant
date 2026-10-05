"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import type { Alert, IngestionBatch } from "@shared/types";
import { API_URL } from "./api";

export type LiveEvent = {
  at: string;
  records: number;
  batches: IngestionBatch[];
  newAlerts: Alert[];
  reset: boolean;
};

type LiveState = {
  connected: boolean;
  lastEvent: LiveEvent | null;
  /** Increments on every server update; pages refetch when it changes. */
  version: number;
};

const LiveContext = createContext<LiveState>({ connected: false, lastEvent: null, version: 0 });

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ connected: false, lastEvent: null, version: 0 });
  const pending = useRef<LiveEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"], reconnectionDelayMax: 5000, withCredentials: true });
    socket.on("connect", () => setState((s) => ({ ...s, connected: true })));
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));
    socket.on("data:updated", (e: LiveEvent) => {
      // Merge bursts (e.g. activity + sleep batch) into one refresh.
      pending.current = pending.current
        ? { ...e, batches: [...pending.current.batches, ...e.batches], newAlerts: [...pending.current.newAlerts, ...e.newAlerts] }
        : e;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const ev = pending.current;
        pending.current = null;
        setState((s) => ({ ...s, lastEvent: ev, version: s.version + 1 }));
      }, 400);
    });
    return () => {
      socket.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
