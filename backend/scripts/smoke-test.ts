/**
 * Quick backend check without the server or frontend:
 * ingests the sample files, runs analytics and the LLM guard, prints results.
 *   npm run sample && npm run test:analytics
 */
import fs from "node:fs";
import path from "node:path";
import { csvRows, ingestRows } from "../src/ingestion/ingest.js";
import { store } from "../src/store/memoryStore.js";
import { computeKpis, computeTrend } from "../src/analytics/metrics.js";
import { detectAnomalies } from "../src/analytics/anomalies.js";
import { buildContext } from "../src/llm/contextBuilder.js";
import { templateMessage } from "../src/llm/prompts.js";
import { checkNumbers } from "../src/llm/numberGuard.js";

const dir = path.resolve(import.meta.dirname, "../data/sample");
let failures = 0;
const check = (name: string, ok: boolean, info = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (!ok) failures++;
};

for (const f of ["dailyActivity_merged.csv", "sleepDay_merged.csv"]) {
  const file = path.join(dir, f);
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}. Run "npm run sample" first.`);
    process.exit(1);
  }
  const { batch } = await ingestRows(csvRows(fs.readFileSync(file)), { fileName: f, source: "upload" });
  console.log(`${f}: ${batch.totalRows} rows, ${batch.accepted} accepted, ${batch.rejected} rejected, ${batch.duplicates} duplicates`);
  console.log(`  mapped: ${JSON.stringify(batch.mappedFields)}`);
  console.log(`  unavailable: ${batch.unavailableFields.join(", ") || "none"}\n`);
  if (f.startsWith("daily")) {
    check("bad rows rejected", batch.rejected >= 4, `${batch.rejected}`);
    check("duplicates detected", batch.duplicates >= 2, `${batch.duplicates}`);
  }
}

const all = store.allRecords();
check("ids pseudonymised (no raw dataset ids stored)", all.every((r) => /^P-[0-9a-f]{8}$/.test(r.userId)), all[0].userId);
const k = computeKpis(all, {});
console.log("\nKPIs:", k);
check("compliance in 0..100", k.compliancePct >= 0 && k.compliancePct <= 100);
check("sleep merged into activity", k.avgSleepHours !== null);
check("recovery score not invented", k.avgRecoveryScore === null);

const trend = computeTrend(all, {});
check("trend has points", trend.length > 30, `${trend.length} days`);

const alerts = detectAnomalies(all, {});
console.log(`\nAlerts: ${alerts.length}. Example:`, alerts[0]);
check("anomalies detected", alerts.length > 0);

const user = alerts[0]?.userId ?? all[0].userId;
const ctx = buildContext(all, user)!;
check("LLM context carries no id", ctx.user === "anonymous" && !JSON.stringify(ctx).includes(user));
console.log("\nLLM context:", ctx);
const t = templateMessage(ctx);
console.log("\nTemplate insight:", t.insight, "\nTemplate message:", t.message);
check("template passes number guard", checkNumbers(ctx, t.insight, t.message).passed);
const bad = checkNumbers(ctx, `You are ${ctx.target_steps - ctx.avg_steps + 1} steps short.`);
check("guard rejects a calculated number", !bad.passed, bad.unknownNumbers.join(","));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
