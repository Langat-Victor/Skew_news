/*
  Hand-written mirror of supabase/schema.sql. There is no Supabase CLI or MCP
  server in this project, so types cannot be generated — when a column changes,
  edit schema.sql, run the ALTER in the Dashboard SQL Editor, and update this
  file (AGENTS.md §7).

  This module is pure types with no runtime, so it is safe to import anywhere.
  The service-role CLIENT is a different matter — see lib/supabase/server.ts.

  Conventions:
  - `Insert` omits generated and defaulted columns, so a caller cannot send a
    value the database computes.
  - The narrow unions below mirror the CHECK constraints, so an invalid label is
    a type error before it is a 23514.
  - No `embedding` column: AGENTS.md §20 adds pgvector after analysis works.
  - Every shape here is a `type`, never an `interface`. postgrest-js requires each
    row to satisfy `Record<string, unknown>`, and only a type alias gets an
    implicit index signature — declaring these as interfaces makes the schema fail
    that constraint and every query result silently becomes `never`.
*/

export type SentimentLabelValue = "positive" | "neutral" | "negative";
export type BiasLabelValue = "left" | "center" | "right" | "mixed" | "unclear";
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Oxylabs `result_status` for a job inside a run (§18). */
export type OxylabsResultStatus = "done" | "pending" | "faulted";

export type SourceRow = {
  id: string;
  name: string;
  /** Homepage entry page only (§9). */
  listing_url: string;
  parser_strategy: string | null;
  is_active: boolean;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceInsert = {
  name: string;
  listing_url: string;
  parser_strategy?: string | null;
  is_active?: boolean;
  logo_url?: string | null;
};

export type ArticleRow = {
  id: string;
  source_id: string;
  original_url: string;
  canonical_url: string | null;
  slug: string;
  title: string;
  image_url: string;
  published_at: string;
  raw_text: string;
  category: string | null;
  country: string | null;
  author: string | null;
  scraped_at: string;
  /** Null until a valid analysis is saved (§19.6). Never the pending signal. */
  analyzed_at: string | null;
  created_at: string;
};

export type ArticleInsert = {
  source_id: string;
  original_url: string;
  canonical_url?: string | null;
  slug: string;
  title: string;
  /** Required before saving (§13). */
  image_url: string;
  /** Required before saving (§13). ISO 8601. */
  published_at: string;
  raw_text: string;
  category?: string | null;
  country?: string | null;
  author?: string | null;
  scraped_at?: string;
  analyzed_at?: string | null;
};

export type ArticleAnalysisRow = {
  id: string;
  article_id: string;
  summary: string;
  sentiment_score: number;
  sentiment_label: SentimentLabelValue;
  left_percentage: number;
  center_percentage: number;
  right_percentage: number;
  /** Generated stored column: (right − left) / 100 (§19). Read-only. */
  bias_score: number;
  bias_label: BiasLabelValue;
  confidence: number;
  framing_notes: string;
  loaded_terms: string[];
  disclaimer: string;
  model: string;
  embedding: string | null;
  created_at: string;
  updated_at: string;
};

/** `bias_score` is absent by design — the database derives it (§19). */
export type ArticleAnalysisInsert = {
  article_id: string;
  summary: string;
  sentiment_score: number;
  sentiment_label: SentimentLabelValue;
  left_percentage: number;
  center_percentage: number;
  right_percentage: number;
  bias_label: BiasLabelValue;
  confidence: number;
  framing_notes: string;
  loaded_terms?: string[];
  disclaimer: string;
  model: string;
  embedding?: string | number[] | null;
};

export type LogRow = {
  id: string;
  level: LogLevel;
  event: string;
  message: string | null;
  context: Record<string, unknown>;
  source_id: string | null;
  article_id: string | null;
  created_at: string;
};

export type LogInsert = {
  level: LogLevel;
  event: string;
  message?: string | null;
  context?: Record<string, unknown>;
  source_id?: string | null;
  article_id?: string | null;
};

export type OxylabsScheduleRow = {
  id: string;
  /** TEXT in the database — a 64-bit Oxylabs ID must never become a number (§18). */
  schedule_id: string;
  source_id: string;
  cron: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OxylabsScheduleInsert = {
  schedule_id: string;
  source_id: string;
  cron: string;
  is_active?: boolean;
  last_synced_at?: string | null;
};

export type OxylabsScheduleRunRow = {
  id: string;
  schedule_id: string;
  /** TEXT for the same precision reason as schedule_id (§18). */
  job_id: string;
  result_status: OxylabsResultStatus | null;
  processed_at: string | null;
  articles_inserted: number;
  created_at: string;
};

export type OxylabsScheduleRunInsert = {
  schedule_id: string;
  job_id: string;
  result_status?: OxylabsResultStatus | null;
  processed_at?: string | null;
  articles_inserted?: number;
};

/** Read-only projection of the articles_pending_analysis view (§19.1). */
export type ArticlePendingAnalysisRow = {
  id: string;
  source_id: string;
  source_name: string | null;
  slug: string;
  title: string;
  original_url: string;
  canonical_url: string | null;
  raw_text: string;
  published_at: string;
  scraped_at: string;
  analyzed_at: string | null;
};

/*
  supabase-js requires every table and view to declare its foreign keys: without
  a `Relationships` array the schema does not satisfy postgrest-js'
  `GenericSchema`, and every query result silently degrades to `never`.

  The `foreignKeyName` values are the constraint names Postgres derives from the
  inline `references` clauses in schema.sql (`<table>_<column>_fkey`), so
  PostgREST's `table!hint` syntax keeps working. `isOneToOne` is true wherever the
  referencing column is unique.
*/
export type Database = {
  public: {
    Tables: {
      sources: {
        Row: SourceRow;
        Insert: SourceInsert;
        Update: Partial<SourceInsert>;
        Relationships: [];
      };
      articles: {
        Row: ArticleRow;
        Insert: ArticleInsert;
        Update: Partial<ArticleInsert>;
        Relationships: [
          {
            foreignKeyName: "articles_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      article_analyses: {
        Row: ArticleAnalysisRow;
        Insert: ArticleAnalysisInsert;
        Update: Partial<ArticleAnalysisInsert>;
        Relationships: [
          {
            foreignKeyName: "article_analyses_article_id_fkey";
            columns: ["article_id"];
            // article_id is unique: at most one analysis per article.
            isOneToOne: true;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: LogRow;
        Insert: LogInsert;
        Update: Partial<LogInsert>;
        Relationships: [
          {
            foreignKeyName: "logs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "logs_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedules: {
        Row: OxylabsScheduleRow;
        Insert: OxylabsScheduleInsert;
        Update: Partial<OxylabsScheduleInsert>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedules_source_id_fkey";
            columns: ["source_id"];
            // One schedule per source.
            isOneToOne: true;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedule_runs: {
        Row: OxylabsScheduleRunRow;
        Insert: OxylabsScheduleRunInsert;
        Update: Partial<OxylabsScheduleRunInsert>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedule_runs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "oxylabs_schedules";
            referencedColumns: ["schedule_id"];
          },
        ];
      };
    };
    Views: {
      articles_pending_analysis: {
        Row: ArticlePendingAnalysisRow;
        // Read-only: no Insert/Update, and nothing embeds through it.
        Relationships: [];
      };
    };
    Functions: {
      match_articles: {
        Args: {
          query_embedding: string | number[];
          match_article_id: string;
          match_limit?: number;
        };
        Returns: ArticleRow[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
