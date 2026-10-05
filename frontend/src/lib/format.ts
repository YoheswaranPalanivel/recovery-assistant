export const int = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-IN");

export const dec = (n: number | null | undefined, dp = 1) =>
  n === null || n === undefined ? "—" : n.toFixed(dp);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-07-29" -> "29 Jul" */
export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

/** "2026-07-29" -> "29 Jul 2026" */
export const longDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return `${shortDate(iso)} ${iso.slice(0, 4)}`;
};

export const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};

/** Ids are pseudonyms like "P-3f2a9c1b"; the first 6 characters are enough to tell people apart on screen. */
export const userLabel = (id: string) => (id.startsWith("P-") ? id.slice(0, 6) : id.length > 6 ? `#${id.slice(-4)}` : `#${id}`);
