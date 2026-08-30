# Oxylabs scraping pipeline

## Goal

Implement AGENTS.md §9's **scrape-to-insert pipeline** and §16's manual scraping
behaviour, end to end:

1. **Scraping layer** — a server-only Oxylabs Web Scraper API client
   (`universal` source, Realtime endpoint) that fetches one page and returns a
   typed result instead of throwing.
2. **Parsing layer** — homepage story-card link extraction (§11), candidate URL
   filtering (§12), the canonical non-article reject list (§9), and article
   detail parse + validate + clean (§13).
3. **Pipeline layer** — orchestration of §9's nine steps, §9 **run logging**, and
   the typed summary object §16 returns in the response.
4. **API layer** — `POST /api/scrape` (thin, §14 method, §15 admin secret) and
   `GET /api/sources` (thin read route, §14).

After this task, real articles land in `articles` with `analyzed_at = null`. They
will **not** appear on the home page — §18 is explicit that articles only show
once `analyzed_at` is set, which is §19's job.

**Out of scope, deliberately:** Oxylabs Scheduler, `vercel.json`, and
`/api/cron/pipeline` (§18); AI analysis and `POST /api/analyze` (§19); pgvector
and embeddings (§20); `GET /api/logs`; any UI change.

Why the Scheduler is not here: §18 requires all its parts delivered together,
and its last part is a cron route that chains scheduled-result processing **into
AI analysis**. Analysis does not exist yet, so a scheduler shipped now would be
structurally incomplete. It gets its own `prompts/oxylabs-scheduler.md` after
§19. The pipeline built here is written as the single reusable implementation
§18 will call, not as manual-only code — §18 says explicitly "Do not duplicate
pipeline logic inside Scheduler".

## Skills read

- `.agents/skills/web-scraper-api/SKILL.md` — full read, plus `examples.md` and
  the `universal` entry in `sources.md`. Applied below:
  - Realtime endpoint `POST https://realtime.oxylabs.io/v1/queries`, HTTP Basic
    auth from `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`.
  - `source: "universal"` — news sites are not one of the 40+ parseable targets,
    so there is no better source and `parse: true` does not apply. We want raw
    HTML for Cheerio.
  - `render: "html"` for JavaScript-heavy pages; client timeouts near **180
    seconds** for rendered Realtime requests.
  - Response shape `{ results: [{ content, status_code, url }] }` — note
    `status_code` is the **target page's** status, separate from the HTTP status
    of the Oxylabs call itself. Both are checked.
  - `user_agent_type` values, `geo_location` country format, and the `context`
    array form for `follow_redirects`.
  - Error table: 400 invalid parameters, 401 auth, 403 denied, 429 rate limit.
- `.agents/skills/supabase/SKILL.md` — full read. Applied below:
  - core principle 2, verify your work — the manual test steps below end in a
    real query against the stored rows, not just a 200 response.
  - security checklist: never expose the service-role key to browser code; pin
    package versions and commit the lockfile (so `cheerio` and `zod` are
    installed with `--save-exact`).
  - §21's joined-table filter gotcha is already respected by the existing query
    layer; this task adds no joined filters.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  and `.../03-api-reference/03-file-conventions/route.md` — Route Handler
  conventions in this Next version: `route.ts` under `app/`, one file owns all
  verbs, `POST` is never cached, request body via the Web `Request` API.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`
  and `.../runtime.md` — `export const maxDuration` and
  `export const runtime = "nodejs"`. `preferredRegion` is deprecated and is not
  used.
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`
  — the escape hatch if Cheerio's transitive deps resist bundling (contingency
  only, see decision 19).

Not read (not needed): `clerk`, `ai-sdk`.

### Skill path correction

AGENTS.md §3 lists the scraper skill as `.agents/skills/oxylabs-web-scraper`.
That directory does not exist — the skill is at
`.agents/skills/web-scraper-api/` (`SKILL.md`, `examples.md`, `sources.md`).
This prompt proposes a one-line fix to §3 so the next task does not hit the same
dead path. Say the word at approval time if you would rather leave AGENTS.md
untouched.

## Existing code inspected

- `AGENTS.md` in full. Load-bearing sections: §5 layering, §7 field list and
  "no hardcoded source URLs", §8 source selection, §9 pipeline + URL existence
  check + article content gate + run logging + non-article reject list, §10
  append-only, §11 homepage link extraction, §12 candidate URL filtering, §13
  validation and cleanup, §14 methods, §15 admin secret, §16 manual scraping,
  §17 test output, §21 security + env table, §22 checks.
- **Live Supabase state**, read over the REST API with the service-role key
  (no CLI and no MCP server in this project):
  - `sources` — 5 rows, all `is_active = true`, all `parser_strategy = null`,
    all `logo_url = null`: BBC News `https://www.bbc.com/news`, Fox News
    `https://www.foxnews.com/`, NPR `https://www.npr.org/`, Reuters
    `https://www.reuters.com/`, The Guardian `https://www.theguardian.com/us`.
  - `articles` — **9 rows**, `article_analyses` — **9 rows**. These are the
    fabricated `dummy-fixture-v1` fixtures from `supabase/dummy-articles.sql`,
    not scrapes. Their `original_url` values are plausible-looking paths on the
    five real domains, so a real scrape will not collide with them.
  - `logs` — 0 rows.
- `supabase/schema.sql` — `articles` columns and, critically, the constraints
  this pipeline must satisfy before an insert can succeed: `original_url`
  unique, `slug` unique **and** `check (slug ~ '^[a-z0-9][a-z0-9-]*$')`,
  `image_url not null`, `published_at not null`,
  `raw_text check (length(btrim(raw_text)) > 0)`, `source_id` FK.
- `lib/supabase/queries/articles.ts` — `getExistingArticleUrls()` (already
  chunked at 15 per §9) and `insertArticles()` (already
  `upsert(..., { onConflict: "original_url", ignoreDuplicates: true })` per
  §10). Both were written for this task and have **no callers yet**, so
  `insertArticles`' return type can be widened without touching anything else.
- `lib/supabase/queries/sources.ts` — `getActiveSources()` and
  `getSourcesByNames()`, both `is_active = true` only. §8's selection is already
  covered; this task adds no source query.
- `lib/supabase/queries/logs.ts` — `insertLog()` (never throws) and
  `getRecentLogs()`.
- `lib/supabase/server.ts` — the `import "server-only"` + lazy singleton +
  `required(name)` pattern the Oxylabs client will mirror.
- `lib/news/format.ts` — `toParagraphs()` splits on blank lines first. This
  dictates the `raw_text` storage format (decision 12).
- `lib/news/image-hosts.ts` — `isOptimizableImageUrl()` is a **display** guard.
  It must not filter at scrape time (decision 10).
- `lib/news/types.ts`, `lib/supabase/types.ts` — `ArticleInsert` is the exact
  shape the pipeline builds.
- `proxy.ts` — bare `clerkMiddleware()`, matcher already covers `/(api|trpc)`.
  Its own comment records the rule this task must honour: the action routes
  authenticate with `x-SKEW-admin-secret`, and the proxy must never become an
  alternative to that secret.
- `app/` — **no `app/api` directory exists**. These are the first route
  handlers in the project.
- `package.json` — `next 16.3.2`, `react 19.2.8`, `@supabase/supabase-js
  2.112.4` (exact). **No `cheerio`, no `zod`.**
- `tsconfig.json` — `strict: true`, `@/*` alias, `target: ES2017`.
- `eslint.config.mjs` — `next/core-web-vitals` + `next/typescript`.
- `.env.local` — has `OXY_WSA_USERNAME` and `OXY_WSA_PASSWORD` (names inspected,
  values never printed). See the admin-secret note below.

### `.env.local` admin-secret key

Line 17 is `x-SKEW-admin-secret=<value>` — the **HTTP header name** reused as the
variable name. It works as-is and needs no change:

- `@next/env`'s dotenv parser accepts hyphens in a key (its key class is
  `[\w.-]+`, verified in `node_modules/@next/env/dist/index.js`), so the value
  loads into `process.env` and is readable as `process.env["x-SKEW-admin-secret"]`.
- `lib/api/admin-secret.ts` therefore reads `SKEW_ADMIN_SECRET` first and falls
  back to `x-SKEW-admin-secret`. Both names resolve to the same single secret.

Two things to keep in mind rather than fix:

- A hyphenated name is **not** a legal POSIX shell identifier, so
  `set -a && . ./.env.local` fails on that line. Next loads the file itself, so
  this only matters if you try to source it in a shell.
- Vercel's env-var key constraints are undocumented, so **`SKEW_ADMIN_SECRET` is
  the canonical name and the one to set on Vercel.** Adding it locally as well
  is optional; the fallback means either name works in development.

Header name and variable name stay two different things: curl always sends
`x-SKEW-admin-secret` (§15), whichever variable holds the value.

## Decisions and assumptions

### Confirmed with the user

1. **First run targets all five active sources**, **5 valid articles per
   source** — which is also §16's stated default, so it is the code default too.
2. **The 9 `dummy-fixture-v1` rows are the user's to remove.** Implementation
   touches nothing; the manual test steps include a `DELETE` the user runs, so
   the feed and the summary counts show only real scraped articles.
3. **Scope is §9 + §16 only.** Scheduler, cron, and analysis are separate tasks
   (see Goal).

### Oxylabs call shape

4. **Realtime, not Push-Pull.** `POST https://realtime.oxylabs.io/v1/queries`
   returns the content in the same response. Push-Pull (`data.oxylabs.io`) exists
   for callbacks and storage, which is §18's model, not §16's on-demand one.
5. **`render: "html"` for homepages, no `render` for article detail pages.**
   Homepage story cards are frequently client-rendered, and link discovery is
   the step where missing HTML costs the whole source. Article bodies are
   server-rendered on all five outlets, and skipping render there is
   substantially faster and cheaper — the difference across a run is ~5 rendered
   calls versus up to ~75. Both live in one `OXYLABS_RENDER` constant so the
   trade-off is tunable in one place. Per the skill, `render: ""` is only for
   *disabling* forced rendering and is not used.
6. **Timeouts follow the skill:** 180 s for rendered requests, 60 s otherwise,
   via `AbortSignal.timeout()`.
7. **`geo_location: "United States"`** and `user_agent_type: "desktop_chrome"`,
   plus `context: [{ key: "follow_redirects", value: true }]`. Geo is pinned so
   repeat runs see the same edition rather than a rotating regional homepage;
   redirects are followed because outlets redirect to canonical article paths.
8. **Two status checks, not one.** The Oxylabs HTTP status covers auth, rate
   limits, and malformed requests; `results[0].status_code` is the *target
   page's* status. A 200 from Oxylabs wrapping a target 404 is a failure, and
   only checking the outer one would store an error page as an article.
9. **The client never throws for an expected failure.** It returns a
   discriminated union so §9's run logging can count *why* a page was lost
   (`auth`, `rate_limited`, `oxylabs_error`, `timeout`, `network`,
   `bad_envelope`, `target_status`). Credentials never appear in a returned
   message or a log line.

### Parsing and validation

10. **`image_url` is stored as found, not filtered by `IMAGE_HOSTS`.**
    `isOptimizableImageUrl()` is a rendering guard: an unlisted host falls back
    to `PlaceholderArt`. Rejecting an otherwise-valid article because its CDN is
    not yet in a display allowlist would throw away real content and make the
    §13 gate depend on a UI config file.
11. **`country` is left `null`.** Article markup carries no honest country
    signal (JSON-LD `NewsArticle` has no such field, and inferring from the
    outlet's own nationality would mislabel a Guardian story about Kenya). The
    column is nullable and the UI already omits it. `category` **is** extracted,
    from JSON-LD `articleSection` → `og:article:section` → a known section
    vocabulary matched against the URL's first path segment → null.
12. **`raw_text` is `paragraphs.join("\n\n")`.** `toParagraphs()` splits on
    blank lines first, so this exact separator is what makes the details page
    render real paragraphs instead of one wall of text.
13. **Article-URL rules are keyed by host, resolved from the source row's own
    `listing_url`.** This is not a hardcoded source URL — §7 forbids storing
    source *URLs* in scraping logic, and §11 explicitly sanctions
    source-specific parser strategies. The table holds *regex rules* under keys
    like `reuters.com`; the host to look up comes from the DB row at runtime.
    When `sources.parser_strategy` is non-null it selects the rule set by name
    instead (all five are null today, so host lookup is the live path), and a
    source with no matching rule falls back to the generic heuristic. Adding a
    source to Supabase therefore needs no code change.
14. **§12's tie-breaker is applied literally: uncertain means reject.** So
    `/video/…` paths are rejected at the candidate stage rather than fetched to
    see whether they also carry article text (§9 allows video pages only "if the
    page also has full article text" — the strict reading costs at most a few
    lost articles and cannot store a video stub).
15. **"Visible story cards" (§11) is approximated, and the approximation is
    documented.** Static HTML cannot report computed visibility, so extraction
    strips `header`/`footer`/`nav`/`aside`/ad and promo containers, then honours
    `[hidden]`, `[aria-hidden="true"]`, and inline `display:none`. A comment in
    the module states this limit rather than implying real visibility testing.
16. **Slugs are deterministic:** title stem (≤ 72 chars) + `-` + the first 7 hex
    characters of `sha256(original_url)`. Deterministic means re-scraping a URL
    produces the same slug, so a `slug` conflict can only coincide with an
    `original_url` conflict — which the upsert already swallows. The stem falls
    back to `article` when a title normalises to nothing, because the schema's
    `check (slug ~ '^[a-z0-9][a-z0-9-]*$')` rejects a leading hyphen.
17. **Insert one article at a time.** A single batch would let one constraint
    violation reject every valid article beside it, and §9's summary needs exact
    per-article accounting. Volumes are tiny (25 rows for the default run), so
    the extra round trips cost nothing. `insertArticles()` keeps its array
    signature and is called with one row.

### Pipeline shape

18. **Sources sequentially, detail pages in batches of 3.** Fully sequential
    risks a run long enough to hit a platform execution limit; unbounded
    parallelism hammers one outlet from one proxy session. Batch size is
    `min(3, perSourceLimit − inserted)` so the run never fetches a page it has
    no slot for and never overshoots the requested count.
19. **Attempts per source are capped at `perSourceLimit × 3`** (floor 6) so one
    source with a hostile homepage cannot consume the whole run. When the cap
    truncates the candidate list, that is **logged** — a silent cap reads as
    "covered everything" when it did not.
20. **Dedupe happens twice, on both keys §10 names.** `original_url` before
    detail scraping (§9 step 5, via the chunked `getExistingArticleUrls`), and
    the parsed `canonical_url` after parsing — an outlet often serves one story
    under several URLs, and the canonical is only known once the page is
    fetched.
21. **`articlesRejected` and `articlesFailed` are different columns.** Rejected =
    fetched and parsed but failed §13's gate (a judgment about the page).
    Failed = could not be assessed (Oxylabs error, bad envelope, insert error).
    Collapsing them would hide an expired Oxylabs credential as "the sites had
    no good articles".
22. **A source-level failure never aborts the run.** It is recorded, the run
    continues to the next source, and the final status becomes
    `completed_with_errors`. `failed` is reserved for a run that resolved no
    sources at all.
23. **`maxDuration = 300` and `runtime = "nodejs"`.** Node runtime is required
    for `node:crypto` and Cheerio. Worst case for the default run is ~80 Oxylabs
    calls; locally (`npm run dev`) there is no ceiling, which is where §17 says
    to test. On Vercel, if the plan caps execution below what a five-source run
    needs, split it — the request body takes `sources` and `perSource` for
    exactly that.

### Routes

24. **`POST /api/scrape` is the only mutating route here**, guarded by
    `x-SKEW-admin-secret` (§15). The secret is compared as a SHA-256 digest
    through `crypto.timingSafeEqual`, so the comparison is constant-time *and*
    constant-length (raw `timingSafeEqual` throws on a length mismatch, which
    would itself leak the secret's length). A missing header, a wrong value, and
    an unconfigured `SKEW_ADMIN_SECRET` all return the same opaque `401` —
    the unconfigured case logs server-side and **never** falls open.
25. **`GET /api/sources` is added** (§14 lists it) because §8's workflow starts
    with showing the available source names. It is a read route, so §15's secret
    does not apply, and it returns only `name`, `listingUrl`, `logoUrl` for
    active sources — no ids, no `parser_strategy`, nothing that helps an
    attacker. Drop it at approval time if you would rather it waited.
26. **Both routes stay thin** (§5): validate, delegate, serialise. No parsing,
    no Oxylabs call, no Supabase query written inline.

### Dependencies

27. **`cheerio@1.2.0` and `zod@4.4.3`, exact pins, lockfile committed** — the
    Supabase skill's dependency rule. Cheerio needs Node ≥ 20.18.1; this machine
    is on v20.20.1, so it installs cleanly. `@supabase/supabase-js` still wants
    Node ≥ 22 and will keep printing EBADENGINE until that upgrade lands — a
    pre-existing warning, not something this task introduces.
28. **Zod validates two boundaries**: the `POST /api/scrape` request body, and
    the Oxylabs response envelope. §19 will reuse it for AI output.
29. **Contingency, not a default:** if `next build` fails on Cheerio's
    transitive deps (`undici`, `parse5`), add
    `serverExternalPackages: ["cheerio"]` to `next.config.ts`. App Router
    bundles route-handler dependencies by default and Cheerio normally survives
    it, so do not add this pre-emptively.

## Files likely to change

**New — scraping layer (§5)**

- `lib/oxylabs/client.ts`

**New — parsing layer (§5)**

- `lib/parsing/reject-list.ts`
- `lib/parsing/url.ts`
- `lib/parsing/candidate-url.ts`
- `lib/parsing/homepage-links.ts`
- `lib/parsing/article.ts`
- `lib/parsing/slug.ts`

**New — pipeline layer (§5)**

- `lib/pipeline/types.ts`
- `lib/pipeline/scrape.ts`

**New — API layer (§5)**

- `lib/api/admin-secret.ts`
- `app/api/scrape/route.ts`
- `app/api/sources/route.ts`

**Changed**

- `package.json`, `package-lock.json` — `cheerio@1.2.0`, `zod@4.4.3`, exact.
- `lib/supabase/queries/articles.ts` — widen `insertArticles`' return to
  `{ inserted: number; error: string | null }`. Nothing else in the file
  changes; it has no other callers.
- `.env.example` — Oxylabs + `SKEW_ADMIN_SECRET` block.
- `AGENTS.md` §3 — one-line skill path fix (`oxylabs-web-scraper` →
  `web-scraper-api`), vetoable.

**Not changed**

- `next.config.ts` (unless decision 29's contingency fires), `proxy.ts`, any
  component, any page, `supabase/schema.sql`, `lib/supabase/types.ts` — no
  column changes, so §7's "update schema.sql and types.ts" obligation does not
  trigger.

## Implementation requirements

### 1. Dependencies

```bash
npm i --save-exact cheerio@1.2.0 zod@4.4.3
```

Commit `package-lock.json`.

### 2. `lib/oxylabs/client.ts` — scraping layer

`import "server-only"` first line. Mirror `lib/supabase/server.ts`'s `required()`
helper for `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`, throwing an error that names
the missing variable and contains no value.

```ts
export type OxylabsFailureReason =
  | "auth" | "rate_limited" | "oxylabs_error" | "bad_envelope"
  | "target_status" | "timeout" | "network";

export type OxylabsFetchResult =
  | { ok: true; html: string; finalUrl: string; statusCode: number }
  | { ok: false; reason: OxylabsFailureReason; detail: string };

export async function fetchPageHtml(
  url: string,
  options: { render: boolean },
): Promise<OxylabsFetchResult>;
```

- `POST https://realtime.oxylabs.io/v1/queries`, `Content-Type: application/json`,
  `Authorization: Basic ${base64(user:pass)}`.
- Body: `{ source: "universal", url, geo_location: "United States",
  user_agent_type: "desktop_chrome", context: [{ key: "follow_redirects", value:
  true }] }`, plus `render: "html"` only when `options.render` is true.
- `signal: AbortSignal.timeout(options.render ? 180_000 : 60_000)`.
- Map the Oxylabs HTTP status: `401 → "auth"`, `429 → "rate_limited"`, any other
  non-2xx → `"oxylabs_error"` with the status and a **truncated** body excerpt
  (≤ 300 chars).
- Validate the envelope with Zod:
  `z.object({ results: z.array(z.object({ content: z.string(), status_code:
  z.number(), url: z.string().optional() })).min(1) })`. A failure is
  `"bad_envelope"`. `content` must be a string — `parse: true` is not used, so a
  structured `content` means something is wrong with the request.
- `results[0].status_code !== 200` → `"target_status"`.
- `AbortError` → `"timeout"`; any other thrown error → `"network"`.
- Export the render/timeout/geo values as named constants at the top of the file
  (decision 5's single tuning point).
- **Never** log, return, or embed the username or password.

### 3. `lib/parsing/reject-list.ts`

The one place §9's non-article reject list lives, as data:

- `NON_ARTICLE_PATH_SEGMENTS: ReadonlySet<string>` — every §9 category as path
  words: `category`, `categories`, `section`, `sections`, `topic`, `topics`,
  `tag`, `tags`, `author`, `authors`, `profile`, `search`, `show`, `shows`,
  `program`, `programs`, `podcast`, `podcasts`, `live`, `live-news`, `video`,
  `videos`, `watch`, `game`, `games`, `puzzles`, `product`, `products`, `review`,
  `reviews`, `shop`, `shopping`, `store`, `deals`, `about`, `about-us`,
  `contact`, `support`, `help`, `faq`, `careers`, `jobs`, `corporate`, `press`,
  `legal`, `terms`, `privacy`, `newsletter`, `newsletters`, `subscribe`,
  `subscription`, `signin`, `sign-in`, `login`, `register`, `account`, `sitemap`,
  `rss`, `feed`, `weather`, `sport`, `sports`.
- `hasRejectedPathSegment(pathname: string): string | null` — returns the
  offending segment (for the rejection reason) or null. Matches whole segments
  only, so a story slug containing the word "live" is not rejected.
- `isGenericTitle(title: string): boolean` — `News`, `Latest news`,
  `Breaking news`, `Home`, `Homepage`, `Video`, `Watch live`, `Podcasts`,
  `Shows`, `Sitemap`, `Page not found`, `Error`, `Access denied`, `Subscribe`,
  `Sign in`, and anything under 15 characters.

Add a header comment: when §9's list changes, it changes **here**.

### 4. `lib/parsing/url.ts`

Pure functions, no imports beyond `node:` built-ins:

- `absolutize(href: string, baseUrl: string): string | null` — null for
  `mailto:`, `tel:`, `javascript:`, bare `#`, and unparseable values.
- `normalizeUrl(url: string): string | null` — lowercase host, drop the hash,
  strip tracking params (`utm_*`, `fbclid`, `gclid`, `cmpid`, `icid`, `ito`,
  `at_*`, `srnd`, `taid`, `smid`), keep every other query param, strip a
  trailing slash except at root, drop an empty `?`. Non-`https` → null.
  This is the function whose output becomes `original_url`, so it must be
  **stable**: the same page seen twice normalises identically, otherwise dedupe
  silently breaks.
- `sameSite(candidateUrl: string, sourceUrl: string): boolean` — compares
  registrable domains (last two labels, or three when the last two are in a
  small `MULTI_PART_TLDS` set: `co.uk`, `co.jp`, `com.au`, `co.nz`, `co.za`).
  Comment that this is a deliberate approximation, not a Public Suffix List.

### 5. `lib/parsing/candidate-url.ts` — §11 + §12

```ts
export type CandidateVerdict = { keep: true } | { keep: false; reason: RejectionReason };

export function isArticleCandidate(
  candidateUrl: string,
  source: { listingUrl: string; parserStrategy: string | null },
): CandidateVerdict;
```

Checks in order, first failure wins:

1. Parseable and `https` → else `not_article_url`.
2. `sameSite(candidateUrl, source.listingUrl)` → else `off_site`.
3. Pathname is not `/` and not equal to the source's listing pathname → else
   `homepage_or_listing`.
4. `hasRejectedPathSegment(pathname) === null` → else `reject_list_path`.
5. The resolved rule accepts the path → else `not_article_url`.

Rule resolution: `source.parserStrategy` when non-null, else the registrable
domain of `source.listingUrl`, else the generic rule.

`ARTICLE_URL_RULES` (each a `RegExp` against `pathname`, with the §11/§12 example
it encodes named in a comment):

| Key | Accepts | Rejects (the §11 examples) |
| --- | --- | --- |
| `reuters.com` | `/^\/(?:[a-z0-9-]+\/)+[a-z0-9-]{8,}-\d{4}-\d{2}-\d{2}\/?$/` — the trailing `-YYYY-MM-DD` article marker | `/world/africa` |
| `npr.org` | `/^\/(?:sections\/[^/]+\/)?\d{4}\/\d{2}\/\d{2}\/\d+\//` — date + numeric story id | `/sections/politics` |
| `foxnews.com` | `/^\/[a-z-]+\/[a-z0-9-]{15,}$/` — one topic root, then a long story slug | `/shows/…`, `/games/…`, `/video/…` (also caught at step 4) |
| `bbc.com` | `/^\/news\/articles\/[a-z0-9]{6,}$/` plus legacy `/^\/news\/(?:[a-z-]+-)?\d{8,}$/` | `/sport/…`, `/news/live/…`, `/news/topics/…` |
| `theguardian.com` | `/^\/(?:[a-z0-9-]+\/)+\d{4}\/[a-z]{3}\/\d{1,2}\/[a-z0-9-]{6,}$/` — date-based path | `/us/environment`, `/thefilter-us` |
| generic | date path (`/\d{4}\/\d{2}\/\d{2}\//` or `/\d{4}\/[a-z]{3}\/\d{1,2}\//`), **or** a final segment ≥ 30 chars with ≥ 3 hyphens, **or** a final segment holding a ≥ 7-digit id | everything else |

### 6. `lib/parsing/homepage-links.ts` — §11

```ts
export function extractStoryLinks(html: string, source: SourceRow): string[];
```

1. `cheerio.load(html)`.
2. **Strip** non-content containers before selecting anything:
   `script, style, noscript, template, header, footer, nav, aside, form,
   [role="navigation"], [role="banner"], [role="contentinfo"], [hidden],
   [aria-hidden="true"], [style*="display:none"], [style*="display: none"]`,
   plus class/id substring matches for `nav`, `menu`, `breadcrumb`, `subscribe`,
   `newsletter`, `promo-banner`, `advert`, `sponsor`, `footer`, `social`.
3. **Select** story-card anchors, in this priority order:
   `main a[href]`, `[role="main"] a[href]`, `article a[href]`,
   `[data-testid*="card" i] a[href]`, `[class*="card" i] a[href]`,
   `[class*="story" i] a[href]`, `[class*="promo" i] a[href]`,
   `h1 a[href], h2 a[href], h3 a[href], h4 a[href]`.
   If that yields fewer than 5, fall back to every remaining `a[href]` in the
   stripped document.
4. Keep an anchor only when it carries a plausible headline: link text ≥ 15
   chars, **or** a descendant `img[alt]` with alt ≥ 15 chars, **or** it sits
   inside `h1`–`h4`. A text-free icon link is navigation, not a story card.
5. `absolutize` against `source.listing_url`, then `normalizeUrl`.
6. Dedupe by normalised URL, **preserving document order** — page position is
   the only prominence signal static HTML offers, and taking the top N is
   better than taking a random N.

Document decision 15's visibility limit in the module header.

### 7. `lib/parsing/article.ts` — §13

```ts
export type ParsedArticle = {
  title: string;
  imageUrl: string;
  publishedAt: string;   // ISO 8601
  canonicalUrl: string | null;
  author: string | null;
  category: string | null;
  paragraphs: string[];
};

export type ParseArticleResult =
  | { ok: true; article: ParsedArticle }
  | { ok: false; reason: RejectionReason; detail?: string };

export function parseArticle(html: string, requestUrl: string): ParseArticleResult;
```

**JSON-LD first.** Read every `script[type="application/ld+json"]`, each in its
own `try/catch` so one malformed blob cannot kill the page. Flatten arrays and
`@graph`, then pick the node whose `@type` includes `NewsArticle`, `Article`,
`ReportageNewsArticle`, or `BlogPosting`. It supplies `headline`,
`datePublished`, `image`, `author`, `articleSection`.

Field precedence chains, each rejecting with its own reason:

- **title** — JSON-LD `headline` → `og:title` → first `h1` → `<title>` with a
  trailing `" | Outlet"` / `" - Outlet"` suffix stripped. Empty →
  `missing_title`. `isGenericTitle()` → `generic_title`.
- **imageUrl** — JSON-LD `image` (string, `{url}`, or array) → `og:image` →
  `twitter:image` → the first `figure img[src]` inside the article container.
  Absolutize and normalise; reject `data:` URIs and `.svg`. Missing →
  `missing_image`. Stored as found (decision 10).
- **publishedAt** — JSON-LD `datePublished` →
  `meta[property="article:published_time"]` → `meta[name="pubdate"]`,
  `meta[name="publish-date"]`, `meta[itemprop="datePublished"]`,
  `meta[name="date"]`, `meta[name="DC.date.issued"]` → first `time[datetime]`.
  Missing → `missing_published_date`. Unparseable, before 2000, or more than 2
  days in the future (clock-skew tolerance) → `invalid_published_date`. Store
  `toISOString()`.
- **canonicalUrl** — `link[rel="canonical"]` → `og:url` → null. Absolutize +
  normalise. If it is `/`, the source listing path, or trips
  `hasRejectedPathSegment` → `canonical_is_listing` (§13: a canonical pointing
  at a listing/category/program/product page rejects the page).
- **author** — JSON-LD `author.name` (or `[0].name`) → `meta[name="author"]` →
  `[rel="author"]` text → null. Strip a leading `By `.
- **category** — JSON-LD `articleSection` → `meta[property="article:section"]` →
  the URL's first path segment when it is in a known section vocabulary
  (`world`, `us`, `politics`, `business`, `technology`, `science`, `health`,
  `environment`, `climate`, `entertainment`, `culture`, `media`, `opinion`,
  `education`, `money`) → null. Title-cased for display.

**Body extraction and cleanup**

1. Pick the container with the most `p` text among `[itemprop="articleBody"]`,
   `article`, `main`, `[role="main"]`, `body`.
2. Remove, per §13's cleanup list: `script, style, noscript, iframe, form,
   figcaption, aside, nav, header, footer`, plus case-insensitive class/id
   substring matches for `newsletter`, `subscribe`, `sign-up`, `paywall`,
   `related`, `most-read`, `most-viewed`, `recommend`, `trending`, `promo`,
   `advert`, `sponsor`, `social`, `share`, `tags`, `byline`, `caption`,
   `credit`, `disclaimer`, `read-more`, `load-more`, and
   `[aria-hidden="true"], [hidden]`.
3. Collect `p` text, collapsing internal whitespace.
4. Drop a paragraph when it is boilerplate:
   - under 40 chars **and** not ending in sentence punctuation;
   - matches `/^(advertisement|sponsored|share this|follow us|sign up|
     subscribe|read more|related|most read|most viewed|load more|copyright|
     all rights reserved|©|photo:|image:|credit:|getty|ap photo|watch:|
     listen:|editor'?s note:)/i`;
   - looks like a CSS dump (contains `{`, `}`, and `:`) or inline JS
     (`function(`, `var …=`);
   - is ≥ 60 % non-letter characters;
   - is an exact duplicate of another collected paragraph (repeated navigation
     labels).
5. **One-big-paragraph split (§13's explicit instruction).** If the result is a
   single paragraph over 600 chars, split it — first on `\n{2,}` in the source
   text, then, failing that, on sentence boundaries grouped into ~3-sentence
   chunks. If step 3 collected nothing at all, fall back to
   `container.text()` and run the same split.
6. **The gate (§13):** pass when `paragraphs.length >= 3` **or** total
   meaningful characters `>= 900`. §13 is explicit that one extracted paragraph
   is *not* on its own grounds for rejection — hence step 5 before this check.
   Failing both → `body_too_thin`.
7. **Mostly-headlines check (§13):** if ≥ 50 % of paragraphs are under 80 chars
   and lack terminal punctuation → `body_mostly_headlines`.
8. **One-clear-subject heuristic (§13):** at least one significant title word
   (≥ 5 chars, excluding stopwords) must appear in the body. When the title has
   no such word, skip the check rather than reject. Failing →
   `no_clear_subject`. Comment it as a heuristic.

### 8. `lib/parsing/slug.ts`

```ts
export function articleSlug(title: string, originalUrl: string): string;
```

NFKD-normalise, strip diacritics, lowercase, non-alphanumeric → `-`, collapse
runs, trim `-`, truncate to 72 chars **at a hyphen boundary**, fall back to
`article` when empty, then append `-` + `createHash("sha256").update(originalUrl)
.digest("hex").slice(0, 7)`. Hex is `[0-9a-f]`, so the schema's
`^[a-z0-9][a-z0-9-]*$` always holds.

### 9. `lib/pipeline/types.ts`

`RejectionReason` as a string union covering every reason above:
`off_site`, `reject_list_path`, `not_article_url`, `homepage_or_listing`,
`duplicate`, `oxylabs_auth`, `oxylabs_rate_limited`, `oxylabs_error`,
`oxylabs_timeout`, `oxylabs_network`, `bad_response_envelope`,
`target_status_not_200`, `missing_title`, `generic_title`, `missing_image`,
`missing_published_date`, `invalid_published_date`, `canonical_is_listing`,
`body_too_thin`, `body_mostly_headlines`, `no_clear_subject`, `insert_failed`.

`ScrapeInput`, `ScrapeSourceSummary`, and `ScrapeSummary` — the summary carrying
every field §9's run logging demands:

```ts
export type ScrapeSummary = {
  status: "completed" | "completed_with_errors" | "failed";
  startedAt: string; finishedAt: string; totalDurationMs: number;
  sourcesChecked: number; unknownSources: string[]; perSourceLimit: number;
  candidatesFound: number; candidatesRejected: number; duplicatesSkipped: number;
  detailPagesScraped: number; articlesInserted: number;
  articlesRejected: number; articlesFailed: number;
  rejectionReasons: Record<string, number>;
  sources: ScrapeSourceSummary[];
  errors: { source: string; message: string }[];
};
```

### 10. `lib/pipeline/scrape.ts`

`import "server-only"`. `export async function runScrape(input: ScrapeInput):
Promise<ScrapeSummary>`, implementing §9's nine steps exactly:

1. `input.sourceNames?.length ? getSourcesByNames(names) : getActiveSources()`.
   Names that resolve to nothing go in `unknownSources` — never invent a source
   (§8). Zero sources resolved → `status: "failed"`, with the reason in
   `errors`.
2. Per source, sequentially: `fetchPageHtml(listing_url, { render: true })`.
   A failure records a source error and continues (decision 22).
3. `extractStoryLinks`.
4. `isArticleCandidate` on each — this is the reject-before-detail-scrape step.
5. `getExistingArticleUrls(kept)` (already chunked at 15) → drop the ones stored.
6. Cap at `perSourceLimit × 3` (floor 6), **logging** the truncation. Then loop
   `while (inserted < perSourceLimit && more candidates)`, taking batches of
   `min(3, perSourceLimit − inserted)` and `fetchPageHtml(url, { render: false })`
   in parallel within a batch.
7. `parseArticle` each fetched page. Not-ok → count the reason.
8. For a valid parse: if `canonicalUrl` differs from the candidate URL and is
   already stored, count `duplicate`. Otherwise build the `ArticleInsert`
   (`source_id`, `original_url` = normalised candidate, `canonical_url`, `slug`
   from `articleSlug(title, original_url)`, `title`, `image_url`,
   `published_at`, `raw_text = paragraphs.join("\n\n")`, `category`,
   `country: null`, `author`) and call `insertArticles([row])`.
   `inserted === 1` → count it; `error` → `insert_failed`; `0` with no error →
   `duplicate` (a race with a concurrent run).
9. Emit §9's run logging throughout and the summary object at the end.

**§9 run logging — every listed line, with a `[scrape]` prefix:** scrape
started (sources + limit), selected sources, per-source start, homepage fetched
(byte count), candidate links found, candidates rejected before detail scrape
(with reasons grouped), duplicates skipped, detail pages scraped, articles
inserted (title + URL), articles rejected after validation (reason + URL),
source-level errors, attempt-cap truncation, per-source completion, and scrape
completed or failed followed by the summary object.

**Durable rows** via `insertLog` for the run-level events only —
`scrape.started`, `scrape.source.completed` (with `source_id`),
`scrape.completed` / `scrape.failed` — with the counts in `context`. Per
candidate rows would flood the table; the console carries that detail.

### 11. `lib/api/admin-secret.ts` — §15

```ts
export function checkAdminSecret(request: Request): Response | null;
```

Returns `null` when authorised, otherwise a ready-to-return `401`
`Response.json({ error: "Unauthorized" }, { status: 401 })`.

- Read the expected value as
  `process.env.SKEW_ADMIN_SECRET ?? process.env["x-SKEW-admin-secret"]`.
  `SKEW_ADMIN_SECRET` is canonical and the one to set on Vercel; the hyphenated
  form is the header name reused as a variable name in `.env.local`, which
  `@next/env`'s dotenv accepts (`[\w.-]+`). Both resolve to the same secret, so
  this widens the *name* surface and never the permission.
- **Both** unset → `console.error("[api] SKEW_ADMIN_SECRET is not configured;
  rejecting request")` and **401**. Never fall open.
- Read the `x-SKEW-admin-secret` header with `request.headers.get(...)`. Field
  names are case-insensitive per RFC 9110 §5.1, so `x-skew-admin-secret` and
  `X-SKEW-Admin-Secret` match the same header — do not depend on the casing
  either way, and do not "correct" the documented casing. Never read the secret
  from the query string (§15).
- Compare `sha256(provided)` against `sha256(expected)` with
  `crypto.timingSafeEqual` — equal-length digests, so no length leak and no
  throw.
- Identical response for missing and wrong, and never echo the expected value.

### 12. `app/api/scrape/route.ts` — §14, §16

```ts
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) { … }
```

1. `checkAdminSecret(request)` → return the 401 if non-null.
2. Body: tolerate an empty body (`await request.text()`, parse only when
   non-empty), then Zod
   `z.object({ sources: z.array(z.string().min(1)).max(20).optional(),
   perSource: z.number().int().min(1).max(25).optional() }).strict()`.
   Invalid JSON or a schema failure → `400` with the Zod issue paths and
   messages (no echo of the raw input).
3. `await runScrape({ sourceNames: body.sources, perSourceLimit: body.perSource })`.
4. `Response.json(summary, { status: summary.status === "failed" ? 500 : 200 })`.
5. Wrap in `try/catch` → log and return `500 { error: "Scrape failed" }` with a
   message that cannot contain credentials.

No `GET` export — §14 forbids switching scraping between methods, so an
accidental browser visit gets Next's automatic `405`.

### 13. `app/api/sources/route.ts` — §14

`export const dynamic = "force-dynamic"` (a toggled source must show up
immediately, and `GET` handlers are otherwise cacheable), then
`getActiveSources()` mapped to `{ name, listingUrl, logoUrl }` and returned as
`{ sources: [...], count: n }`. No secret (read route), no ids, no
`parser_strategy`.

### 14. `lib/supabase/queries/articles.ts`

Widen only the return type:

```ts
export async function insertArticles(
  rows: ArticleInsert[],
): Promise<{ inserted: number; error: string | null }>;
```

On PostgREST error keep the existing `logQueryError` call, then return
`{ inserted: 0, error: <code + message> }`. The upsert options and the §10
comment are unchanged.

### 15. `.env.example`

Append, matching the file's existing comment style:

```
# --- Oxylabs Web Scraper API -------------------------------------------------
# Credentials from the Oxylabs dashboard. Server-only: every scrape runs on the
# server (§21) — never a NEXT_PUBLIC_ alias, never logged.
OXY_WSA_USERNAME=your-oxylabs-username
OXY_WSA_PASSWORD=your-oxylabs-password

# --- Admin secret ------------------------------------------------------------
# Shared secret for the `x-SKEW-admin-secret` header on every action route
# (§15). Note the variable name and the header name differ. The guard also
# accepts the header name reused as a variable (`x-SKEW-admin-secret=...`) for
# local development, but THIS is the canonical name and the one to set on
# Vercel. Generate with `openssl rand -hex 32`. Server-only, never in a URL,
# never in browser code.
SKEW_ADMIN_SECRET=generate-a-long-random-string
```

`OPENAI_API_KEY`, `ANALYSIS_BATCH_SIZE`, and `CRON_SECRET` are **not** added —
§19 and §18 own them, and §18/§21 forbid `CRON_SECRET` in `.env.local` at all.

## Security requirements

- `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD` are read in exactly one module,
  `lib/oxylabs/client.ts`, which starts with `import "server-only"`. They never
  appear in a returned error, a log line, or a response body.
- Every new `lib/**` module in the scraping, parsing, and pipeline layers is
  server-only: those with side effects declare `import "server-only"`; the pure
  parsing modules are importable but are never imported by a component.
- No `NEXT_PUBLIC_` variable is added. No browser code gains the ability to
  scrape, call Oxylabs, or mutate pipeline state (§5, §21).
- `POST /api/scrape` requires `x-SKEW-admin-secret` (§15): constant-time
  digest comparison, opaque 401 for missing/wrong/unconfigured, secret never in
  the query string, never returned. The route must not accept a Clerk session
  as an alternative — `proxy.ts` supplies auth context only.
- Zod validates the request body before any Oxylabs call, so an unauthenticated
  or malformed request cannot cause outbound spend.
- Scraped HTML is untrusted input, handled accordingly: it is parsed with
  Cheerio and stored as **text**, never evaluated, never rendered as HTML, and
  never used to build a SQL string. `original_url` is written through
  supabase-js parameter binding.
- Scraped URLs are constrained before any fetch: `https` only, and `sameSite`
  against the source's own `listing_url`, so a manipulated homepage cannot point
  the scraper at an arbitrary host. No redirect chain is followed outside
  Oxylabs.
- §10 append-only is absolute: the pipeline only ever `upsert`s with
  `ignoreDuplicates`. No `delete`, no `update`, no truncate anywhere in it.
- Only active sources are ever fetched (§8), and only from `listing_url` values
  stored in Supabase — no source URL is written into scraping logic (§7).
- Error responses carry no stack traces, no env values, and no upstream
  response bodies beyond a truncated non-secret excerpt.

## Acceptance criteria

1. `POST /api/scrape` with **no** `x-SKEW-admin-secret` header → `401`; with a
   wrong value → `401` with the identical body; with the correct value → `200`
   and a summary object.
2. With `SKEW_ADMIN_SECRET` unset, a correct-looking request still gets `401`
   and the server logs the misconfiguration. It never falls open.
3. `GET /api/scrape` → `405`. `POST /api/sources` → `405`.
4. A default run (no body) resolves all five active sources and targets 5
   articles per source.
5. `{"sources":["NPR"],"perSource":2}` scrapes only NPR and inserts at most 2.
   `{"sources":["Not A Source"]}` returns `unknownSources: ["Not A Source"]` and
   invents nothing.
6. `{"perSource":0}` and `{"unknownKey":1}` → `400` from Zod, and **no** Oxylabs
   call is made.
7. Every inserted row satisfies §13's gate: non-empty `image_url`, non-null
   `published_at`, `raw_text` that reads as one article, and an
   article-specific `title` and `original_url`.
8. **No** homepage, category, section, topic, author, search, show, podcast,
   live, game, product, or corporate page is stored as an article. Spot-check
   with the query in test step F.
9. Re-running the same command immediately inserts **0** new articles and
   reports them all as `duplicatesSkipped` — dedupe works on `original_url` and
   `canonical_url`, and nothing is deleted or replaced (§10).
10. Every stored `slug` matches `^[a-z0-9][a-z0-9-]*$` and is unique; the same
    URL scraped twice yields the same slug.
11. `raw_text` splits into more than one paragraph via `toParagraphs()` for at
    least most inserted articles — i.e. `\n\n` separators are really there.
12. The response summary contains every §9 field — status, sources checked,
    candidates found, candidates rejected, duplicates skipped, detail pages
    scraped, articles inserted, articles rejected, articles failed, total
    duration, and rejection reasons grouped by count — and the counts reconcile:
    `candidatesFound = candidatesRejected + duplicatesSkipped + <attempted> +
    <untouched>`.
13. The dev-server terminal shows each §9 run-logging line, and an attempt-cap
    truncation is visible when it happens (no silent caps).
14. A source whose homepage fetch fails does not abort the run: the other
    sources still complete and `status` is `completed_with_errors`.
15. `logs` gains `scrape.started`, one `scrape.source.completed` per source, and
    `scrape.completed` — and is **not** flooded with per-candidate rows.
16. Inserted articles have `analyzed_at = null` and therefore do **not** appear
    on the home page. That is correct until §19 runs.
17. No credential appears in any response body, log line, or error message.
18. `npm run typecheck`, `npm run lint`, and `npm run build` all pass. No `any`.

## Checks to run

Per §22, from the project root:

```bash
npm run typecheck
npm run lint
npm run build        # new routes and server modules
```

Plus a guard that the service-role key and the Oxylabs credentials are still
read in exactly one module each:

```bash
grep -rn "SUPABASE_SERVICE_ROLE_KEY\|OXY_WSA_" app components lib --include=*.ts --include=*.tsx
# expect: lib/supabase/server.ts and lib/oxylabs/client.ts only
```

Report the exact output. A pre-existing `EBADENGINE` warning for
`@supabase/supabase-js` (wants Node ≥ 22, machine is on v20.20.1) is expected
and is not introduced by this task.

## Manual test steps

### A. Prerequisites

1. **`.env.local` needs no change.** The existing `x-SKEW-admin-secret=<value>`
   line is read by the guard's fallback, so it works as-is. Confirm
   `OXY_WSA_USERNAME` and `OXY_WSA_PASSWORD` are present.
2. **Remove the fabricated fixtures** so the counts and the feed are
   unambiguous — Supabase Dashboard → SQL Editor:

   ```sql
   -- The 9 dummy-fixture-v1 rows from supabase/dummy-articles.sql.
   -- Analyses cascade. Check what you are about to delete first:
   select a.slug, a.title, an.model
   from public.articles a
   join public.article_analyses an on an.article_id = a.id
   where an.model = 'dummy-fixture-v1';

   delete from public.articles
   where id in (select article_id from public.article_analyses
                where model = 'dummy-fixture-v1');

   select count(*) from public.articles;   -- expect 0
   ```

3. Start the dev server and **watch this terminal** — §17: all scrape progress
   is logged there, not in the curl output.

   ```bash
   npm run dev
   ```

4. In a second terminal, export the secret once:

   ```bash
   export ADMIN_SECRET='<the value of x-SKEW-admin-secret / SKEW_ADMIN_SECRET>'
   ```

### B. The secret is enforced (§15)

```bash
# No header → 401
curl -i -X POST http://localhost:3000/api/scrape

# Wrong value → 401, identical body
curl -i -X POST http://localhost:3000/api/scrape \
  -H 'x-SKEW-admin-secret: wrong'

# Wrong method → 405
curl -i http://localhost:3000/api/scrape
```

### C. Read the available sources (§8)

```bash
curl -s http://localhost:3000/api/sources | python3 -m json.tool
```

Expect the five active sources with `name`, `listingUrl`, `logoUrl` — and no
ids, no `parser_strategy`.

### D. Request validation rejects before spending anything

```bash
# perSource below the minimum → 400, and NO Oxylabs call in the dev terminal
curl -i -X POST http://localhost:3000/api/scrape \
  -H "x-SKEW-admin-secret: $ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"perSource":0}'

# Unknown key → 400 (schema is .strict())
curl -i -X POST http://localhost:3000/api/scrape \
  -H "x-SKEW-admin-secret: $ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"unknownKey":1}'

# Unknown source name → 200, reported as unknown, nothing invented
curl -s -X POST http://localhost:3000/api/scrape \
  -H "x-SKEW-admin-secret: $ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"sources":["Not A Source"]}' | python3 -m json.tool
```

### E. One small real scrape first

```bash
curl -s -X POST http://localhost:3000/api/scrape \
  -H "x-SKEW-admin-secret: $ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"sources":["NPR"],"perSource":2}' | python3 -m json.tool
```

In the **dev-server terminal**, expect the §9 lines in order: scrape started,
selected sources, NPR start, homepage fetched with a byte count, candidate links
found, candidates rejected with reasons grouped, duplicates skipped, each detail
page scraped, each article inserted or rejected with its reason, NPR completed,
scrape completed, then the summary object.

### F. The full default run (all five sources, 5 each)

```bash
curl -s -X POST http://localhost:3000/api/scrape \
  -H "x-SKEW-admin-secret: $ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{}' | python3 -m json.tool
```

This can take several minutes. Then verify the stored rows in the SQL Editor:

```sql
-- What landed, per source
select s.name, count(*) as articles
from public.articles a join public.sources s on s.id = a.source_id
group by s.name order by s.name;

-- §13 gate: nothing null, nothing blank, real bodies
select count(*) filter (where image_url is null or btrim(image_url) = '')  as no_image,
       count(*) filter (where published_at is null)                        as no_date,
       count(*) filter (where length(btrim(raw_text)) < 400)               as thin_body,
       count(*) filter (where slug !~ '^[a-z0-9][a-z0-9-]*$')              as bad_slug,
       count(*) filter (where analyzed_at is not null)                     as prematurely_analyzed
from public.articles;
-- expect: 0, 0, 0, 0, 0

-- §9/§11/§12: no listing, category, show, live, or video page stored
select original_url from public.articles
where original_url ~ '/(category|categories|section|sections|topic|topics|tag|tags|author|search|show|shows|program|podcast|podcasts|live|video|videos|game|games|product|shop|newsletter|subscribe|about|contact|support|terms|privacy)(/|$)';
-- expect: 0 rows

-- §13: raw_text really contains paragraph breaks
select slug, length(raw_text) as chars,
       array_length(string_to_array(raw_text, chr(10) || chr(10)), 1) as paragraphs
from public.articles order by scraped_at desc limit 10;
-- expect: most rows with paragraphs > 1

-- Read one body end to end and confirm it reads as ONE article, not a page dump
select title, left(raw_text, 1200) from public.articles
order by scraped_at desc limit 1;

-- §9 run logging persisted
select event, message, context from public.logs order by created_at;
```

### G. Dedupe and append-only (§10)

Re-run the exact command from step F:

```bash
curl -s -X POST http://localhost:3000/api/scrape \
  -H "x-SKEW-admin-secret: $ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{}' | python3 -m json.tool
```

Expect `articlesInserted: 0` and a large `duplicatesSkipped`. Confirm nothing
was lost or rewritten:

```sql
select count(*) from public.articles;          -- unchanged from step F
select count(distinct original_url) from public.articles;  -- equals the above
select min(scraped_at), max(scraped_at) from public.articles;  -- min unchanged
```

### H. A source-level failure does not abort the run

Temporarily point one source at a URL that will fail, run, then restore it:

```sql
update public.sources
set listing_url = 'https://www.npr.org/definitely-not-a-real-homepage-xyz'
where name = 'NPR';
```

```bash
curl -s -X POST http://localhost:3000/api/scrape \
  -H "x-SKEW-admin-secret: $ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"sources":["NPR","BBC News"],"perSource":1}' | python3 -m json.tool
```

Expect `status: "completed_with_errors"`, an entry in `errors` naming NPR, and
BBC News still processed. Then restore:

```sql
update public.sources set listing_url = 'https://www.npr.org/' where name = 'NPR';
```

### I. The home page is still empty — and that is correct

Open `http://localhost:3000/`. Expect the "No articles yet" empty state even
though `articles` now holds real rows: §18 and §19 gate the feed on
`analyzed_at`, which stays null until `POST /api/analyze` exists.

```sql
select count(*) as stored, count(analyzed_at) as analyzed from public.articles;
-- expect: stored > 0, analyzed = 0
```

### J. Credentials never leaked

Scan the full run output and the dev-server scrollback for the Oxylabs username
and the admin secret. Neither may appear anywhere — not in a summary, not in an
error, not in a log row's `context`.
