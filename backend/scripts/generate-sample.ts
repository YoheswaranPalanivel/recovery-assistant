/**
 * Generates a SYNTHETIC test dataset in the same column format as the public
 * Fitbit "dailyActivity_merged.csv" / "sleepDay_merged.csv" files.
 *
 * Use it only to check that the app runs. For the real demo, download the
 * public dataset (see README) — never present these numbers as real data.
 *
 *   npm run sample                 -> 40 users x 120 days
 *   npm run sample -- 80 180       -> 80 users x 180 days
 */
import fs from "node:fs";
import path from "node:path";

const USERS = Number(process.argv[2] ?? 40);
const DAYS = Number(process.argv[3] ?? 120);
const OUT = path.resolve(import.meta.dirname, "../data/sample");

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const start = new Date(Date.UTC(2026, 3, 1)); // 1 Apr 2026
const fitbitDate = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;

const act: string[] = [
  "Id,ActivityDate,TotalSteps,TotalDistance,TrackerDistance,VeryActiveMinutes,FairlyActiveMinutes,LightlyActiveMinutes,SedentaryMinutes,Calories",
];
const sleep: string[] = ["Id,SleepDay,TotalSleepRecords,TotalMinutesAsleep,TotalTimeInBed"];

for (let u = 0; u < USERS; u++) {
  const id = String(1503960366 + u * 104729);
  const base = 3500 + rand() * 9000;
  const drift = pick([-1, 0, 0, 1]) * (rand() * 30); // steps/day trend
  const weekendFactor = 0.75 + rand() * 0.5;
  const sleepBase = 6 + rand() * 2.2;
  const tracksSleep = rand() < 0.7;
  const dipStart = rand() < 0.6 ? Math.floor(20 + rand() * (DAYS - 30)) : -1; // a bad week
  const dipLen = 4 + Math.floor(rand() * 6);

  for (let d = 0; d < DAYS; d++) {
    const date = new Date(start.getTime() + d * 86400000);
    const ds = fitbitDate(date);
    const dow = date.getUTCDay();

    if (rand() < 0.03) {
      act.push(`${id},${ds},0,0,0,0,0,0,1440,1500`); // device not worn
      continue;
    }
    let steps = (base + drift * d) * (dow === 0 || dow === 6 ? weekendFactor : 1) * (1 + gauss() * 0.22);
    const inDip = dipStart >= 0 && d >= dipStart && d < dipStart + dipLen;
    if (inDip) steps *= 0.3 + rand() * 0.2;
    steps = Math.max(150, Math.round(steps));

    const very = Math.max(0, Math.round(steps / 450 + gauss() * 6));
    const fairly = Math.max(0, Math.round(steps / 900 + gauss() * 4));
    const lightly = Math.max(0, Math.round(120 + steps / 60 + gauss() * 25));
    const sed = Math.min(1440 - very - fairly - lightly, Math.round(700 + gauss() * 90));
    const km = (steps * 0.00076).toFixed(2);
    const cal = Math.round(1550 + steps * 0.045 + gauss() * 120);
    act.push(`${id},${ds},${steps},${km},${km},${very},${fairly},${lightly},${sed},${cal}`);

    if (tracksSleep && rand() < 0.85) {
      let h = sleepBase + gauss() * 0.6 - (inDip ? 1.6 : 0);
      if (rand() < 0.04) h -= 2.2;
      const mins = Math.max(120, Math.round(h * 60));
      sleep.push(`${id},${ds} 12:00:00 AM,1,${mins},${mins + Math.round(15 + rand() * 40)}`);
    }
  }
}

// Deliberate data-quality problems, so validation has something to show.
const d0 = fitbitDate(start);
act.push(`1503960366,${d0},-500,0,0,0,0,0,900,1600`); // negative steps
act.push(`1503960366,31/31/2026,5000,3.8,3.8,10,10,200,800,2000`); // invalid date
act.push(`1503960366,${fitbitDate(new Date(start.getTime() + 86400000 * 5))},250000,190,190,10,10,200,800,2000`); // impossible
act.push(`,${d0},6000,4.5,4.5,10,10,200,800,2000`); // missing user id
act.push(act[1]); // exact duplicate row
act.push(act[2]);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "dailyActivity_merged.csv"), act.join("\n"));
fs.writeFileSync(path.join(OUT, "sleepDay_merged.csv"), sleep.join("\n"));
console.log(`Synthetic test data (NOT real): ${USERS} users x ${DAYS} days`);
console.log(`  ${act.length - 1} activity rows, ${sleep.length - 1} sleep rows`);
console.log(`  -> ${OUT}`);
