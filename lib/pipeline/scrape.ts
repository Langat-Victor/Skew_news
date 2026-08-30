import "server-only";

import { fetchPageHtml } from "@/lib/oxylabs/client";
import { parseArticle } from "@/lib/parsing/article";
import { isArticleCandidate } from "@/lib/parsing/candidate-url";
import { extractStoryLinks } from "@/lib/parsing/homepage-links";
import { articleSlug } from "@/lib/parsing/slug";
import { isFailureReason } from "@/lib/pipeline/types";
import type {
  RejectionReason,
  ScrapeInput,
  ScrapeSourceSummary,
  ScrapeSummary,
} from "@/lib/pipeline/types";
import { getExistingArticleUrls, insertArticles } from "@/lib/supabase/queries/articles";
import { insertLog } from "@/lib/supabase/queries/logs";
import { getActiveSources, getSourcesByNames } from "@/lib/supabase/queries/sources";
import type { ArticleInsert, SourceRow } from "@/lib/supabase/types";

/*
  The scrape-to-insert pipeline (AGENTS.md §9), on demand (§16).

  §9's nine steps run here and nowhere else. §18's Scheduler will reuse this same
  orchestration with one difference — homepage HTML arriving from a completed
  Oxylabs job instead of a live fetch — which is why validation, cleanup, dedupe,
  and logging all live behind the parsing and query layers rather than inline.

  Nothing in this module talks to a browser: it is imported only by the route
  handler, and `import "server-only"` makes a client import a build error.
*/

/** §16's stated default: 5 valid articles per source. */
const DEFAULT_PER_SOURCE_LIMIT = 5;

/** Detail pages fetched at once — enough to keep a run short, few enough to be polite. */
const DETAIL_BATCH_SIZE = 3;

/**
 * A source with a hostile homepage must not consume the whole run, so attempts
 * are capped (decision 19). When the cap truncates the candidate list that is
 * logged: a silent cap reads as "covered everything" when it did not.
 */
const ATTEMPT_MULTIPLIER = 3;
const ATTEMPT_FLOOR = 6;

export function tally(counts: Record<string, number>, reason: RejectionReason): void {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

export function mergeCounts(into: Record<string, number>, from: Record<string, number>): void {
  for (const [reason, count] of Object.entries(from)) {
    into[reason] = (into[reason] ?? 0) + count;
  }
}

export function emptySourceSummary(source: SourceRow): ScrapeSourceSummary {
  return {
    source: source.name,
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    articlesInserted: 0,
    articlesRejected: 0,
    articlesFailed: 0,
    attemptCapReached: false,
    rejectionReasons: {},
    error: null,
  };
}

/**
 * Maps an Oxylabs transport failure onto §9's rejection vocabulary. These are all
 * "could not assess the page" reasons, which §9 counts as failures rather than
 * rejections (decision 21).
 */
function reasonForOxylabsFailure(
  reason: "auth" | "rate_limited" | "oxylabs_error" | "bad_envelope" | "target_status" | "timeout" | "network",
): RejectionReason {
  switch (reason) {
    case "auth":
      return "oxylabs_auth";
    case "rate_limited":
      return "oxylabs_rate_limited";
    case "bad_envelope":
      return "bad_response_envelope";
    case "target_status":
      return "target_status_not_200";
    case "timeout":
      return "oxylabs_timeout";
    case "network":
      return "oxylabs_network";
    default:
      return "oxylabs_error";
  }
}

/** Steps 3–8 of §9 for one source, given its homepage HTML. */
export async function processSource(
  source: SourceRow,
  html: string,
  perSourceLimit: number,
): Promise<ScrapeSourceSummary> {
  const summary = emptySourceSummary(source);

  // Step 3 — candidate links from visible homepage story cards only (§11).
  const links = extractStoryLinks(html, source);
  summary.candidatesFound = links.length;
  console.log(`[scrape] ${source.name}: ${links.length} candidate links found`);

  // Step 4 — reject anything on the non-article reject list before detail scraping.
  const preRejections: Record<string, number> = {};
  const kept: string[] = [];

  for (const link of links) {
    const verdict = isArticleCandidate(link, {
      listingUrl: source.listing_url,
      parserStrategy: source.parser_strategy,
    });

    if (verdict.keep) {
      kept.push(link);
      continue;
    }

    summary.candidatesRejected += 1;
    tally(preRejections, verdict.reason);
    tally(summary.rejectionReasons, verdict.reason);
  }

  console.log(
    `[scrape] ${source.name}: ${summary.candidatesRejected} candidates rejected before detail scrape`,
    preRejections,
  );

  // Step 5 — skip URLs already stored (§9's chunked URL existence check).
  const existing = await getExistingArticleUrls(kept);
  const fresh = kept.filter((url) => {
    if (!existing.has(url)) return true;

    summary.duplicatesSkipped += 1;
    tally(summary.rejectionReasons, "duplicate");
    return false;
  });

  console.log(
    `[scrape] ${source.name}: ${summary.duplicatesSkipped} duplicates skipped, ${fresh.length} to try`,
  );

  const attemptCap = Math.max(perSourceLimit * ATTEMPT_MULTIPLIER, ATTEMPT_FLOOR);
  const queue = fresh.slice(0, attemptCap);

  if (fresh.length > queue.length) {
    summary.attemptCapReached = true;
    console.log(
      `[scrape] ${source.name}: attempt cap reached — ${fresh.length - queue.length} candidates not tried (cap ${attemptCap})`,
    );
  }

  // Step 6 — scrape only article detail pages, in small batches, never fetching a
  // page there is no remaining slot for.
  let cursor = 0;

  while (summary.articlesInserted < perSourceLimit && cursor < queue.length) {
    const batchSize = Math.min(DETAIL_BATCH_SIZE, perSourceLimit - summary.articlesInserted);
    const batch = queue.slice(cursor, cursor + batchSize);
    cursor += batch.length;

    const fetched = await Promise.all(
      batch.map(async (url) => ({ url, result: await fetchPageHtml(url, { render: false }) })),
    );

    for (const { url, result } of fetched) {
      if (!result.ok) {
        const reason = reasonForOxylabsFailure(result.reason);
        summary.articlesFailed += 1;
        tally(summary.rejectionReasons, reason);
        console.warn(`[scrape] ${source.name}: fetch failed (${reason}) ${url} — ${result.detail}`);
        continue;
      }

      summary.detailPagesScraped += 1;

      // Step 7 — validate and clean the detail page (§13).
      const parsed = parseArticle(result.html, url);

      if (!parsed.ok) {
        if (isFailureReason(parsed.reason)) summary.articlesFailed += 1;
        else summary.articlesRejected += 1;

        tally(summary.rejectionReasons, parsed.reason);
        console.log(
          `[scrape] ${source.name}: rejected after validation (${parsed.reason}${parsed.detail ? `: ${parsed.detail}` : ""}) ${url}`,
        );
        continue;
      }

      const { article } = parsed;

      // Second dedupe pass (decision 20): the canonical URL is only knowable
      // once the page is fetched, and outlets serve one story under several URLs.
      if (article.canonicalUrl !== null && article.canonicalUrl !== url) {
        const canonicalExisting = await getExistingArticleUrls([article.canonicalUrl]);

        if (canonicalExisting.has(article.canonicalUrl)) {
          summary.duplicatesSkipped += 1;
          tally(summary.rejectionReasons, "duplicate");
          console.log(`[scrape] ${source.name}: duplicate canonical skipped ${article.canonicalUrl}`);
          continue;
        }
      }

      // Step 8 — insert, append-only. One row at a time (decision 17) so a single
      // constraint violation cannot reject the valid articles beside it.
      const row: ArticleInsert = {
        source_id: source.id,
        // Already normalised: `extractStoryLinks` returns `normalizeUrl` output,
        // which is what makes this a stable dedupe key (§10).
        original_url: url,
        canonical_url: article.canonicalUrl,
        slug: articleSlug(article.title, url),
        title: article.title,
        image_url: article.imageUrl,
        published_at: article.publishedAt,
        // This exact separator is what `toParagraphs()` splits on, so the details
        // page renders real paragraphs instead of one wall of text (decision 12).
        raw_text: article.paragraphs.join("\n\n"),
        category: article.category,
        // Article markup carries no honest country signal (decision 11).
        country: null,
        author: article.author,
      };

      const { inserted, error } = await insertArticles([row]);

      if (error !== null) {
        summary.articlesFailed += 1;
        tally(summary.rejectionReasons, "insert_failed");
        console.error(`[scrape] ${source.name}: insert failed ${url} — ${error}`);
        continue;
      }

      if (inserted === 1) {
        summary.articlesInserted += 1;
        console.log(`[scrape] ${source.name}: inserted "${article.title}" ${url}`);
        continue;
      }

      // Upserted nothing and reported no error: another run stored it first.
      summary.duplicatesSkipped += 1;
      tally(summary.rejectionReasons, "duplicate");
      console.log(`[scrape] ${source.name}: duplicate skipped on insert ${url}`);
    }
  }

  return summary;
}

/**
 * Runs §9's scrape-to-insert pipeline over the selected sources and returns the
 * summary object §9 requires at the end of every run.
 *
 * Sources run sequentially and detail pages in small parallel batches
 * (decision 18). A source-level failure is recorded and the run continues
 * (decision 22).
 */
export async function runScrape(input: ScrapeInput): Promise<ScrapeSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  const perSourceLimit = input.perSourceLimit ?? DEFAULT_PER_SOURCE_LIMIT;
  const requestedNames = input.sourceNames ?? [];

  // Step 1 — load the selected active sources (§8). Never invent a source.
  const sources =
    requestedNames.length > 0 ? await getSourcesByNames(requestedNames) : await getActiveSources();

  const resolvedNames = new Set(sources.map((source) => source.name));
  const unknownSources = requestedNames.filter((name) => !resolvedNames.has(name));

  console.log(
    `[scrape] started — ${sources.length} source(s), ${perSourceLimit} article(s) per source`,
  );
  console.log(`[scrape] selected sources: ${sources.map((source) => source.name).join(", ") || "none"}`);
  if (unknownSources.length > 0) {
    console.warn(`[scrape] unknown source name(s) ignored: ${unknownSources.join(", ")}`);
  }

  await insertLog({
    level: "info",
    event: "scrape.started",
    message: `Scrape started for ${sources.length} source(s)`,
    context: {
      sources: sources.map((source) => source.name),
      perSourceLimit,
      unknownSources,
    },
  });

  const summaries: ScrapeSourceSummary[] = [];
  const errors: { source: string; message: string }[] = [];

  for (const source of sources) {
    console.log(`[scrape] ${source.name}: starting — ${source.listing_url}`);

    const summary = emptySourceSummary(source);

    // Step 2 — the homepage, rendered (decision 5). §18 will supply this HTML
    // from a completed Oxylabs job instead; everything after it is shared.
    const homepage = await fetchPageHtml(source.listing_url, { render: true });

    if (!homepage.ok) {
      const message = `homepage fetch failed (${homepage.reason}): ${homepage.detail}`;

      summary.error = message;
      summary.articlesFailed += 1;
      tally(summary.rejectionReasons, reasonForOxylabsFailure(homepage.reason));
      summaries.push(summary);
      errors.push({ source: source.name, message });

      console.error(`[scrape] ${source.name}: ${message}`);
      await insertLog({
        level: "error",
        event: "scrape.source.failed",
        message,
        source_id: source.id,
        context: { listingUrl: source.listing_url, reason: homepage.reason },
      });

      continue;
    }

    console.log(`[scrape] ${source.name}: homepage fetched (${homepage.html.length} bytes)`);

    try {
      const processed = await processSource(source, homepage.html, perSourceLimit);
      summaries.push(processed);

      console.log(
        `[scrape] ${source.name}: completed — ${processed.articlesInserted} inserted, ${processed.articlesRejected} rejected, ${processed.articlesFailed} failed`,
      );

      await insertLog({
        level: processed.articlesFailed > 0 ? "warn" : "info",
        event: "scrape.source.completed",
        message: `${processed.articlesInserted} article(s) inserted from ${source.name}`,
        source_id: source.id,
        context: {
          candidatesFound: processed.candidatesFound,
          candidatesRejected: processed.candidatesRejected,
          duplicatesSkipped: processed.duplicatesSkipped,
          detailPagesScraped: processed.detailPagesScraped,
          articlesInserted: processed.articlesInserted,
          articlesRejected: processed.articlesRejected,
          articlesFailed: processed.articlesFailed,
          attemptCapReached: processed.attemptCapReached,
          rejectionReasons: processed.rejectionReasons,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown source error";

      summary.error = message;
      summaries.push(summary);
      errors.push({ source: source.name, message });

      console.error(`[scrape] ${source.name}: source error — ${message}`);
      await insertLog({
        level: "error",
        event: "scrape.source.failed",
        message,
        source_id: source.id,
        context: { listingUrl: source.listing_url },
      });
    }
  }

  if (sources.length === 0) {
    const message =
      requestedNames.length > 0
        ? `No active source matched: ${requestedNames.join(", ")}`
        : "No active sources are configured";

    errors.push({ source: "-", message });
  }

  const rejectionReasons: Record<string, number> = {};
  for (const summary of summaries) mergeCounts(rejectionReasons, summary.rejectionReasons);

  const finishedAtMs = Date.now();

  const summary: ScrapeSummary = {
    // `failed` is reserved for a run that resolved no sources at all
    // (decision 22); one bad source among several is `completed_with_errors`.
    status: sources.length === 0 ? "failed" : errors.length > 0 ? "completed_with_errors" : "completed",
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    totalDurationMs: finishedAtMs - startedAtMs,
    sourcesChecked: sources.length,
    unknownSources,
    perSourceLimit,
    candidatesFound: summaries.reduce((total, item) => total + item.candidatesFound, 0),
    candidatesRejected: summaries.reduce((total, item) => total + item.candidatesRejected, 0),
    duplicatesSkipped: summaries.reduce((total, item) => total + item.duplicatesSkipped, 0),
    detailPagesScraped: summaries.reduce((total, item) => total + item.detailPagesScraped, 0),
    articlesInserted: summaries.reduce((total, item) => total + item.articlesInserted, 0),
    articlesRejected: summaries.reduce((total, item) => total + item.articlesRejected, 0),
    articlesFailed: summaries.reduce((total, item) => total + item.articlesFailed, 0),
    rejectionReasons,
    sources: summaries,
    errors,
  };

  console.log(`[scrape] ${summary.status === "failed" ? "failed" : "completed"} in ${summary.totalDurationMs}ms`);
  console.log("[scrape] summary", summary);

  await insertLog({
    level: summary.status === "completed" ? "info" : summary.status === "failed" ? "error" : "warn",
    event: summary.status === "failed" ? "scrape.failed" : "scrape.completed",
    message: `${summary.articlesInserted} article(s) inserted from ${summary.sourcesChecked} source(s)`,
    context: {
      status: summary.status,
      totalDurationMs: summary.totalDurationMs,
      sourcesChecked: summary.sourcesChecked,
      candidatesFound: summary.candidatesFound,
      candidatesRejected: summary.candidatesRejected,
      duplicatesSkipped: summary.duplicatesSkipped,
      detailPagesScraped: summary.detailPagesScraped,
      articlesInserted: summary.articlesInserted,
      articlesRejected: summary.articlesRejected,
      articlesFailed: summary.articlesFailed,
      rejectionReasons: summary.rejectionReasons,
      errors: summary.errors,
    },
  });

  return summary;
}
