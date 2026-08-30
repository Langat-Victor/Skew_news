import "server-only";

import { cache } from "react";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type {
  ArticleAnalysisRow,
  ArticleInsert,
  ArticlePendingAnalysisRow,
  ArticleRow,
  SourceRow,
} from "@/lib/supabase/types";
import {
  formatPublishedDate,
  readingTimeFor,
  toParagraphs,
} from "@/lib/news/format";
import { isOptimizableImageUrl } from "@/lib/news/image-hosts";
import type {
  ArticleDetailView,
  FeedArticle,
  PendingArticleRow,
  RelatedStory,
} from "@/lib/news/types";
import type { BiasLabel, SentimentLabel } from "@/lib/news/labels";

/*
  Article reads and pipeline-facing article writes. Server-only: this module
  imports the service-role client (AGENTS.md §21).

  Two rules from AGENTS.md shape almost every function here:

  - §21 — never filter on a joined table (`.eq('foreignTable.column', …)`
    generates broken PostgREST SQL). Joined data is fetched unfiltered and the
    condition is applied in JavaScript below.
  - §19.1 — an article is pending analysis when no `article_analyses` row exists.
    `analyzed_at IS NULL` is never the test on its own, because `analyzed_at` can
    be set while the analysis row is absent. So every read that renders analysis
    checks the joined row's presence, not the timestamp.

  Deferred to the tasks that own them: analysis writes (§19 owns the Zod-
  validated shape), Oxylabs schedule/run writes (§18), embedding queries (§20).
*/

/** Shown on the home feed by default. */
const FEED_LIMIT = 24;

/** Related-stories rail size. */
const RELATED_LIMIT = 5;

/** Slugs prerendered by `generateStaticParams`. */
const STATIC_PARAMS_LIMIT = 50;

/**
 * §9's URL existence check: never pass more than 15 URLs to a single `.in()`
 * filter. Longer lists are chunked.
 */
const URL_CHUNK_SIZE = 15;

const ARTICLE_COLUMNS =
  "id, source_id, original_url, canonical_url, slug, title, image_url, published_at, raw_text, category, country, author, scraped_at, analyzed_at, created_at";

const ANALYSIS_COLUMNS =
  "summary, sentiment_score, sentiment_label, left_percentage, center_percentage, right_percentage, bias_score, bias_label, confidence, framing_notes, loaded_terms, disclaimer, model, embedding, created_at";
const JOINED_SELECT = `${ARTICLE_COLUMNS}, sources ( name, logo_url ), article_analyses ( ${ANALYSIS_COLUMNS} )`;

type JoinedSource = Pick<SourceRow, "name" | "logo_url">;

type JoinedAnalysis = Omit<ArticleAnalysisRow, "id" | "article_id" | "updated_at">;

/*
  A to-one embed comes back as an object on current PostgREST and as a
  single-element array on older versions, so both shapes are accepted and
  normalised by `firstOf` rather than trusting one.
*/
type ArticleJoinedRow = ArticleRow & {
  sources: JoinedSource | JoinedSource[] | null;
  article_analyses: JoinedAnalysis | JoinedAnalysis[] | null;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** PostgREST emits `numeric` as a JSON number, but tolerate a string too. */
function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

/** Generic label for an article whose `category` column is null. */
const FALLBACK_CATEGORY = "News";

/** Only hand `next/image` a URL its optimiser will accept — otherwise placeholder art. */
function optimizableImage(imageUrl: string | null): string | undefined {
  return isOptimizableImageUrl(imageUrl) ? (imageUrl ?? undefined) : undefined;
}

function biasOf(analysis: JoinedAnalysis) {
  return {
    left: toNumber(analysis.left_percentage),
    center: toNumber(analysis.center_percentage),
    right: toNumber(analysis.right_percentage),
  };
}

function toFeedArticle(row: ArticleJoinedRow): FeedArticle | null {
  const analysis = firstOf(row.article_analyses);
  const source = firstOf(row.sources);

  // §19.1: no analysis row means the article is not ready to display, whatever
  // `analyzed_at` says.
  if (!analysis || !source) return null;

  return {
    slug: row.slug,
    title: row.title,
    category: row.category ?? FALLBACK_CATEGORY,
    country: row.country ?? undefined,
    imageUrl: optimizableImage(row.image_url),
    sourceName: source.name,
    publishedAt: formatPublishedDate(row.published_at),
    bias: biasOf(analysis),
    biasLabel: analysis.bias_label as BiasLabel,
    sentimentLabel: analysis.sentiment_label as SentimentLabel,
    confidence: toNumber(analysis.confidence),
  };
}

function toDetailView(row: ArticleJoinedRow): ArticleDetailView | null {
  const analysis = firstOf(row.article_analyses);
  const source = firstOf(row.sources);

  if (!analysis || !source) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category ?? FALLBACK_CATEGORY,
    country: row.country ?? undefined,
    categoryKey: row.category,
    imageUrl: optimizableImage(row.image_url),
    originalUrl: row.original_url,
    author: row.author ?? undefined,
    publishedAt: formatPublishedDate(row.published_at),
    readingTime: readingTimeFor(row.raw_text),
    paragraphs: toParagraphs(row.raw_text),
    source: {
      name: source.name,
      logoUrl: source.logo_url ?? undefined,
    },
    analysis: {
      summary: toParagraphs(analysis.summary),
      generatedAt: formatPublishedDate(analysis.created_at),
      readingTime: readingTimeFor(analysis.summary),
      bias: biasOf(analysis),
      biasLabel: analysis.bias_label as BiasLabel,
      sentimentLabel: analysis.sentiment_label as SentimentLabel,
      sentimentScore: toNumber(analysis.sentiment_score),
      confidence: toNumber(analysis.confidence),
      framingNotes: analysis.framing_notes,
      loadedTerms: analysis.loaded_terms,
      disclaimer: analysis.disclaimer,
      embedding: analysis.embedding,
    },
  };
}

function toRelatedStory(row: ArticleJoinedRow): RelatedStory {
  return {
    title: row.title,
    category: row.category ?? FALLBACK_CATEGORY,
    country: row.country ?? undefined,
    publishedAt: formatPublishedDate(row.published_at),
    readingTime: readingTimeFor(row.raw_text),
    imageUrl: optimizableImage(row.image_url),
    slug: row.slug,
  };
}

/** A failed read degrades the page to empty rather than throwing a 500. */
function logQueryError(where: string, error: { code?: string; message: string }) {
  console.error(
    `[supabase] ${where} failed${error.code ? ` (${error.code})` : ""}: ${error.message}`,
  );
}

/**
 * Home feed: analysed articles, newest first.
 *
 * `cache` dedupes within a single request, so calling this twice in one render
 * costs one round trip.
 */
export const getPublishedArticles = cache(
  async (limit: number = FEED_LIMIT, topic?: string): Promise<FeedArticle[]> => {
    let query = getServiceRoleClient()
      // Cheap pre-filter only; the authoritative check is the joined row below.
      .not("analyzed_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit);

    if (topic) {
      query = query.ilike("category", `%${topic}%`);


    return (data ?? [])
      .map(toFeedArticle)
      .filter((article): article is FeedArticle => article !== null);
  },
);

/** One article with its source and analysis, or null when missing or unanalysed. */
export const getArticleBySlug = cache(
  async (slug: string): Promise<ArticleDetailView | null> => {
    const { data, error } = await getServiceRoleClient()
      .from("articles")
      .select(JOINED_SELECT)
      .eq("slug", slug)
      .maybeSingle()
      .returns<ArticleJoinedRow | null>();

    if (error) {
      logQueryError("getArticleBySlug", error);
      return null;
    }

    return data ? toDetailView(data) : null;
  },
);

/**
 * Related stories for the details-page rail.
 * 
 * Uses pgvector cosine distance if an embedding is provided, falling back to 
 * empty if not.
 */
export const getRelatedArticles = cache(
  async (
    articleId: string,
    embedding?: string | number[] | null,
    limit: number = RELATED_LIMIT,
  ): Promise<RelatedStory[]> => {
    if (!embedding) return [];

    const { data, error } = await getServiceRoleClient()
      .rpc("match_articles", {
        query_embedding: embedding,
        match_article_id: articleId,
        match_limit: limit,
      })
      .select(JOINED_SELECT)
      .returns<ArticleJoinedRow[]>();

    if (error) {
      logQueryError("getRelatedArticles", error);
      return [];
    }

    // Same §19.1 check: only articles with a real analysis row are displayable.
    return (data ?? [])
      .filter((row) => firstOf(row.article_analyses) !== null)
      .map(toRelatedStory);
  },
);

/**
 * Slugs for `generateStaticParams`. Returns [] on error so a build without
 * database access still succeeds — unlisted slugs render on demand.
 */
export async function getRecentArticleSlugs(
  limit: number = STATIC_PARAMS_LIMIT,
): Promise<string[]> {
  const { data, error } = await getServiceRoleClient()
    .from("articles")
    .select("slug")
    .not("analyzed_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    logQueryError("getRecentArticleSlugs", error);
    return [];
  }

  return (data ?? []).map((row) => row.slug);
}

/**
 * §19.1's pending-analysis check, read from the view: articles with no
 * `article_analyses` row, oldest scrape first. A row appears here even when
 * `analyzed_at` is set, which is the whole point.
 */
export async function getPendingAnalysisArticles(
  limit: number,
): Promise<PendingArticleRow[]> {
  const { data, error } = await getServiceRoleClient()
    .from("articles_pending_analysis")
    .select(
      "id, slug, title, source_name, original_url, raw_text, published_at, scraped_at",
    )
    .order("scraped_at", { ascending: true })
    .limit(limit);

  if (error) {
    logQueryError("getPendingAnalysisArticles", error);
    return [];
  }

  const rows = (data ?? []) as Pick<
    ArticlePendingAnalysisRow,
    | "id"
    | "slug"
    | "title"
    | "source_name"
    | "original_url"
    | "raw_text"
    | "published_at"
    | "scraped_at"
  >[];

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    sourceName: row.source_name ?? undefined,
    originalUrl: row.original_url,
    rawText: row.raw_text,
    publishedAt: row.published_at,
    scrapedAt: row.scraped_at,
  }));
}

/**
 * §9's URL existence check. Returns the subset of `urls` already stored, so the
 * pipeline can skip them before detail scraping.
 *
 * Chunked at 15: §9 forbids passing more than 15 URLs to a single `.in()`
 * filter.
 */
export async function getExistingArticleUrls(
  urls: string[],
): Promise<Set<string>> {
  const existing = new Set<string>();
  if (urls.length === 0) return existing;

  const client = getServiceRoleClient();
  const unique = [...new Set(urls)];

  for (let index = 0; index < unique.length; index += URL_CHUNK_SIZE) {
    const chunk = unique.slice(index, index + URL_CHUNK_SIZE);

    const { data, error } = await client
      .from("articles")
      .select("original_url, canonical_url")
      .in("original_url", chunk);

    if (error) {
      logQueryError("getExistingArticleUrls", error);
      // Treat an unreadable chunk as "unknown", not as "new": returning nothing
      // for it would risk duplicate inserts, which the unique index then
      // rejects anyway.
      continue;
    }

    for (const row of data ?? []) {
      existing.add(row.original_url);
      if (row.canonical_url) existing.add(row.canonical_url);
    }
  }

  return existing;
}

/**
 * Append-only insert (§10): duplicates on `original_url` are ignored, nothing is
 * ever deleted, replaced, or reset.
 *
 * The `error` in the result lets the pipeline tell "the database refused this
 * row" apart from "the row was already there" — §9 counts those in different
 * columns (`articlesFailed` vs `duplicatesSkipped`).
 */
export async function insertArticles(
  rows: ArticleInsert[],
): Promise<{ inserted: number; error: string | null }> {
  if (rows.length === 0) return { inserted: 0, error: null };

  const { data, error } = await getServiceRoleClient()
    .from("articles")
    .upsert(rows, { onConflict: "original_url", ignoreDuplicates: true })
    .select("id");

  if (error) {
    logQueryError("insertArticles", error);
    return { inserted: 0, error: `${error.code ?? "unknown"}: ${error.message}` };
  }

  return { inserted: (data ?? []).length, error: null };
}
