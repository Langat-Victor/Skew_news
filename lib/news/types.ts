import type { BiasBreakdown } from "@/components/ui/bias-meter";
import type { BiasLabel, SentimentLabel } from "@/lib/news/labels";

/*
  View models: what a page hands to a component, after the query layer has joined
  `articles` + `sources` + `article_analyses` and pre-formatted the display
  strings.

  Every field here is backed by a stored column. Where a column is nullable, the
  field is optional and the component omits it rather than filling in a guess —
  `articles.category`, `country`, and `author` are all nullable because the
  scraper cannot always determine them.

  `sourceCount` from the retired mock is absent on purpose: one row is one
  article from one source, and nothing in the schema counts outlets covering a
  story. See prompts/supabase-database-and-data-access.md, decisions 16–18.
*/

/** One home-page card (AGENTS.md §19's required card fields). */
export type FeedArticle = {
  /** Public identity — the card links to `/news/{slug}`. */
  slug: string;
  title: string;
  /** `articles.category`, or a generic label when the column is null. */
  category: string;
  country?: string;
  /** Set only when the stored image host is optimisable (lib/news/image-hosts.ts). */
  imageUrl?: string;
  sourceName: string;
  /** Pre-formatted, e.g. `Aug 26, 2026`. */
  publishedAt: string;
  bias: BiasBreakdown;
  /** `article_analyses.bias_label` — the model's own AI-estimated framing (§19). */
  biasLabel: BiasLabel;
  sentimentLabel: SentimentLabel;
  /** 0…1 */
  confidence: number;
};

/** A related-story item in the details-page rail. */
export type RelatedStory = {
  title: string;
  category: string;
  country?: string;
  /** Pre-formatted for display, e.g. `Aug 26, 2026`. */
  publishedAt: string;
  readingTime: string;
  imageUrl?: string;
  /** Absent renders an inert card rather than a dead link. */
  slug?: string;
};

/** The stored analysis, formatted for the details-page panels (§19). */
export type ArticleAnalysisView = {
  /** `article_analyses.summary`, split into bullets. */
  summary: string[];
  /** Pre-formatted `article_analyses.created_at`. */
  generatedAt: string;
  /** Derived from the summary's own length. */
  readingTime: string;
  bias: BiasBreakdown;
  /** The model's own label — not the derived heading in `overallBiasFor`. */
  biasLabel: BiasLabel;
  sentimentLabel: SentimentLabel;
  /** −1…1 */
  sentimentScore: number;
  /** 0…1 */
  confidence: number;
  framingNotes: string;
  loadedTerms: string[];
  disclaimer: string;
  embedding?: string | number[] | null;
};

export type ArticleDetailView = {
  id: string;
  slug: string;
  title: string;
  category: string;
  country?: string;
  /** Raw `articles.category` (null included) — the key for related lookups. */
  categoryKey: string | null;
  imageUrl?: string;
  /** `articles.original_url` — the attribution link on the source panel. */
  originalUrl: string;
  author?: string;
  publishedAt: string;
  readingTime: string;
  /** `articles.raw_text`, split into display paragraphs. */
  paragraphs: string[];
  source: {
    name: string;
    logoUrl?: string;
  };
  analysis: ArticleAnalysisView;
};

/**
 * One row of `articles_pending_analysis` (§19.1) — an article with no
 * `article_analyses` row, regardless of what `analyzed_at` says.
 */
export type PendingArticleRow = {
  id: string;
  slug: string;
  title: string;
  sourceName?: string;
  originalUrl: string;
  rawText: string;
  publishedAt: string;
  scrapedAt: string;
};
