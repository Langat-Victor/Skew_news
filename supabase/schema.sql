-- ============================================================================
-- SKEW news — canonical Supabase schema (AGENTS.md §7)
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. This project has no Supabase CLI and no MCP server, so the
-- Dashboard is the only path (§7). The file is idempotent: running it twice is
-- safe and is part of the acceptance criteria.
--
-- CHANGING A FIELD LATER: edit this file, then run the equivalent ALTER in the
-- SQL Editor and update lib/supabase/types.ts (§7). `create table if not
-- exists` will NOT retro-fit a column onto an existing table.
--
-- pgvector / `article_analyses.embedding` are deliberately ABSENT — §20 adds
-- them after AI analysis works.
-- ============================================================================

-- `gen_random_uuid()` is built into Postgres 13+ and is available on Supabase
-- without an extension. No `create extension` is needed here.
create extension if not exists vector;

-- ---------------------------------------------------------------- functions --

-- SECURITY INVOKER (never DEFINER — it would silently bypass RLS) with a pinned
-- empty search_path. `now()` resolves from pg_catalog, which is always implicit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function; take it back.
revoke execute on function public.set_updated_at() from public;

-- ------------------------------------------------------------------- tables --

-- Sources are homepage ENTRY PAGES only (§9). Never a category, section, or
-- sub-endpoint URL, and never hardcoded in scraping logic (§7).
create table if not exists public.sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  listing_url     text not null unique,
  -- Source-specific parser key, used when generic homepage extraction is not
  -- enough (§11). Null = generic strategy.
  parser_strategy text,
  -- Only active sources are scraped or scheduled (§8).
  is_active       boolean not null default true,
  logo_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Append-only during scraping (§10): no updated_at, no update trigger.
create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  -- restrict, not cascade: deleting a source must never silently delete stored
  -- articles.
  source_id     uuid not null references public.sources (id) on delete restrict,
  -- Dedupe keys (§10).
  original_url  text not null unique,
  canonical_url text,
  -- Public identity for /news/[slug]. Title-derived + short hash.
  slug          text not null unique constraint articles_slug_format
                  check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  title         text not null,
  -- image_url and published_at are mandatory before saving (§13) — the article
  -- content gate is enforced here as well as in the pipeline.
  image_url     text not null,
  published_at  timestamptz not null,
  raw_text      text not null constraint articles_raw_text_not_blank
                  check (length(btrim(raw_text)) > 0),
  -- Nullable: the scraper cannot always determine these.
  category      text,
  country       text,
  author        text,
  scraped_at    timestamptz not null default now(),
  -- Null until a valid analysis is saved (§19.6). Never trust it alone as the
  -- pending signal — see the articles_pending_analysis view below.
  analyzed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- One analysis per article (unique article_id) — keeps the pending check a
-- clean anti-join and the PostgREST embed to-one.
create table if not exists public.article_analyses (
  id                uuid primary key default gen_random_uuid(),
  article_id        uuid not null unique
                      references public.articles (id) on delete cascade,
  summary           text not null,
  sentiment_score   numeric(4,3) not null
                      constraint article_analyses_sentiment_score_range
                      check (sentiment_score between -1 and 1),
  sentiment_label   text not null
                      constraint article_analyses_sentiment_label_valid
                      check (sentiment_label in ('positive', 'neutral', 'negative')),
  left_percentage   smallint not null
                      constraint article_analyses_left_range
                      check (left_percentage between 0 and 100),
  center_percentage smallint not null
                      constraint article_analyses_center_range
                      check (center_percentage between 0 and 100),
  right_percentage  smallint not null
                      constraint article_analyses_right_range
                      check (right_percentage between 0 and 100),
  -- Derived, never sent by a client (§19). Generated so the definition cannot
  -- drift from the percentages it is derived from.
  bias_score        numeric(4,3)
                      generated always as
                      (((right_percentage - left_percentage)::numeric) / 100)
                      stored,
  bias_label        text not null
                      constraint article_analyses_bias_label_valid
                      check (bias_label in ('left', 'center', 'right', 'mixed', 'unclear')),
  confidence        numeric(4,3) not null
                      constraint article_analyses_confidence_range
                      check (confidence between 0 and 1),
  framing_notes     text not null,
  loaded_terms      text[] not null default '{}',
  disclaimer        text not null,
  model             text not null,
  embedding         vector(768),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- §19: the three framing percentages must add up to 100. Last line of
  -- defence behind Zod validation in the analysis route.
  constraint framing_percentages_sum_100
    check (left_percentage + center_percentage + right_percentage = 100)
);

-- Ensure the embedding column is retrofitted onto existing tables, 
-- as `create table if not exists` will not add it.
alter table public.article_analyses
  add column if not exists embedding vector(768);

-- Pipeline run logs (§9 run logging, §16). FKs are `set null` so a log line
-- outlives the row it describes.
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  level      text not null constraint logs_level_valid
               check (level in ('debug', 'info', 'warn', 'error')),
  -- Machine-readable event key, e.g. 'scrape.started', 'analyze.completed'.
  event      text not null,
  message    text,
  context    jsonb not null default '{}'::jsonb,
  source_id  uuid references public.sources (id) on delete set null,
  article_id uuid references public.articles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Oxylabs Scheduler mirror (§18).
--
-- schedule_id is TEXT, never bigint/numeric: Oxylabs IDs are 64-bit values that
-- exceed Number.MAX_SAFE_INTEGER, so they are read as raw strings from the HTTP
-- response text before any JSON.parse. Storing text keeps every digit exact.
create table if not exists public.oxylabs_schedules (
  id             uuid primary key default gen_random_uuid(),
  schedule_id    text not null unique,
  -- One schedule per source.
  source_id      uuid not null unique
                   references public.sources (id) on delete cascade,
  cron           text not null,
  is_active      boolean not null default true,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One row per Oxylabs job inside a schedule run. job_id is TEXT for the same
-- precision reason as schedule_id. result_status mirrors Oxylabs
-- ('done' | 'pending' | 'faulted'); only 'done' jobs may be fetched (§18).
create table if not exists public.oxylabs_schedule_runs (
  id                uuid primary key default gen_random_uuid(),
  schedule_id       text not null
                      references public.oxylabs_schedules (schedule_id)
                      on delete cascade,
  job_id            text not null,
  result_status     text,
  processed_at      timestamptz,
  articles_inserted integer not null default 0,
  created_at        timestamptz not null default now(),
  constraint oxylabs_schedule_runs_job_unique unique (schedule_id, job_id)
);

-- --------------------------------------------------------------------- view --

-- §19.1's pending-analysis check, as SQL.
--
-- A row appears here whenever no article_analyses row exists for the article —
-- EVEN IF articles.analyzed_at is set. That is the point: analyzed_at can be
-- set while the analysis row is absent (e.g. after a manual delete), so it must
-- never be the pending signal on its own.
--
-- security_invoker = true: views bypass RLS by default, which would make this a
-- hole straight through the base tables.
create or replace view public.articles_pending_analysis
with (security_invoker = true) as
select
  a.id,
  a.source_id,
  s.name as source_name,
  a.slug,
  a.title,
  a.original_url,
  a.canonical_url,
  a.raw_text,
  a.published_at,
  a.scraped_at,
  a.analyzed_at
from public.articles a
left join public.article_analyses an on an.article_id = a.id
left join public.sources s on s.id = a.source_id
where an.id is null;

-- ----------------------------------------------------------------- triggers --

drop trigger if exists sources_set_updated_at on public.sources;
create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

drop trigger if exists article_analyses_set_updated_at on public.article_analyses;
create trigger article_analyses_set_updated_at
  before update on public.article_analyses
  for each row execute function public.set_updated_at();

drop trigger if exists oxylabs_schedules_set_updated_at on public.oxylabs_schedules;
create trigger oxylabs_schedules_set_updated_at
  before update on public.oxylabs_schedules
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ indexes --

-- The home feed: analysed articles, newest first.
create index if not exists articles_published_analyzed_idx
  on public.articles (published_at desc)
  where analyzed_at is not null;

create index if not exists articles_source_id_idx
  on public.articles (source_id);

-- Related articles by category (§20 replaces this ordering with pgvector).
create index if not exists articles_category_published_idx
  on public.articles (category, published_at desc);

create index if not exists articles_scraped_at_idx
  on public.articles (scraped_at desc);

create index if not exists logs_created_at_idx
  on public.logs (created_at desc);

create index if not exists logs_level_idx
  on public.logs (level);

create index if not exists oxylabs_schedule_runs_schedule_idx
  on public.oxylabs_schedule_runs (schedule_id);

create index if not exists oxylabs_schedule_runs_unprocessed_idx
  on public.oxylabs_schedule_runs (processed_at)
  where processed_at is null;

-- article_analyses.article_id already has a unique index from its constraint.

create index if not exists article_analyses_embedding_idx
  on public.article_analyses
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ----------------------------------------------------------------- functions --

create or replace function public.match_articles(
  query_embedding vector(768),
  match_article_id uuid,
  match_limit int default 5
)
returns setof public.articles
language sql
security invoker
as $$
  select a.*
  from public.articles a
  join public.article_analyses an on an.article_id = a.id
  where an.embedding is not null
    and a.id != match_article_id
    and a.analyzed_at is not null
  order by an.embedding <=> query_embedding
  limit match_limit;
$$;

-- ----------------------------------------------------- RLS, grants, exposure --

-- Two independent layers, both required:
--   1. GRANTS decide whether a role can reach the table at all. Since the
--      2026-04-28 Data API change, new public-schema tables are not granted
--      automatically, so nothing here is left to chance.
--   2. RLS decides which rows a reachable table returns.
--
-- This app has NO browser-side database access: every read and write goes
-- through the server with the service-role key (§21). So anon/authenticated get
-- no grants and no policies, and service_role — which bypasses RLS — gets
-- everything.

alter table public.sources               enable row level security;
alter table public.articles              enable row level security;
alter table public.article_analyses      enable row level security;
alter table public.logs                  enable row level security;
alter table public.oxylabs_schedules     enable row level security;
alter table public.oxylabs_schedule_runs enable row level security;

-- Deliberately NO policies: default deny. If someone later exposes a table to
-- the Data API by mistake, there is still no policy to let a row through.

revoke all on public.sources               from anon, authenticated;
revoke all on public.articles              from anon, authenticated;
revoke all on public.article_analyses      from anon, authenticated;
revoke all on public.logs                  from anon, authenticated;
revoke all on public.oxylabs_schedules     from anon, authenticated;
revoke all on public.oxylabs_schedule_runs from anon, authenticated;
revoke all on public.articles_pending_analysis from anon, authenticated;

grant usage on schema public to service_role;

grant select, insert, update, delete on public.sources               to service_role;
grant select, insert, update, delete on public.articles              to service_role;
grant select, insert, update, delete on public.article_analyses      to service_role;
grant select, insert, update, delete on public.logs                  to service_role;
grant select, insert, update, delete on public.oxylabs_schedules     to service_role;
grant select, insert, update, delete on public.oxylabs_schedule_runs to service_role;
grant select on public.articles_pending_analysis to service_role;
