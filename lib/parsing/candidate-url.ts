/*
  Candidate URL filtering (AGENTS.md §11 + §12).

  Runs before any article detail page is fetched, so every rejection here is a
  page never requested. §12's tie-breaker is applied literally — an uncertain
  candidate is rejected, not fetched to find out — because a false accept costs
  an Oxylabs call and risks storing a non-article, while a false reject costs one
  story out of a homepage full of them.

  The rules table is keyed by HOST, not by URL. §7 forbids hardcoding source URLs
  in scraping logic; the host to look up arrives at runtime from the source row's
  own `listing_url`, and a source with no matching rule falls back to the generic
  heuristic — so adding a source to Supabase needs no code change here.
*/

import type { RejectionReason } from "@/lib/pipeline/types";
import { hasRejectedPathSegment } from "@/lib/parsing/reject-list";
import { pathnameOf, registrableDomainOf, sameSite } from "@/lib/parsing/url";

export type CandidateVerdict = { keep: true } | { keep: false; reason: RejectionReason };

const KEEP: CandidateVerdict = { keep: true };

function reject(reason: RejectionReason): CandidateVerdict {
  return { keep: false, reason };
}

/**
 * Per-host article URL rules, each tested against the pathname. The §11/§12
 * example each one is written to exclude is named in its comment.
 */
const ARTICLE_URL_RULES: ReadonlyMap<string, readonly RegExp[]> = new Map([
  [
    // Article paths end in the `-YYYY-MM-DD` marker. Rejects `/world/africa`.
    "reuters.com",
    [/^\/(?:[a-z0-9-]+\/)+[a-z0-9-]{8,}-\d{4}-\d{2}-\d{2}$/],
  ],
  [
    // Date plus a numeric story id. Rejects `/sections/politics`.
    "npr.org",
    [/^\/(?:sections\/[^/]+\/)?\d{4}\/\d{2}\/\d{2}\/\d+\//],
  ],
  [
    // One topic root, then a long story slug. Rejects `/shows/…`, `/games/…`,
    // `/video/…` (those also trip the reject list one check earlier).
    "foxnews.com",
    [/^\/[a-z-]+\/[a-z0-9-]{15,}$/],
  ],
  [
    // Modern `/news/articles/<id>` plus the legacy numeric form. Rejects
    // `/sport/…`, `/news/live/…`, `/news/topics/…`.
    "bbc.com",
    [/^\/news\/articles\/[a-z0-9]{6,}$/, /^\/news\/(?:[a-z-]+-)?\d{8,}$/],
  ],
  [
    // Date-based path. Rejects `/us/environment` and `/thefilter-us`.
    "theguardian.com",
    [/^\/(?:[a-z0-9-]+\/)+\d{4}\/[a-z]{3}\/\d{1,2}\/[a-z0-9-]{6,}$/],
  ],
]);

/** Date-based article paths, either numeric or three-letter month. */
const GENERIC_DATE_PATH = [/\/\d{4}\/\d{2}\/\d{2}\//, /\/\d{4}\/[a-z]{3}\/\d{1,2}\//];

const GENERIC_SLUG_MIN_LENGTH = 30;
const GENERIC_SLUG_MIN_HYPHENS = 3;
const GENERIC_ID_PATTERN = /\d{7,}/;

/**
 * Fallback for a host with no rule of its own: a date path, a long hyphenated
 * story slug, or a long numeric id in the final segment.
 */
function matchesGenericArticleShape(pathname: string): boolean {
  const withTrailingSlash = `${pathname}/`;
  if (GENERIC_DATE_PATH.some((pattern) => pattern.test(withTrailingSlash))) return true;

  const finalSegment = pathname.split("/").filter(Boolean).at(-1) ?? "";

  const isLongSlug =
    finalSegment.length >= GENERIC_SLUG_MIN_LENGTH &&
    (finalSegment.match(/-/g)?.length ?? 0) >= GENERIC_SLUG_MIN_HYPHENS;

  return isLongSlug || GENERIC_ID_PATTERN.test(finalSegment);
}

/**
 * `parser_strategy` when the source names one, else the registrable domain of
 * its `listing_url`. A name or host with no entry falls through to generic.
 */
function resolveRules(source: {
  listingUrl: string;
  parserStrategy: string | null;
}): readonly RegExp[] | null {
  if (source.parserStrategy) {
    const byStrategy = ARTICLE_URL_RULES.get(source.parserStrategy.toLowerCase());
    if (byStrategy) return byStrategy;
  }

  const host = registrableDomainOf(source.listingUrl);

  return host ? ARTICLE_URL_RULES.get(host) ?? null : null;
}

/**
 * Whether a homepage link looks like a real article detail URL for its source.
 * Checks run in order and the first failure wins, so the reported reason is the
 * most specific true statement about the URL.
 */
export function isArticleCandidate(
  candidateUrl: string,
  source: { listingUrl: string; parserStrategy: string | null },
): CandidateVerdict {
  // 1. Parseable and https.
  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return reject("not_article_url");
  }
  if (parsed.protocol !== "https:") return reject("not_article_url");

  // 2. Same registrable domain as the source — the fetch-scope guard.
  if (!sameSite(candidateUrl, source.listingUrl)) return reject("off_site");

  const pathname = pathnameOf(candidateUrl);
  if (pathname === null) return reject("not_article_url");

  // 3. Not the homepage and not the source's own listing path.
  const listingPath = pathnameOf(source.listingUrl);
  if (pathname === "/" || pathname === "") return reject("homepage_or_listing");
  if (listingPath !== null && pathname === listingPath) return reject("homepage_or_listing");

  // 4. §9's non-article reject list.
  if (hasRejectedPathSegment(pathname) !== null) return reject("reject_list_path");

  // 5. The resolved rule set, or the generic shape when the host has none.
  const rules = resolveRules(source);
  const accepted = rules
    ? rules.some((pattern) => pattern.test(pathname))
    : matchesGenericArticleShape(pathname);

  return accepted ? KEEP : reject("not_article_url");
}
