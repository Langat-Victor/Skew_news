/*
  Typed pipeline results (AGENTS.md §5, §9, §21).

  Pure types plus one small helper, no side effects and no environment access, so
  this module is safe to import from either the pipeline or the parsing layer.
  The parsing modules depend on `RejectionReason` and nothing else here.
*/

/**
 * Every reason a candidate URL or a fetched page can be dropped, as one closed
 * union. §9's run logging groups rejections by count, and a closed union is what
 * makes that tally exhaustive rather than a free-form string bag.
 */
export type RejectionReason =
  // Candidate URL filtering (§11, §12)
  | "off_site"
  | "reject_list_path"
  | "not_article_url"
  | "homepage_or_listing"
  | "duplicate"
  // Oxylabs transport (§9 step 6) — could not assess the page at all
  | "oxylabs_auth"
  | "oxylabs_rate_limited"
  | "oxylabs_error"
  | "oxylabs_timeout"
  | "oxylabs_network"
  | "bad_response_envelope"
  | "target_status_not_200"
  // Article validation (§13) — assessed the page and it failed the gate
  | "missing_title"
  | "generic_title"
  | "missing_image"
  | "missing_published_date"
  | "invalid_published_date"
  | "canonical_is_listing"
  | "body_too_thin"
  | "body_mostly_headlines"
  | "no_clear_subject"
  // Storage
  | "insert_failed";

/**
 * Reasons that mean "we could not assess this page", as opposed to "we assessed
 * it and it is not an article". §9's summary keeps `articlesFailed` and
 * `articlesRejected` in separate columns for exactly this distinction — an
 * expired Oxylabs credential must never read as "the sites had no good
 * articles".
 */
const FAILURE_REASONS: ReadonlySet<RejectionReason> = new Set([
  "oxylabs_auth",
  "oxylabs_rate_limited",
  "oxylabs_error",
  "oxylabs_timeout",
  "oxylabs_network",
  "bad_response_envelope",
  "target_status_not_200",
  "insert_failed",
]);

export function isFailureReason(reason: RejectionReason): boolean {
  return FAILURE_REASONS.has(reason);
}

/** What `POST /api/scrape` may ask for (§8, §16). Both fields optional. */
export type ScrapeInput = {
  /** Source names as stored in `sources.name`. Omitted = all active sources. */
  sourceNames?: string[];
  /** Valid articles to insert per source. Omitted = `DEFAULT_PER_SOURCE_LIMIT`. */
  perSourceLimit?: number;
};

export type ScrapeSourceSummary = {
  source: string;
  listingUrl: string;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  /** True when the attempt cap truncated the candidate list (§9: no silent caps). */
  attemptCapReached: boolean;
  rejectionReasons: Record<string, number>;
  error: string | null;
};

/**
 * The summary object §9 requires at the end of every run, and §16 requires in the
 * `POST /api/scrape` response body.
 *
 * `completed_with_errors` means at least one source failed but others finished;
 * `failed` is reserved for a run that resolved no sources at all (decision 22).
 */
export type ScrapeSummary = {
  status: "completed" | "completed_with_errors" | "failed";
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  sourcesChecked: number;
  /** Requested names that matched no active source. Never invented (§8). */
  unknownSources: string[];
  perSourceLimit: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  rejectionReasons: Record<string, number>;
  sources: ScrapeSourceSummary[];
  errors: { source: string; message: string }[];
};
