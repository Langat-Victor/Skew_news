/*
  Turns stored column values into the pre-formatted strings the components
  expect. Everything here is DERIVED from a real row — never invented. Reading
  times are computed from the text, dates from the timestamp.
*/

/** Words per minute used for every reading-time estimate. */
const WORDS_PER_MINUTE = 200;

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  // Pinned so a server render and a client hydration cannot disagree.
  timeZone: "UTC",
});

/** `2026-08-26T09:30:00Z` → `Aug 26, 2026`. Returns "" for an unparseable value. */
export function formatPublishedDate(iso: string | null | undefined): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return DATE_FORMAT.format(date);
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** `{n} min read`, floored at 1 so a short article never reads "0 min read". */
export function readingTimeFor(text: string): string {
  const minutes = Math.max(1, Math.round(wordCount(text) / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

/**
 * Splits stored text into display paragraphs: blank lines first, single newlines
 * as a fallback for text that was cleaned into one block. Empty fragments are
 * dropped, so a body that is genuinely one paragraph yields one item.
 */
export function toParagraphs(text: string): string[] {
  const byBlankLine = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (byBlankLine.length > 1) return byBlankLine;

  return text
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** `0.82` → `82%`. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
