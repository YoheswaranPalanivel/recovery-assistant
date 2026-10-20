"use client";

import { LABELS, LANGS, LANG_NAME, TEMPLATES, type MessageKey } from "@shared/messages";

const NAMES: Record<MessageKey, string> = {
  glucose_low_patient: "Low reading (to the patient)",
  glucose_high_patient: "High reading (to the patient)",
  glucose_in_range_patient: "Reading in range (to the patient)",
  glucose_staff: "Reading (to staff and family)",
  plan_line: "One activity in a weekly plan",
  plan_patient: "Weekly plan (to the patient)",
  medicine_reminder: "Medicine reminder (to the patient)",
  alert_glucose_low: "Alert: low reading (to staff and family)",
  alert_glucose_high: "Alert: high reading (to staff and family)",
  alert_not_well: "Alert: not feeling well (to staff and family)",
  alert_help: "Alert: asked for help (to staff and family)",
  help_sent_patient: "Help request received (to the patient)",
  alert_family_request: "Alert: family asked for a check-in (to staff and family)",
  fam_waiting: "Helper asked (to family)",
  fam_on_way: "Helper on the way (to family)",
  fam_call_now: "Nobody accepted yet, please call (to family)",
  fam_emergency: "Still nobody, emergency number (to family)",
  fam_all_ok: "No alerts (to family)",
  fam_ask_button: "Ask for a check-in button (to family)",
};

/** Every message a patient can receive, in every language, with its review status. */
export default function MessagesPage() {
  const keys = Object.keys(TEMPLATES) as MessageKey[];
  return (
    <div className="flex flex-col gap-5 pt-4">
      <div>
        <h1 className="display text-[2rem] font-extrabold leading-tight">Approved messages</h1>
        <p className="mt-1 max-w-[80ch] text-slate">
          Everything a patient reads about their health comes from this list, never from AI and never from machine translation. Numbers in braces are
          filled in from the data as digits, so a translation can never change a reading, a limit or a dose. Each language is checked by a clinician
          and a native speaker before use.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[0.88rem]">
          <thead className="border-b border-rule text-[0.78rem] uppercase tracking-[0.08em] text-slate">
            <tr>
              <th className="px-4 py-3">Message</th>
              {LANGS.map((l) => (
                <th key={l} className="px-4 py-3">
                  {LANG_NAME[l]}
                </th>
              ))}
              <th className="px-4 py-3">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule align-top">
            {keys.map((k) => (
              <tr key={k}>
                <td className="px-4 py-3 font-semibold">{NAMES[k]}</td>
                {LANGS.map((l) => (
                  <td key={l} className="px-4 py-3" lang={l === "Tamil" ? "ta" : l === "Hindi" ? "hi" : "en"}>
                    {TEMPLATES[k].text[l]}
                  </td>
                ))}
                <td className="px-4 py-3">
                  {TEMPLATES[k].review.status === "approved" ? (
                    <span className="rounded-full bg-stride-pale px-2 py-0.5 text-[0.75rem] font-bold text-stride-deep">Approved</span>
                  ) : (
                    <span className="rounded-full bg-amber-pale px-2 py-0.5 text-[0.75rem] font-bold text-amber">Draft: needs clinical and language review</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        <h2 className="display text-[1.05rem] font-extrabold">Approved words</h2>
        <p className="text-[0.85rem] text-slate">Reading levels, reading times and activities, in each language.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[0.88rem]">
            <tbody className="divide-y divide-rule">
              {Object.entries(LABELS).flatMap(([group, items]) =>
                Object.entries(items).map(([id, t]) => (
                  <tr key={`${group}-${id}`}>
                    <td className="px-3 py-2 text-slate">{group}</td>
                    {LANGS.map((l) => (
                      <td key={l} className="px-3 py-2">
                        {(t as Record<string, string>)[l]}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}