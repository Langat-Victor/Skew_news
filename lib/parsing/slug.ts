/*
  Deterministic article slugs.

  Determinism is the point (decision 16): re-scraping the same URL produces the
  same slug, so a `slug` unique-constraint conflict can only ever coincide with an
  `original_url` conflict — which the append-only upsert in §10 already swallows.
  A random suffix would instead turn every re-scrape into a fresh slug collision
  risk against a row we already have.
*/

import { createHash } from "node:crypto";

/** Leaves room for the `-` + 7 hex characters within a comfortable total length. */
const MAX_STEM_LENGTH = 72;
const HASH_LENGTH = 7;

/**
 * The schema's `check (slug ~ '^[a-z0-9][a-z0-9-]*$')` rejects a leading hyphen
 * and an empty stem, so a title that normalises to nothing needs a real fallback.
 */
const FALLBACK_STEM = "article";

function slugStem(title: string): string {
  const stem = title
    // NFKD splits accented characters into base + combining mark, so the mark
    // can be stripped and `Ürün` becomes `urun` rather than `rn`.
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (!stem) return FALLBACK_STEM;
  if (stem.length <= MAX_STEM_LENGTH) return stem;

  // Truncate at a hyphen so the slug ends on a whole word, not mid-word.
  const truncated = stem.slice(0, MAX_STEM_LENGTH);
  const lastHyphen = truncated.lastIndexOf("-");
  const trimmed = lastHyphen > 0 ? truncated.slice(0, lastHyphen) : truncated;

  return trimmed.replace(/-$/, "") || FALLBACK_STEM;
}

/**
 * `<title-stem>-<7 hex chars of sha256(originalUrl)>`.
 *
 * Hex is `[0-9a-f]`, so the suffix can never break the schema's slug pattern.
 */
export function articleSlug(title: string, originalUrl: string): string {
  const hash = createHash("sha256").update(originalUrl).digest("hex").slice(0, HASH_LENGTH);

  return `${slugStem(title)}-${hash}`;
}
