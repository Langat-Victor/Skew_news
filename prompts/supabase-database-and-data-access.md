# Supabase database and data access

## Goal

Stand up the Supabase layer that the whole product sits on, and retire the mock
data modules the UI currently reads:

1. **Schema** — a checked-in `supabase/schema.sql` with the six core tables from
   AGENTS.md §7 (`sources`, `articles`, `article_analyses`, `logs`,
   `oxylabs_schedules`, `oxylabs_schedule_runs`), plus the
   `articles_pending_analysis` view that implements §19's LEFT JOIN pending
   check, RLS, explicit grants, constraints, and indexes.
2. **Seed** — `supabase/seed.sql` with the five active source homepages the
   §11 examples already name.
3. **Data access** — a server-only `lib/supabase/**` layer: hand-written
   `Database` types, a service-role client singleton, and typed query functions.
4. **Page wiring** — `app/(site)/page.tsx` and `app/(site)/news/[slug]/page.tsx`
   read Supabase instead of `lib/mock/*`, with honest empty and not-found
   states, and `lib/mock/*` is deleted.

Out of scope, deliberately: pgvector and embeddings (AGENTS.md §20 — added after
analysis works), any API route, any scraping, any AI call, analysis **writes**.

## Skills read

- `.agents/skills/supabase/SKILL.md` — full read. Applied below:
  - fetched `https://supabase.com/changelog.md` and followed the
    `breaking-change` entries that touch this task (see Decisions).
  - core principle 4 — new public-schema tables are **not** auto-exposed or
    auto-granted to the Data API, so grants must be explicit.
  - core principle 5 — RLS on every table in `public`.
  - security checklist — never ship the service-role key to the browser;
    `security_invoker = true` on views (views bypass RLS by default);
    `SECURITY DEFINER` avoided entirely; pin package versions and commit the
    lockfile.
- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`
  — this project does **not** enable `cacheComponents`, so the previous caching
  model applies: route-segment `revalidate`, `unstable_cache`, React `cache`.
- `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`
  — async server components reading a database directly.
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`
  — `images.remotePatterns` object form; an unmatched hostname is a **400**, not
  a silent fallback.

Not read (not needed): `clerk`, `oxylabs-web-scraper`, `ai-sdk`.

## Existing code inspected

- `AGENTS.md` §5 layering, §7 field list, §9 pipeline + shared rules, §10
  append-only, §13 validation gate, §18 Oxylabs ID precision, §19 analysis
  fields + framing rules + pending check, §20 pgvector, §21 security + env
  table + joined-filter gotcha, §22 checks.
- `package.json` — `next 16.3.2`, `react 19.2.8`, `@clerk/nextjs ^7.8.1`.
  **No `@supabase/supabase-js` yet.**
- `.env.local` — already contains `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (keys inspected,
  values never printed). `.env.example` has a Clerk block only.
- `tsconfig.json` — `strict: true`, `@/*` path alias.
- `next.config.ts` — empty. No `images.remotePatterns`, so any remote article
  image would 400 today.
- `lib/mock/top-news.ts` — `TopNewsStory`, `CategoryArt`, `categoryArt()`,
  `TOP_NEWS`, `StoryId`, `isStoryId()`.
- `lib/mock/article-details.ts` — `SourceLean`, `BiasLabel`, `SentimentLabel`,
  `ArticleSource`, `RelatedStory`, `ArticleDetail`, `BIAS_LABEL_TEXT`,
  `SENTIMENT_LABEL_TEXT`, `OverallBias`, `overallBiasFor()`,
  `sourceCountsFor()`, `topSourcesFor()`, `getArticleDetail()`.
- Components importing `lib/mock/*` (all must be re-pointed):
  `components/news/framing-details-panel.tsx` (`SentimentLabel`),
  `components/news/related-stories.tsx` (`RelatedStory`),
  `components/news/bias-analysis-panel.tsx` (`BiasLabel`, `BIAS_LABEL_TEXT`,
  `overallBiasFor`), `components/news/source-breakdown-panel.tsx`
  (`ArticleSource`, `sourceCountsFor`), `components/ui/related-story-card.tsx`
  (`RelatedStory`), `components/ui/placeholder-art.tsx` (`categoryArt`).
- `app/design-system/page.tsx` and `components/layout/topic-rail.tsx` — verified
  **no** `lib/mock` imports; `TOPICS` is a local literal. Untouched by this task.
- `components/ui/news-card.tsx`, `components/ui/bias-meter.tsx`,
  `components/news/{bias-distribution-card,bias-analysis-panel,ai-summary-panel,article-byline,article-hero,related-stories}.tsx`
  — read in full to see what real rows can honestly fill (see Decisions).

## Decisions and assumptions

### Confirmed with the user

1. **`/news/[slug]` identity** → add a unique `slug` column to `articles`
   (title-derived + short hash), not the UUID and not the URL.
2. **UI columns §7 omits** → add `category`, `country`, `author` to `articles`,
   all **nullable** (the scraper cannot always find them).
3. **Scope** → also wire the existing home and details pages to Supabase, with
   empty states, not just the data layer.
4. **supabase-js version** → pin the latest `2.112.4` and commit the lockfile.
   It declares `engines.node >= 22`; this machine runs v20.20.1 and the user is
   upgrading to Node 22. `npm i --save-exact` (no caret) per the skill's
   pin-versions rule.

### From the changelog / skill

5. **Explicit grants, not automatic exposure.** Since the 2026-04-28 Data API
   change, a table created via SQL is not automatically granted to
   `anon`/`authenticated`. This app wants exactly that: **no** browser-side DB
   access at all. So the schema will `revoke all` from `anon`/`authenticated`
   and `grant` only to `service_role`, which is the only key the server uses.
6. **RLS enabled on all six tables with zero policies** — default-deny. Belt and
   braces with (5): even if someone later flips the Data API setting or grants
   the anon role, there is no policy to let a row through. `service_role`
   bypasses RLS, so the server keeps working.
7. **The view gets `security_invoker = true`** and is revoked from
   `anon`/`authenticated`. Views bypass RLS by default; this one must not.
8. **No `SECURITY DEFINER` anywhere.** The one function
   (`public.set_updated_at()`, a trigger) is `SECURITY INVOKER` with
   `set search_path = ''`, and `execute` is revoked from `public`.

### Schema shape

9. **`bias_score` is a generated stored column**,
   `((right_percentage - left_percentage)::numeric / 100)`, so §19's derivation
   cannot drift from the percentages. The TS `Insert` type must omit it.
10. **`check (left_percentage + center_percentage + right_percentage = 100)`** at
    table level — §19 requires the three to sum to 100, and the DB is the last
    line of defence behind Zod.
11. **Oxylabs `schedule_id` and job `id` are `text`, never `bigint`/`numeric`.**
    §18: these 64-bit values exceed `Number.MAX_SAFE_INTEGER` and are read as
    raw strings from the HTTP response. Storing text keeps the digits exact
    end-to-end.
12. **One analysis per article** — `article_analyses.article_id` is `unique`.
    That makes the pending check a clean anti-join and keeps the embed to-one.
13. **`image_url` and `published_at` are `not null` on `articles`** — §13 makes
    both mandatory before saving, so the DB enforces the gate.
14. **`article_id`/`source_id` FKs**: `articles.source_id` →
    `on delete restrict` (never orphan an article by deleting a source);
    `article_analyses.article_id` → `on delete cascade`; `logs` FKs →
    `on delete set null` (a log line must survive its subject).
15. **No `embedding` column, no pgvector, no IVFFlat index.** AGENTS.md §20 adds
    them later and says explicitly not to include the column in the initial
    schema.

### Wiring honesty — `sourceCount` and the source breakdown

The mock is a *cross-source cluster* ("12 sources agree on this story"). The real
schema stores **one article per row, from one source**. Nothing in the DB backs a
source count, per-outlet lean list, or "balanced sources" claim, and §20's
pgvector work gives related *articles*, not per-outlet lean. Passing `1` would
render "1 source" and "Based on 1 balanced sources", and `sourceCountsFor()`
would print fabricated per-lean tallies for a single outlet.

So:

16. **`NewsCard` drops `sourceCount` and gains the four fields §19 requires** —
    source name, published date, sentiment label, confidence. They go in the
    exact slot the "N sources" line occupied, so the card's geometry is
    unchanged: left `{source} · {date}`, right `{Sentiment} · {n}% confident`
    (confidence omitted when null). `category · country`, title, and the compact
    `BiasMeter` are untouched.
17. **`BiasDistributionCard` and `BiasAnalysisPanel` swap `sourceCount` for
    `confidence`.** The axis caption becomes `AI-estimated · {n}% confidence`;
    the panel's "Based on N balanced sources" becomes "AI-estimated from this
    article · {n}% confidence". The fixed `METHODOLOGY` boilerplate stays as-is
    (it is not `framing_notes`).
18. **`SourceBreakdownPanel` is replaced by a new `SourcePanel`.** Deleting the
    aside slot outright would leave a hole in a designed layout, and scraped
    content needs attribution anyway. `SourcePanel` shows real data only:
    `sources.logo_url` + `sources.name`, and a `rel="noopener noreferrer"
    target="_blank"` link to `articles.original_url` ("Read the original"). The
    mock helpers `sourceCountsFor`, `topSourcesFor`, `SOURCE_POOL`, and the
    `ArticleSource` type are deleted with it. The old panel's design record
    stays in `prompts/news-details-page-ui.md`.
    *If you would rather keep the breakdown panel and feed it `1`, say so at
    approval time — but it will print numbers no row supports.*
19. **`ArticleByline.author` becomes optional.** `articles.author` is nullable;
    when null, the "By …" segment is omitted rather than filled with the outlet
    name.
20. **Derived display values, computed not invented**: reading time from
    `raw_text` word count at 200 wpm; article paragraphs by splitting `raw_text`
    on blank lines (falling back to single newlines) and dropping empties;
    summary bullets by splitting `article_analyses.summary` the same way (a
    one-paragraph summary renders as one bullet); `summaryGeneratedAt` from
    `article_analyses.created_at`. `ArticleHero`'s `caption`/`credit` have no
    columns, so nothing is passed — the component already renders them only when
    set.
21. **Related articles: same-category, most-recent, excluding self, limit 5** —
    an explicitly temporary stand-in. §20 replaces the ordering with cosine
    distance on the embedding. A `TODO(pgvector)` comment marks the exact line.
    `RelatedStory.slug` widens from the mock `StoryId` literal union to `string`.

### Rendering and caching

22. `cacheComponents` is off, so both pages use the previous model:
    `export const revalidate = 300` (5 min — the pipeline runs hourly, so this
    is well inside a cycle) and no `dynamic = "force-dynamic"`.
23. `generateStaticParams` reads up to 50 recent slugs and **returns `[]` on
    error** so a build without DB access still succeeds; unlisted slugs render
    on demand.
24. Query functions are wrapped in React `cache()` for per-request dedupe
    (`generateMetadata` and the page body both call `getArticleBySlug`).

### Images

25. `next.config.ts` gets `images.remotePatterns` for the publisher CDNs of the
    five seeded sources: `media.npr.org`, `ichef.bbci.co.uk`, `i.guim.co.uk`,
    `media.guim.co.uk`, `a57.foxnews.com`, `static.foxnews.com`,
    `www.reuters.com`, `cloudfront-us-east-2.images.arcpublishing.com`. A
    wildcard `hostname: "**"` is rejected — the docs warn it lets arbitrary
    hosts through the optimizer.
26. Because an unmatched host is a hard 400 (a broken box, not a fallback), the
    host list lives in **one** module, `lib/news/image-hosts.ts`, imported by
    both `next.config.ts` and a small `isOptimizableImageUrl()` helper. Cards
    and heroes pass `imageUrl` only when the host is allowed, otherwise they
    fall back to the existing `PlaceholderArt`. *Verify the config import
    resolves under `next build`; if it does not, inline the list in
    `next.config.ts` with a comment pointing at the module.*

### Naming note (not a code change)

The request says "Skew News"; the codebase, `AGENTS.md`, and page titles all used
an older brand name at the time of this prompt. This prompt keeps that older name
everywhere, because nothing in the schema depends on it. **Resolved since:** the
rename to **SKEW news** shipped as a separate copy-only pass — see
`prompts/skew-rebrand.md`. No table, column, index, view, or constraint name
changed, exactly as predicted here.

## Files likely to change

**New**

- `supabase/schema.sql`
- `supabase/seed.sql`
- `lib/supabase/types.ts`
- `lib/supabase/server.ts`
- `lib/supabase/queries/sources.ts`
- `lib/supabase/queries/articles.ts`
- `lib/supabase/queries/logs.ts`
- `lib/news/labels.ts`
- `lib/news/category-art.ts`
- `lib/news/format.ts`
- `lib/news/types.ts`
- `lib/news/image-hosts.ts`
- `components/news/source-panel.tsx`

**Changed**

- `package.json`, `package-lock.json` (pin `@supabase/supabase-js@2.112.4`)
- `.env.example` (Supabase block)
- `next.config.ts` (`images.remotePatterns`)
- `app/(site)/page.tsx`, `app/(site)/news/[slug]/page.tsx`
- `components/ui/news-card.tsx`, `components/ui/related-story-card.tsx`,
  `components/ui/placeholder-art.tsx`
- `components/news/bias-distribution-card.tsx`,
  `components/news/bias-analysis-panel.tsx`,
  `components/news/framing-details-panel.tsx`,
  `components/news/related-stories.tsx`, `components/news/article-byline.tsx`

**Deleted**

- `lib/mock/top-news.ts`, `lib/mock/article-details.ts`,
  `components/news/source-breakdown-panel.tsx`

## Implementation requirements

### 1. Dependency

`npm i --save-exact @supabase/supabase-js@2.112.4`. Exact pin, lockfile
committed (skill: dependency and supply-chain security). No `@supabase/ssr` —
this app has no Supabase Auth and no cookie-bound client (§6 forbids Supabase
Auth), so the plain client with the service-role key on the server is correct.

### 2. `supabase/schema.sql`

Idempotent and re-runnable (`create table if not exists`,
`create or replace view`, `drop trigger if exists` before create). One file, in
this order: extensions note → trigger function → tables → view → indexes → RLS →
grants. Every table in `public`.

`sources`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` pk | `default gen_random_uuid()` |
| `name` | `text not null unique` | §7 name |
| `listing_url` | `text not null unique` | §7 homepage URL — homepage entry page only (§9) |
| `parser_strategy` | `text` | nullable; source-specific parser key (§11) |
| `is_active` | `boolean not null default true` | §7 active status; only active rows are scraped (§8) |
| `logo_url` | `text` | §7 optional logo |
| `created_at` / `updated_at` | `timestamptz not null default now()` | `updated_at` by trigger |

`articles`

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` pk | |
| `source_id` | `uuid not null references sources(id) on delete restrict` | §7 source reference |
| `original_url` | `text not null unique` | §7/§10 dedupe key |
| `canonical_url` | `text` | §7 |
| `slug` | `text not null unique` | decision 1; `check (slug ~ '^[a-z0-9-]+$')` |
| `title` | `text not null` | |
| `image_url` | `text not null` | required before saving (§13) |
| `published_at` | `timestamptz not null` | required before saving (§13) |
| `raw_text` | `text not null` | `check (length(btrim(raw_text)) > 0)`; cleaned per §13 |
| `category` / `country` / `author` | `text` | decision 2, all nullable |
| `scraped_at` | `timestamptz not null default now()` | §7 |
| `analyzed_at` | `timestamptz` | null until analysis saved (§7/§19.6) |
| `created_at` | `timestamptz not null default now()` | |

No `updated_at` and no update trigger — articles are append-only (§10).

`article_analyses` — `id` uuid pk; `article_id uuid not null unique references
articles(id) on delete cascade`; `summary text not null`; `sentiment_score
numeric(4,3) not null check (between -1 and 1)`; `sentiment_label text not null
check (in ('positive','neutral','negative'))`; `left_percentage`,
`center_percentage`, `right_percentage` `smallint not null check (between 0 and
100)`; `bias_score numeric(4,3) generated always as (((right_percentage -
left_percentage)::numeric) / 100) stored`; `bias_label text not null check (in
('left','center','right','mixed','unclear'))`; `confidence numeric(4,3) not null
check (between 0 and 1)`; `framing_notes text not null`; `loaded_terms text[] not
null default '{}'`; `disclaimer text not null`; `model text not null`;
`created_at`/`updated_at`; plus
`constraint framing_percentages_sum_100 check (left_percentage +
center_percentage + right_percentage = 100)`.

`logs` — `id` uuid pk; `level text not null check (in
('debug','info','warn','error'))`; `event text not null` (e.g. `scrape.started`);
`message text`; `context jsonb not null default '{}'::jsonb`; `source_id uuid
references sources(id) on delete set null`; `article_id uuid references
articles(id) on delete set null`; `created_at timestamptz not null default
now()`.

`oxylabs_schedules` — `id` uuid pk; `schedule_id text not null unique`
(**text**, §18); `source_id uuid not null unique references sources(id) on
delete cascade` (one schedule per source); `cron text not null`; `is_active
boolean not null default true`; `last_synced_at timestamptz`;
`created_at`/`updated_at`.

`oxylabs_schedule_runs` — `id` uuid pk; `schedule_id text not null references
oxylabs_schedules(schedule_id) on delete cascade`; `job_id text not null`
(**text**, §18); `result_status text` (Oxylabs `done|pending|faulted`, §18);
`processed_at timestamptz`; `articles_inserted integer not null default 0`;
`created_at timestamptz not null default now()`;
`unique (schedule_id, job_id)`.

`articles_pending_analysis` view — §19's pending check as SQL so no route has to
hand-roll a LEFT JOIN or reach for a forbidden joined-table filter (§21):

```sql
create or replace view public.articles_pending_analysis
with (security_invoker = true) as
select a.id, a.source_id, s.name as source_name, a.slug, a.title,
       a.original_url, a.canonical_url, a.raw_text, a.published_at,
       a.scraped_at, a.analyzed_at
from public.articles a
left join public.article_analyses an on an.article_id = a.id
left join public.sources s on s.id = a.source_id
where an.id is null;
```

No `order by` in the view — callers order. Note in a comment that a row appears
here whenever the analysis row is absent, **even if `analyzed_at` is set**, which
is exactly §19.1's requirement.

Indexes: `articles (published_at desc) where analyzed_at is not null`;
`articles (source_id)`; `articles (category, published_at desc)`;
`articles (scraped_at desc)`; `article_analyses (article_id)` (unique already
covers it — skip if redundant); `logs (created_at desc)`; `logs (level)`;
`oxylabs_schedule_runs (schedule_id)`;
`oxylabs_schedule_runs (processed_at) where processed_at is null`.

Security block, verbatim intent:

```sql
alter table public.sources enable row level security;   -- and the other five
-- No policies: default deny for anon/authenticated. service_role bypasses RLS.
revoke all on public.sources from anon, authenticated;  -- and the rest + view
grant usage on schema public to service_role;
grant select, insert, update, delete on public.sources to service_role;  -- etc.
grant select on public.articles_pending_analysis to service_role;
```

Trigger function:

```sql
create or replace function public.set_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
revoke execute on function public.set_updated_at() from public;
```

Triggers on `sources`, `article_analyses`, `oxylabs_schedules` only.

### 3. `supabase/seed.sql`

`insert ... on conflict (listing_url) do nothing` for the five outlets §11 names,
homepage URLs only: Reuters `https://www.reuters.com/`, NPR
`https://www.npr.org/`, Fox News `https://www.foxnews.com/`, BBC News
`https://www.bbc.com/news`, The Guardian US `https://www.theguardian.com/us`.
All `is_active = true`, `parser_strategy` null for now. No article seeds — the
homepage must legitimately show its empty state until scraping runs.

### 4. `lib/supabase/types.ts`

Hand-written `Database` type (no CLI available to generate it) with
`Row`/`Insert`/`Update` per table plus the view's `Row`. `bias_score` appears in
`Row` but **not** `Insert`/`Update` (generated column). Defaulted and nullable
columns are optional in `Insert`. Export narrow unions
(`SentimentLabelValue`, `BiasLabelValue`, `LogLevel`) and reuse them so the
CHECK constraints are mirrored in TypeScript. No `any`.

### 5. `lib/supabase/server.ts`

```ts
import "server-only";
```

first line. Reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`,
throws a clear error naming the missing variable, returns a lazily-created
module-level singleton `SupabaseClient<Database>` created with
`{ auth: { persistSession: false, autoRefreshToken: false } }`. Exported as
`getServiceRoleClient()`. Never exported from a module a client component can
reach; never logs the key.

### 6. `lib/supabase/queries/*`

All server-only (they import `server.ts`), all typed, all wrapped in React
`cache()` where a request may call them twice. Every function returns plain data
or `null` — no throwing into the render path for expected-empty cases; a real
PostgREST error is logged server-side (`console.error` with the code/message) and
surfaced as empty/`null` so a page degrades instead of 500ing.

`articles.ts`

- `getPublishedArticles(limit = 24): Promise<FeedArticle[]>` — `articles` with
  embedded `sources(name, logo_url)` and `article_analyses(...)`,
  `.not('analyzed_at', 'is', null)`, `.order('published_at', {ascending:
  false})`, `.limit(limit)`. **The analysis-present check happens in JS**, per
  §21's joined-filter gotcha and §19.1's warning that `analyzed_at` can be set
  without an analysis row.
- `getArticleBySlug(slug): Promise<ArticleDetailView | null>` — same shape,
  `.eq('slug', slug).maybeSingle()`; returns `null` when missing or unanalyzed.
- `getRelatedArticles(articleId, category, limit = 5): Promise<RelatedStory[]>`
  — same category, `.neq('id', articleId)`, analyzed only, newest first.
  `TODO(pgvector)` on the ordering line (§20).
- `getRecentArticleSlugs(limit = 50): Promise<string[]>` — for
  `generateStaticParams`; `[]` on error.
- `getPendingAnalysisArticles(limit): Promise<PendingArticleRow[]>` — reads the
  view, `order('scraped_at', {ascending: true})`. §19 will use it.
- `getExistingArticleUrls(urls: string[]): Promise<Set<string>>` — §9's **URL
  existence check**, chunked so no `.in()` ever receives more than 15 URLs. The
  chunk size is a named constant with the §9 citation in a comment.
- `insertArticles(rows: ArticleInsert[]): Promise<{inserted: number}>` — §10
  append-only; `.upsert(rows, {onConflict: 'original_url', ignoreDuplicates:
  true})`. Never deletes or resets.

Because a to-one embed's shape (object vs single-element array) has varied across
PostgREST versions, normalise with a tiny `firstOf()` helper rather than trusting
one shape.

Deferred to their own tasks, so they are **not** written here: analysis writes
(`saveAnalysis`, `markArticleAnalyzed` — §19 owns the validated shape), schedule
and run writers (§18), embedding queries (§20).

`sources.ts` — `getActiveSources(): Promise<SourceRow[]>` (`is_active = true`,
ordered by name), and `getSourcesByNames(names)` for §8's "scrape these three"
selection.

`logs.ts` — `insertLog(entry): Promise<void>` (never throws — a failed log must
not fail a pipeline) and `getRecentLogs(limit = 100)`.

### 7. `lib/news/*` — display layer, no DB imports

- `labels.ts` — `SourceLean`, `BiasLabel`, `SentimentLabel`, `BIAS_LABEL_TEXT`,
  `SENTIMENT_LABEL_TEXT`, `OverallBias`, `overallBiasFor()` moved **unchanged**
  from `lib/mock/article-details.ts`. `ArticleSource` is dropped with the source
  breakdown.
- `category-art.ts` — `CategoryArt`, `categoryArt()` moved unchanged from
  `lib/mock/top-news.ts` (it already tolerates unknown DB categories).
- `types.ts` — `FeedArticle`, `ArticleDetailView`, `RelatedStory` (with
  `slug?: string`), `PendingArticleRow`.
- `format.ts` — `formatPublishedDate()` (`May 29, 2026`, `en-US`, explicit
  `timeZone: "UTC"` so server and client agree), `readingTimeFor(text)`
  (`{n} min read`, 200 wpm, floor 1), `toParagraphs(text)`,
  `formatConfidence(0…1)` → `87%`, `formatSentimentScore()`.
- `image-hosts.ts` — `IMAGE_HOSTS` array + `isOptimizableImageUrl(url)` that
  returns false on parse failure.

### 8. Page wiring

`app/(site)/page.tsx` — async; `export const revalidate = 300`; keeps
`<TopicRail />` and the heading/grid markup byte-identical; maps
`getPublishedArticles()` to `<NewsCard>`; when the list is empty renders a
centred empty state inside the same container ("No articles yet" + one line of
explanation that the hourly pipeline has not stored any analysed articles yet).
No mention of admin routes or secrets in user-facing copy.

`app/(site)/news/[slug]/page.tsx` — `generateStaticParams` from
`getRecentArticleSlugs()`; `generateMetadata` keeps the existing
`"Article not found — SKEW news"` / `"{title} — SKEW news"` titles and uses the
analysis summary's first paragraph as the description; body calls
`getArticleBySlug` + `notFound()`; composes the same components in the same
order with `SourcePanel` where `SourceBreakdownPanel` was. `slug` stays a lookup
key only — never interpolated into a path, query, or markup (§21). Paragraph keys
become index-based (real text can repeat a line; `key={paragraph}` would collide).

### 9. Component edits — surgical

Type-only import re-pointing for `framing-details-panel`, `related-stories`,
`related-story-card`, `placeholder-art`, `bias-analysis-panel`. Prop changes only
where decisions 16–19 require them. **No restyling, no class changes, no layout
changes** beyond the documented text-slot swaps. The design-system page must
still render identically.

## Security requirements

- `SUPABASE_SERVICE_ROLE_KEY` is read **only** inside
  `lib/supabase/server.ts`, which starts with `import "server-only"`. No
  component, no client module, no `NEXT_PUBLIC_` alias. Never logged, never in
  an error message.
- Pages are server components; no query function is importable from a `"use
  client"` file (the `server-only` package makes that a build error).
- RLS on all six tables with no policies; `revoke all` from
  `anon`/`authenticated` on tables and the view; grants only to `service_role`.
- View is `security_invoker = true`. No `SECURITY DEFINER` functions.
- The one function is `SECURITY INVOKER` with `set search_path = ''` and
  `execute` revoked from `public`.
- No secrets in `.env.example` — placeholders only. `CRON_SECRET` is **not**
  added anywhere (§18/§21).
- `.env.example` and the §21 env table stay in sync; the three Supabase vars are
  already in that table, so no `AGENTS.md` edit is needed.
- No admin secret, Oxylabs, OpenAI, or scraping code in this task — nothing here
  mutates pipeline state, matching §5's "UI displays stored data only".
- `remotePatterns` is an explicit host allowlist, never `**`, so the image
  optimizer cannot be pointed at arbitrary hosts.
- External links (`original_url`) use `target="_blank"` with
  `rel="noopener noreferrer"`.

## Acceptance criteria

1. `supabase/schema.sql` applies cleanly in the Dashboard SQL Editor on a fresh
   project **and** re-applies with no error on a second run.
2. All six §7 tables exist with every §7 and §19 field; `articles` additionally
   has `slug`, `category`, `country`, `author`. **No `embedding` column.**
3. `insert into article_analyses` with percentages that do not sum to 100 is
   rejected; a valid insert yields `bias_score = (right − left) / 100` without
   the client sending it.
4. `select` on any table as `anon` is denied; the same query with the service
   role succeeds.
5. `articles_pending_analysis` lists an article whose `article_analyses` row was
   deleted **even though `analyzed_at` is still set** (§19.1).
6. Oxylabs ID columns are `text`; a 19-digit ID round-trips digit-for-digit.
7. `getExistingArticleUrls` with 40 URLs issues 3 requests, none with more than
   15 URLs in `.in()`.
8. Home page renders the empty state on a seeded-but-articleless DB, and renders
   real cards once analysed rows exist — each card showing source, published
   date, sentiment label, and confidence (§19).
9. A details page renders title, byline (author omitted when null), hero,
   distribution card, real paragraphs, related stories, and the four aside
   panels from real rows; an unknown slug 404s; an article with no analysis row
   404s rather than rendering blank panels.
10. `lib/mock/*` is gone and nothing imports it. `grep -r "lib/mock"` returns
    nothing.
11. `npm run typecheck`, `npm run lint`, and `npm run build` all pass. No `any`,
    no unused exports left behind by the mock deletion.

## Checks to run

Per §22, from the project root:

```bash
npm run typecheck
npm run lint
npm run build        # server modules, config, and routes all changed
```

Plus a guard for criterion 10:

```bash
grep -rn "lib/mock" app components lib || echo "clean"
```

Report exact output. Note if Node is still v20 when supabase-js wants ≥22 —
`npm i` will warn (EBADENGINE) and the build may or may not succeed; that is the
signal to finish the Node 22 upgrade.

## Manual test steps

**A. Apply the schema (Supabase Dashboard → SQL Editor — there is no CLI or MCP
server in this project, so §7's Dashboard path is the only route).**

1. Open the project → SQL Editor → New query.
2. Paste all of `supabase/schema.sql`, Run. Expect "Success. No rows returned".
3. Run it a **second** time — it must succeed again (idempotency).
4. Paste `supabase/seed.sql`, Run.
5. Verify:
   ```sql
   select name, listing_url, is_active from public.sources order by name;
   ```
   → five active rows.

**B. Verify the guards**

```sql
-- must fail: percentages do not sum to 100
insert into public.article_analyses
  (article_id, summary, sentiment_score, sentiment_label, bias_label,
   left_percentage, center_percentage, right_percentage, confidence,
   framing_notes, disclaimer, model)
values (gen_random_uuid(), 's', 0, 'neutral', 'center', 50, 50, 50, 0.5,
        'n', 'd', 'test');
-- expect: violates check constraint "framing_percentages_sum_100"
-- (the FK on article_id would also reject it — use a real article id to see
--  the sum constraint fire on its own)
```

```sql
-- RLS/grants: as the anon role, every table must be denied
set local role anon;
select count(*) from public.sources;   -- expect: permission denied
reset role;
```

**C. Insert one end-to-end row and view it in the UI**

```sql
insert into public.articles
  (source_id, original_url, slug, title, image_url, published_at, raw_text,
   category, country, author, analyzed_at)
select id,
       'https://www.npr.org/2026/08/26/test-article',
       'test-article-a1b2c3',
       'A test article stored by hand',
       'https://media.npr.org/assets/img/2026/08/26/test_wide.jpg',
       now() - interval '2 hours',
       'First paragraph of body text.' || chr(10) || chr(10) ||
       'Second paragraph of body text.' || chr(10) || chr(10) ||
       'Third paragraph of body text.',
       'Politics', 'United States', 'Jane Doe', now()
from public.sources where name = 'NPR';

insert into public.article_analyses
  (article_id, summary, sentiment_score, sentiment_label, bias_label,
   left_percentage, center_percentage, right_percentage, confidence,
   framing_notes, loaded_terms, disclaimer, model)
select id, 'A neutral one-paragraph summary of the test article.',
       -0.2, 'negative', 'center', 30, 45, 25, 0.82,
       'Framing leans on institutional sources.',
       array['crackdown','sweeping'],
       'AI-estimated analysis. Not objective truth.',
       'gpt-test'
from public.articles where slug = 'test-article-a1b2c3';

-- confirm the generated column
select bias_score from public.article_analyses
where article_id = (select id from public.articles
                    where slug = 'test-article-a1b2c3');
-- expect: -0.050
```

**D. Run the app**

```bash
npm run dev
```

1. `http://localhost:3000/` → one card: NPR · Aug 26, 2026, sentiment
   "Negative", "82% confident", bias meter 30/45/25.
2. Click it → `/news/test-article-a1b2c3` renders byline "By Jane Doe", three
   paragraphs, the distribution card reading "AI-estimated · 82% confidence",
   the AI summary panel, the source panel linking to npr.org, and the framing
   panel with the two loaded terms.
3. `http://localhost:3000/news/does-not-exist` → 404 page.
4. Delete the analysis row and reload the article page → 404 (not blank panels),
   and it now appears in `select * from public.articles_pending_analysis;` even
   though `analyzed_at` is still set.
5. Delete the test article (`delete from public.articles where slug =
   'test-article-a1b2c3';`) and reload `/` → the "No articles yet" empty state.
6. Watch the dev-server terminal — no PostgREST errors, no missing-env errors.

**E. Cleanup**

```sql
delete from public.articles where slug = 'test-article-a1b2c3';
```

(The analysis row cascades.)
