-- ============================================================================
-- SKEW news — source seed (AGENTS.md §7, §8, §9)
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor, after supabase/schema.sql.
-- Re-runnable: `on conflict do nothing` keeps a second run a no-op.
--
-- These are the five outlets AGENTS.md §11 already names in its URL-filtering
-- examples. Every URL is a HOMEPAGE ENTRY PAGE (§9) — never a category,
-- section, or sub-endpoint. Scraping loads its sources from this table, so
-- these URLs must never be duplicated into scraping logic (§7).
--
-- `parser_strategy` is null for all five: the generic homepage story-card
-- extractor is the starting point, and a source only gets a strategy key when
-- §11 shows generic extraction is not enough for it.
--
-- `logo_url` is left null rather than filled with a guessed CDN path. It is
-- optional (§7), and the UI degrades to the source name.
--
-- NO article rows are seeded. The home page must legitimately show its empty
-- state until the pipeline stores real, analysed articles.
-- ============================================================================

insert into public.sources (name, listing_url, parser_strategy, is_active)
values
  ('Reuters',      'https://www.reuters.com/',        null, true),
  ('NPR',          'https://www.npr.org/',            null, true),
  ('Fox News',     'https://www.foxnews.com/',        null, true),
  ('BBC News',     'https://www.bbc.com/news',        null, true),
  ('The Guardian', 'https://www.theguardian.com/us',  null, true)
on conflict (listing_url) do nothing;
