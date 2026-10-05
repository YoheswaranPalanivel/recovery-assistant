/**
 * Maps whatever columns the source dataset has onto the app's standard fields.
 * A field the source doesn't have is reported as unavailable — never invented.
 */

export type StandardField =
  | "userId"
  | "date"
  | "steps"
  | "distanceKm"
  | "activeMinutes"
  | "veryActiveMinutes"
  | "fairlyActiveMinutes"
  | "lightlyActiveMinutes"
  | "sedentaryMinutes"
  | "calories"
  | "sleepMinutes"
  | "sleepHours"
  | "restingHeartRate"
  | "recoveryScore";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Known column names per standard field (normalised: lowercase, no spaces/underscores). */
const ALIASES: Record<StandardField, string[]> = {
  userId: ["id", "userid", "user", "participant", "participantid", "subjectid", "anonymoususerid"],
  date: ["date", "activitydate", "sleepday", "day", "activityday", "timestamp", "datetime"],
  steps: ["steps", "totalsteps", "stepcount", "stepstotal", "dailysteps"],
  distanceKm: ["distance", "totaldistance", "distancekm", "trackerdistance"],
  activeMinutes: ["activeminutes", "durationmin", "duration", "minutesactive", "activityminutes"],
  veryActiveMinutes: ["veryactiveminutes"],
  fairlyActiveMinutes: ["fairlyactiveminutes", "moderatelyactiveminutes"],
  lightlyActiveMinutes: ["lightlyactiveminutes", "lightactiveminutes"],
  sedentaryMinutes: ["sedentaryminutes", "minutessedentary"],
  calories: ["calories", "caloriesburned", "totalcalories", "kcal"],
  sleepMinutes: ["totalminutesasleep", "minutesasleep", "sleepminutes", "sleepduration"],
  sleepHours: ["sleephours", "hoursasleep", "sleep"],
  restingHeartRate: ["restingheartrate", "restinghr", "heartrate", "rhr", "avgheartrate"],
  recoveryScore: ["recoveryscore", "recovery", "readiness", "readinessscore"],
};

export type ColumnMapping = {
  fields: Partial<Record<StandardField, string>>; // standard -> original column
  kind: "activity" | "sleep" | "unknown";
  formatLabel: string;
};

export function buildMapping(headers: string[]): ColumnMapping {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const fields: ColumnMapping["fields"] = {};

  for (const [field, aliases] of Object.entries(ALIASES) as [StandardField, string[]][]) {
    for (const a of aliases) {
      const original = byNorm.get(a);
      if (original && !Object.values(fields).includes(original)) {
        fields[field] = original;
        break;
      }
    }
  }

  const kind: ColumnMapping["kind"] = fields.steps
    ? "activity"
    : fields.sleepMinutes || fields.sleepHours
      ? "sleep"
      : "unknown";

  const isFitbit = byNorm.has("activitydate") || byNorm.has("sleepday");
  const formatLabel = isFitbit
    ? kind === "sleep"
      ? "Fitbit sleepDay export"
      : "Fitbit dailyActivity export"
    : `Generic ${kind} table`;

  return { fields, kind, formatLabel };
}

/** Standard fields shown to the user, with the source column they came from. */
export function describeMapping(m: ColumnMapping) {
  const shown: Record<string, string> = {};
  const f = m.fields;
  if (f.userId) shown.user_id = f.userId;
  if (f.date) shown.date = f.date;
  if (f.steps) shown.steps = f.steps;
  if (f.distanceKm) shown.distance_km = f.distanceKm;
  if (f.veryActiveMinutes && f.fairlyActiveMinutes)
    shown.active_minutes = `${f.veryActiveMinutes} + ${f.fairlyActiveMinutes}`;
  else if (f.activeMinutes) shown.active_minutes = f.activeMinutes;
  if (f.sedentaryMinutes) shown.sedentary_minutes = f.sedentaryMinutes;
  if (f.calories) shown.calories = f.calories;
  if (f.sleepMinutes) shown.sleep_hours = `${f.sleepMinutes} ÷ 60`;
  else if (f.sleepHours) shown.sleep_hours = f.sleepHours;
  if (f.restingHeartRate) shown.resting_heart_rate = f.restingHeartRate;
  if (f.recoveryScore) shown.recovery_score = f.recoveryScore;

  const expected =
    m.kind === "sleep"
      ? ["user_id", "date", "sleep_hours"]
      : [
          "user_id",
          "date",
          "steps",
          "distance_km",
          "active_minutes",
          "sedentary_minutes",
          "calories",
          "sleep_hours",
          "resting_heart_rate",
          "recovery_score",
        ];
  const unavailable = expected.filter((k) => !(k in shown));
  return { shown, unavailable };
}

/** Parses the date formats these datasets actually use into YYYY-MM-DD. */
export function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel serial date
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);

  const s = String(raw).trim();

  // 2016-04-12 or 2016-04-12T00:00:00 / 2016-04-12 00:00:00
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  // 4/12/2016 or 4/12/2016 12:00:00 AM  (Fitbit uses M/D/YYYY; D/M if first part > 12)
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    return a > 12 ? toIso(y, b, a) : toIso(y, a, b);
  }
  return null;
}

function toIso(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}