export const PLATFORM_LABELS = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
} as const;

export type PlatformId = keyof typeof PLATFORM_LABELS;

const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
// UTC, so the server's render and the browser's agree.
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const formatNumber = (n: number) => numberFormat.format(n);
export const formatCompact = (n: number) => compactFormat.format(n);
/** A stored time: ISO, or SQLite's "YYYY-MM-DD HH:MM:SS" in UTC. */
const parse = (stored: string) => new Date(/^\d{4}-\d{2}-\d{2} \d/.test(stored) ? `${stored.replace(" ", "T")}Z` : stored);
export const formatDate = (stored: string) => dateFormat.format(parse(stored));
export const formatDateTime = (stored: string) => dateTimeFormat.format(parse(stored));
export const formatScore = (score: number | null) => (score === null ? "—" : `${score.toFixed(1)}×`);
/** "2026-11-14" for a date input. */
export const toDateInput = (iso: string) => iso.slice(0, 10);

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    // A validation error from the server is a JSON list of issues.
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // Not JSON: the message itself.
    }
    return error.message;
  }
  return "That didn't work. Try again.";
}
