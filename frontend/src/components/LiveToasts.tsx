"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@shared/types";
import { useLive } from "@/lib/live";
import { shortDate, userLabel } from "@/lib/format";

/** New alerts arriving from the live stream, shown briefly bottom-right. */
export function LiveToasts({ onSelectUser }: { onSelectUser: (id: string) => void }) {
  const { lastEvent } = useLive();
  const [items, setItems] = useState<Alert[]>([]);

  useEffect(() => {
    if (!lastEvent?.newAlerts.length) return;
    const fresh = lastEvent.newAlerts.filter((a) => a.severity === "attention").slice(0, 3);
    if (!fresh.length) return;
    setItems((prev) => [...fresh, ...prev].slice(0, 3));
    const t = setTimeout(() => setItems((prev) => prev.filter((p) => !fresh.includes(p))), 7000);
    return () => clearTimeout(t);
  }, [lastEvent]);

  if (!items.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelectUser(a.userId)}
          className="toast-in rounded-lg border-l-4 border-alarm bg-paper px-4 py-3 text-left shadow-[0_10px_30px_-12px_rgba(19,41,61,0.45)]"
        >
          <div className="text-[0.78rem] text-slate">
            New alert, {userLabel(a.userId)}, {shortDate(a.date)}
          </div>
          <div className="font-bold">{a.title}</div>
        </button>
      ))}
    </div>
  );
}
