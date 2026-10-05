import type { Server } from "socket.io";
import type { Alert, IngestionBatch } from "@shared/types";
import { store } from "./store/memoryStore.js";

let io: Server | null = null;
const seenAlertIds = new Set<string>();

export const attachRealtime = (server: Server) => {
  io = server;
};

/** Returns only alerts not seen before and remembers them. */
export function markAlertsSeen(alerts: Alert[], reset = false): Alert[] {
  if (reset) seenAlertIds.clear();
  const fresh = alerts.filter((a) => !seenAlertIds.has(a.id));
  fresh.forEach((a) => seenAlertIds.add(a.id));
  return fresh;
}

export function emitStreamUpdate(p: { batches: IngestionBatch[]; newAlerts: Alert[]; reset?: boolean }) {
  io?.emit("data:updated", {
    at: new Date().toISOString(),
    records: store.recordCount(),
    batches: p.batches,
    newAlerts: p.newAlerts.slice(0, 20),
    reset: Boolean(p.reset),
  });
}
