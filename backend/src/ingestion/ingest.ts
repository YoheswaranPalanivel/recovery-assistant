import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse";
import * as XLSX from "xlsx";
import type { IngestionBatch, RejectedRow } from "@shared/types";
import { buildMapping, describeMapping, type ColumnMapping } from "./columnMapper.js";
import { validateRow } from "./validator.js";
import { store } from "../store/memoryStore.js";

type Row = Record<string, unknown>;

export class IngestionError extends Error {}

/** Runs rows through map -> validate -> dedupe -> store and returns a batch report. */
export async function ingestRows(
  rows: AsyncIterable<Row> | Iterable<Row>,
  opts: { fileName: string; source: IngestionBatch["source"]; headers?: string[] },
): Promise<{ batch: IngestionBatch; touchedUsers: Set<string>; latestDate: string | null }> {
  let mapping: ColumnMapping | null = opts.headers ? buildMapping(opts.headers) : null;
  const rejected: RejectedRow[] = [];
  const touchedUsers = new Set<string>();
  let latestDate: string | null = null;
  let total = 0;
  let accepted = 0;
  let duplicates = 0;

  for await (const row of rows as AsyncIterable<Row>) {
    total++;
    if (!mapping) mapping = buildMapping(Object.keys(row));
    if (total === 1) assertUsable(mapping);

    const result = validateRow(row, mapping);
    if (!result.ok) {
      rejected.push({ source: opts.fileName, rowNumber: total + 1, reason: result.reason });
      continue;
    }
    const outcome =
      result.kind === "activity" ? store.upsertRecord(result.record) : store.mergeSleep(result.sleep);
    if (outcome === "duplicate") {
      duplicates++;
      continue;
    }
    accepted++;
    const rec = result.kind === "activity" ? result.record : result.sleep;
    touchedUsers.add(rec.userId);
    if (!latestDate || rec.date > latestDate) latestDate = rec.date;
  }

  if (!mapping) throw new IngestionError("The file has no data rows.");

  const { shown, unavailable } = describeMapping(mapping);
  const batch: IngestionBatch = {
    id: randomUUID(),
    source: opts.source,
    fileName: opts.fileName,
    receivedAt: new Date().toISOString(),
    totalRows: total,
    accepted,
    rejected: rejected.length,
    duplicates,
    detectedFormat: mapping.formatLabel,
    mappedFields: shown,
    unavailableFields: unavailable,
  };
  store.addBatch(batch);
  store.addRejections(rejected);
  return { batch, touchedUsers, latestDate };
}

function assertUsable(m: ColumnMapping) {
  if (!m.fields.userId) throw new IngestionError("No user id column found (expected e.g. Id, user_id).");
  if (!m.fields.date) throw new IngestionError("No date column found (expected e.g. ActivityDate, date).");
  if (m.kind === "unknown")
    throw new IngestionError("No steps or sleep column found. Upload a daily activity or sleep file.");
}

/** Streams a CSV buffer row by row, so large files don't sit in memory twice. */
export function csvRows(buffer: Buffer): AsyncIterable<Row> {
  return Readable.from(buffer).pipe(
    parse({ columns: true, bom: true, skip_empty_lines: true, trim: true, relax_column_count: true }),
  );
}

export function excelRows(buffer: Buffer): Row[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new IngestionError("The workbook has no sheets.");
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: true });
}
