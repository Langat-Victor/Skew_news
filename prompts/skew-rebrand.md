# SKEW news rebrand

## Goal

Rename the product from **biasly** to **SKEW news** across the whole repo, and
settle the admin-secret naming so the scraping implementation writes it once
instead of writing it and then rewriting it.

Two things, deliberately bundled because they overlap in `AGENTS.md` and
`.env.example`:

1. **Brand rename** — wordmark, page titles, footer, a11y labels, and every
   comment and doc that says "biasly".
2. **Admin secret naming** — header `x-SKEW-admin-secret`, environment variable
   `SKEW_ADMIN_SECRET` with the hyphenated key read as a fallback.

**Run this before `prompts/oxylabs-scraping.md`.** That prompt creates
`lib/api/admin-secret.ts` and `.env.example`'s admin-secret block, so the names
have to be final first.

**Out of scope:** the `README.md` rewrite (it is still untouched
`create-next-app` boilerplate and has never mentioned biasly — rewriting it is
its own task), any visual change beyond the wordmark's own glyphs, and the
`package.json` `name` field (see decision 8).

## Skills read

None. No skill covers a rename, and AGENTS.md §3's four skills
(`clerk`, `supabase`, `web-scraper-api`, `ai-sdk`) have nothing to say about
branding. Per §3 this uses existing project patterns instead.

Consulted instead:

- `node_modules/@next/env/dist/index.js` — the bundled dotenv key pattern, read
  directly to settle whether a hyphenated env key is legal (decision 1).
- `https://vercel.com/docs/rest-api/reference/endpoints/projects/create-one-or-more-environment-variables`
  — the `key` field's published constraints (decision 2).
- MDN / RFC 9110 on HTTP field-name case-insensitivity (decision 3).

## Existing code inspected

A full case-insensitive `grep` for `biasly` across the repo (excluding
`node_modules`, `.git`, `.next`) returns **31 matches in 21 files**. Every one is
listed under "Files likely to change". Findings that shaped the plan:

- `components/ui/logo.tsx` — the wordmark is a **text-based two-line lockup**,
  no SVG asset: `<span>biasly</span>` over `<span>News</span>`, stacked with
  `inline-flex flex-col items-end`. So the rename is a text edit, not an asset
  swap. Its size map is `sm: { word: "text-h3", sub: "text-caption" }` and
  `md: { word: "text-h1", sub: "text-h4" }`.
- `app/globals.css` — the type scale the lockup uses: `--text-h1: 32px/1.2`,
  `--text-h3: 20px/1.3`, `--text-h4: 16px/1.4`, `--text-caption: 11px/1.4`.
  Only a comment on line 4 mentions the brand; **no token changes**.
- `components/layout/site-footer.tsx:62` — `© 2026 Biasly News.` This is the one
  place the brand appears title-cased as "Biasly", so a naive
  `s/biasly/SKEW/` would miss it. The rename must be case-insensitive.
- `app/layout.tsx:17` — `title: "biasly — Balanced news coverage, powered by
  AI."`, plus a brand mention in the Clerk-theming comment on line 22.
- `app/(auth)/layout.tsx:16` — `aria-label="biasly home"`. An **accessibility
  string**, not decoration: screen readers announce it, so it renames too.
- `app/(site)/news/[slug]/page.tsx:41,44`, `app/design-system/page.tsx:34,36`,
  `app/(auth)/sign-in/[[...sign-in]]/page.tsx:5`,
  `app/(auth)/sign-up/[[...sign-up]]/page.tsx:5` — `— biasly` metadata suffixes.
- `AGENTS.md` — 8 matches. Two are the brand (lines 3, 21); **six are the admin
  secret** (408, 424, 436, 516, 534, 655), which is why the secret rename cannot
  be separated from the brand rename.
- `proxy.ts:7,18` — comments only. Line 18 records the rule that the action
  routes authenticate with the admin-secret header rather than a Clerk session,
  so the header name there must stay correct or the comment starts lying.
- `.env.example:1,10` — the file header and the "later features append their own
  blocks" note.
- `supabase/schema.sql:2`, `supabase/seed.sql:2` — brand in a header comment.
- `supabase/dummy-articles.sql:2,43,258,268` — line 2 is a header comment, but
  **lines 43, 258, and 268 are the `https://cdn.example.com/biasly-dummy/`
  image-URL literal**, which is a live data key. See decision 7.
- `README.md`, `package.json` — **zero** brand matches. Boilerplate.
- `lib/**` — **zero** matches. The whole data and query layer is brand-free, so
  no TypeScript logic changes at all.

### Verified facts about the env key

Established rather than assumed, because I previously told the user the
hyphenated key could not work and that was wrong:

- `@next/env`'s bundled dotenv parses keys with the character class `[\w.-]+`,
  read straight out of `node_modules/@next/env/dist/index.js`. Hyphens are legal.
- Confirmed empirically: a `.env.local` containing
  `x-SKEW-admin-secret=hyphen-key-value` loads through `loadEnvConfig()` and
  reads back correctly as `process.env["x-SKEW-admin-secret"]`.
- The earlier failure was **bash**, not Next: `set -a && . ./.env.local` exits
  127 because a hyphen is not a legal shell identifier.
- Vercel's REST API declares the env `key` as `{"type": "string"}` with **no
  published pattern**, `maxLength`, or character restriction. So whether the
  dashboard accepts a hyphenated name at deploy time is **unverified** — not
  known to fail, not known to work.

## Decisions and assumptions

### Confirmed with the user

1. **Wordmark is "SKEW" over "news"** — bold caps `SKEW` on the first line,
   medium lowercase `news` beneath, keeping the existing two-line stacked
   lockup and its size map. Full name in prose and titles is **SKEW news**.
2. **The admin secret is read from both keys**: `SKEW_ADMIN_SECRET` first,
   falling back to `process.env["x-SKEW-admin-secret"]`. The user's existing
   `.env.local` then works untouched, and a Vercel deploy has a conventional
   name available if the dashboard rejects hyphens. Cost of the fallback is one
   `??` and a comment explaining why it exists.
3. **The request header is `x-SKEW-admin-secret`**, exactly as the user wrote
   it. This is free: HTTP field names are case-insensitive (RFC 9110 §5.1) and
   `Headers.get()` implements that, so `x-SKEW-admin-secret`,
   `x-skew-admin-secret`, and `X-SKEW-Admin-Secret` all match the same header.
   **Code must therefore not "correct" the casing in the lookup string** — and
   equally must not assume the casing matters.

### Rename mechanics

4. **Case-insensitive find, case-aware replace.** Three cased forms exist and
   map differently:

   | Found | Becomes | Where |
   | --- | --- | --- |
   | `biasly` | `SKEW news` in prose and titles; `SKEW` in the wordmark glyph | most files |
   | `Biasly News` | `SKEW news` | `site-footer.tsx:62` |
   | `BIASLY_ADMIN_SECRET` | `SKEW_ADMIN_SECRET` | AGENTS.md, `.env.example` |
   | `x-biasly-admin-secret` | `x-SKEW-admin-secret` | AGENTS.md, `proxy.ts` |

   A blanket `sed s/biasly/SKEW news/g` is wrong on all four rows, so edits are
   made per file, by hand.
5. **The wordmark's two lines are not the same string as the prose name.** The
   logo renders `SKEW` + `news` as two separate elements; prose and `<title>`
   use the single string `SKEW news`. Do not collapse the lockup into one span.
6. **`tracking-tight` comes off the wordmark.** It is currently on
   `<span>biasly</span>` — Tailwind's `-0.025em`, which at `text-h1`'s 32px is
   about −0.8px per gap. That was tuned for six lowercase letters; on four
   bold capitals (`S K E W`) negative tracking reads as cramped, because caps
   have no descenders or x-height variation to separate them. Change to
   `tracking-normal`. `tracking-wide` is the other defensible choice for a caps
   mark — the design-system page renders both sizes, so it can be eyeballed
   there and changed in one line if preferred.
7. **`supabase/dummy-articles.sql`'s `biasly-dummy` URL literal stays.** Lines
   43, 258, and 268 are not branding — they are a **data key**. The string is
   already written into `image_url` on the nine fixture rows in the live
   database, and the file's own verification query and cleanup `DELETE` both
   match on `like 'https://cdn.example.com/biasly-dummy/%'`. Renaming it would
   leave the cleanup statement unable to delete the rows it created. Only line
   2's header comment is rebranded, with a comment added at line 43 recording
   why the literal is deliberately not renamed.
8. **`package.json` `name` stays `news-paper-web`.** It never said "biasly", the
   package is `private: true` and unpublished so the field is cosmetic, and
   renaming the package without renaming the containing directory is half a job
   that leaves the two disagreeing. Out of scope; raise it separately if wanted.
9. **`README.md` stays as-is.** Still stock `create-next-app` text, zero brand
   matches. Rewriting it is a real task, not a rename, and doing it here would
   smuggle unrequested work into a rebrand.
10. **No database migration.** No table, column, index, view, function, or
    constraint name contains the brand — the only SQL matches are comments plus
    decision 7's data literal. `supabase/schema.sql` and `lib/supabase/types.ts`
    need no structural change, so AGENTS.md §7's "update schema.sql and
    types.ts" obligation does not trigger.
11. **No `lib/**` change.** Zero matches there. Worth stating because it is the
    evidence that this rename cannot alter behaviour.

## Files likely to change

**Changed — UI (7 files, 11 matches)**

- `components/ui/logo.tsx` — wordmark glyphs, doc comment, `tracking` (2 + 1)
- `components/layout/site-footer.tsx` — copyright line (1)
- `app/layout.tsx` — metadata title, Clerk-theming comment (2)
- `app/(site)/news/[slug]/page.tsx` — both metadata titles (2)
- `app/design-system/page.tsx` — metadata title and description (2)
- `app/(auth)/layout.tsx` — `aria-label` (1)
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx`,
  `app/(auth)/sign-up/[[...sign-up]]/page.tsx` — metadata titles (1 each)
- `app/globals.css` — design-system header comment (1)

**Changed — config and docs (5 files, 15 matches)**

- `AGENTS.md` — brand (2) + admin secret (6); plus §3's skill-path fix
  (`oxylabs-web-scraper` → `web-scraper-api`) approved with the scraping prompt
- `.env.example` — header comments only (2); the admin-secret **block** belongs
  to the scraping prompt, so the two do not collide
- `proxy.ts` — comments (2)
- `supabase/schema.sql`, `supabase/seed.sql` — header comments (1 each)
- `supabase/dummy-articles.sql` — header comment only (1 of its 4; see
  decision 7)

**Also changed**

- `prompts/oxylabs-scraping.md` — its 25 brand/secret references updated to the
  settled names, so the approved prompt cannot be implemented against stale
  ones. Content and scope otherwise untouched.

**Not changed**

- `README.md`, `package.json`, `package-lock.json` (decisions 8, 9)
- All of `lib/**` — zero matches (decision 11)
- `supabase/schema.sql` structure, `lib/supabase/types.ts` (decision 10)
- Every other component — the brand reaches them through `<Logo />`, so they
  need no edit
- Any design token, colour, spacing, or radius

## Implementation requirements

### 1. `components/ui/logo.tsx`

```tsx
/** The "SKEW / news" wordmark lockup. Text-based, no SVG asset. */
```

- First line: `SKEW`. Second line: `news`.
- On the word span, replace `tracking-tight` with `tracking-normal` and add a
  short comment: negative tracking was tuned for lowercase "biasly" and reads
  as cramped on four bold capitals.
- Change nothing else — not `SIZE_CLASSES`, not `items-end`, not the
  `variant`/`size` props, not `font-bold` / `font-medium`.

### 2. Brand strings

| File | From | To |
| --- | --- | --- |
| `components/layout/site-footer.tsx:62` | `© 2026 Biasly News. All rights reserved.` | `© 2026 SKEW news. All rights reserved.` |
| `app/layout.tsx:17` | `biasly — Balanced news coverage, powered by AI.` | `SKEW news — Balanced news coverage, powered by AI.` |
| `app/layout.tsx:22` | `…with the biasly design system` | `…with the SKEW news design system` |
| `app/(site)/news/[slug]/page.tsx:41` | `Article not found — biasly` | `Article not found — SKEW news` |
| `app/(site)/news/[slug]/page.tsx:44` | `${article.title} — biasly` | `${article.title} — SKEW news` |
| `app/design-system/page.tsx:34` | `Design System — biasly` | `Design System — SKEW news` |
| `app/design-system/page.tsx:36` | `…UI primitives for biasly.` | `…UI primitives for SKEW news.` |
| `app/(auth)/layout.tsx:16` | `aria-label="biasly home"` | `aria-label="SKEW news home"` |
| `app/(auth)/sign-in/…/page.tsx:5` | `Sign in — biasly` | `Sign in — SKEW news` |
| `app/(auth)/sign-up/…/page.tsx:5` | `Sign up — biasly` | `Sign up — SKEW news` |
| `app/globals.css:4` | `biasly design system tokens` | `SKEW news design system tokens` |
| `supabase/schema.sql:2` | `biasly — canonical Supabase schema` | `SKEW news — canonical Supabase schema` |
| `supabase/seed.sql:2` | `biasly — source seed` | `SKEW news — source seed` |
| `supabase/dummy-articles.sql:2` | `biasly — DUMMY articles…` | `SKEW news — DUMMY articles…` |
| `.env.example:1` | `biasly environment variables` | `SKEW news environment variables` |

`app/layout.tsx`'s `description` ("Balanced news coverage, powered by AI.")
carries no brand and stays byte-identical.

### 3. Admin secret names

**`AGENTS.md`** — six edits:

- §15 line 408: header → `x-SKEW-admin-secret`; variable → `SKEW_ADMIN_SECRET`.
  Append one sentence: the legacy hyphenated key `x-SKEW-admin-secret` is also
  accepted as an environment variable name for local development.
- §16 line 424, §17 line 436, §19 line 534: header → `x-SKEW-admin-secret`.
- §18 line 516: `BIASLY_ADMIN_SECRET` → `SKEW_ADMIN_SECRET` (the rule that the
  cron route must **not** use it is unchanged).
- §21 line 655 env table: variable cell → `SKEW_ADMIN_SECRET`, purpose cell →
  `x-SKEW-admin-secret`.

**`.env.example:10`** — `BIASLY_ADMIN_SECRET` → `SKEW_ADMIN_SECRET` in the
"later features append their own blocks" list. The actual variable block is
added by the scraping prompt.

**`proxy.ts`** — line 7 `biasly is a public reader site` → `SKEW news is a
public reader site`; line 18 `x-biasly-admin-secret` → `x-SKEW-admin-secret`.

### 4. `prompts/oxylabs-scraping.md`

Update its brand and secret references only:

- `BIASLY_ADMIN_SECRET` → `SKEW_ADMIN_SECRET` throughout, including the
  `.env.example` block, the `lib/api/admin-secret.ts` spec, the acceptance
  criteria, and the test steps.
- `x-biasly-admin-secret` → `x-SKEW-admin-secret` in every curl command and
  every §15 reference.
- Replace the `.env.local` "blocker" subsection: the hyphenated key is no
  longer a blocker, because the guard reads both. State instead that
  `x-SKEW-admin-secret` in `.env.local` works as-is, and that
  `SKEW_ADMIN_SECRET` is the name to use on Vercel.
- Its `lib/api/admin-secret.ts` spec gains the fallback read and the
  case-insensitivity note from requirement 5.
- Change no other part of that prompt: scope, module layout, parsing rules, and
  acceptance criteria all stay as approved.

### 5. Forward contract for `lib/api/admin-secret.ts`

Not created here — the scraping prompt creates it — but its naming is fixed now
so it is written once:

```ts
// SKEW_ADMIN_SECRET is the canonical name and the one to set on Vercel, whose
// env-var key constraints are undocumented. The hyphenated form is the header
// name reused as a variable name in local .env.local files; @next/env's dotenv
// accepts it ([\w.-]+), so it is read as a fallback. Note that a hyphenated
// name is NOT a legal shell identifier, so `. .env.local` cannot source it.
const expected =
  process.env.SKEW_ADMIN_SECRET ?? process.env["x-SKEW-admin-secret"];

// Headers.get() is case-insensitive (RFC 9110 §5.1), so this matches
// x-SKEW-admin-secret, x-skew-admin-secret, and X-SKEW-Admin-Secret alike.
const provided = request.headers.get("x-skew-admin-secret");
```

Neither name may appear in a response body, and neither value may be logged.
With both unset the guard logs a misconfiguration and returns `401` — it must
never fall open.

## Security requirements

- This rename must not change a single security boundary. Specifically: no
  variable gains a `NEXT_PUBLIC_` prefix, no server-only module becomes
  client-importable, and `proxy.ts` stays a bare `clerkMiddleware()` whose
  matcher is untouched.
- The admin secret's **value** is never printed, echoed, committed, or copied
  into `.env.example`, whose placeholders stay placeholders.
- Reading two env keys instead of one widens the *name* surface, never the
  permission: both resolve to the same single secret, the comparison is
  unchanged, and an unset-both case still returns `401`.
- `.env.local` is gitignored and stays that way; this task edits only
  `.env.example`.
- `supabase/dummy-articles.sql` is fabricated fixture data and stays clearly
  labelled as such — its "THIS IS FABRICATED DATA" and "Never run this against
  a production project" warnings must survive the rebrand verbatim.

## Acceptance criteria

1. `grep -rniI biasly` over the repo (excluding `node_modules`, `.git`,
   `.next`) returns **only** the three `cdn.example.com/biasly-dummy/`
   literals in `supabase/dummy-articles.sql` (decision 7). No other match, in
   any casing, in any file — including `prompts/`.

   **One exemption: this file.** A before → after mapping table cannot state its
   own "before" without naming the old brand, so `prompts/skew-rebrand.md` is
   the record of the rename and keeps every reference it needs. Verify with
   `--exclude=skew-rebrand.md`; every *other* file must be clean.
2. `grep -rn "BIASLY_ADMIN_SECRET\|x-biasly-admin-secret"` returns **nothing**.
3. The header wordmark renders `SKEW` over `news`, right-aligned, at both `sm`
   and `md`, in light and dark variants, with the caps no longer negatively
   tracked.
4. The footer reads `© 2026 SKEW news. All rights reserved.`
5. Browser tab titles: `SKEW news — Balanced news coverage, powered by AI.` on
   the home page, `Sign in — SKEW news`, `Sign up — SKEW news`,
   `Design System — SKEW news`, and `<article title> — SKEW news` on a details
   page.
6. The auth-page home link's accessible name is `SKEW news home`.
7. `AGENTS.md` §15, §16, §17, §18, §19, and §21 all name
   `x-SKEW-admin-secret` and `SKEW_ADMIN_SECRET`, consistently, with no
   leftovers; §3 points at `.agents/skills/web-scraper-api`.
8. `prompts/oxylabs-scraping.md` names the settled header and variable
   everywhere, and its scope, module layout, and acceptance criteria are
   otherwise unchanged from the approved version.
9. `supabase/dummy-articles.sql`'s cleanup `DELETE` still matches the nine rows
   currently in the database — i.e. its `like` pattern is untouched.
10. No design token, colour, spacing value, radius, or font weight changed.
11. `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
12. Zero behavioural change: no route, query, type, or component signature is
    different. The only runtime-visible differences are rendered text, the
    wordmark's letter-spacing, and metadata strings.

## Checks to run

Per §22, from the project root:

```bash
npm run typecheck
npm run lint
npm run build        # metadata and a component changed
```

Plus the two rename-completeness greps, which are the real test here:

```bash
# Expect ONLY the 3 cdn.example.com/biasly-dummy/ data literals.
grep -rniI "biasly" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .

# Expect no output at all.
grep -rnI "BIASLY_ADMIN_SECRET\|x-biasly-admin-secret" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .
```

Report exact output. The pre-existing `EBADENGINE` warning for
`@supabase/supabase-js` (wants Node ≥ 22, machine is on v20.20.1) is unrelated.

## Visual expectations

The only rendered geometry that changes is the wordmark's own glyphs. Everything
around it — header height, footer bar, auth-page lockup, and the spacing tokens
they use — is untouched, so the lockup must keep its existing footprint.

**Structure (unchanged).** `inline-flex flex-col items-end leading-none`: two
lines, right-aligned to a common right edge, no leading gap between them.

**Typography.**

| Size | Line 1 `SKEW` | Line 2 `news` |
| --- | --- | --- |
| `md` (default) | `text-h1` 32px / 1.2, `font-bold`, `tracking-normal` | `text-h4` 16px / 1.4, `font-medium` |
| `sm` (header, footer) | `text-h3` 20px / 1.3, `font-bold`, `tracking-normal` | `text-caption` 11px / 1.4, `font-medium` |

Poppins, inherited from `<body class="font-sans">`. No new weight is requested —
400/500/600/700 are already loaded in `app/layout.tsx`, and the lockup uses 700
and 500.

**Letter-spacing.** `tracking-tight` → `tracking-normal` on line 1 only, per
decision 6. Line 2 has no tracking class and gains none.

**Proportions.** `SKEW` is four capitals where `biasly` was six lowercase
letters, so line 1 gets **narrower** while keeping its 32px cap height. The
right-aligned stack absorbs this without any layout shift, since the lockup is
`inline-flex` and sized by content. The `news` subline is four lowercase letters
against `News`' four — effectively identical width, one less cap.

**Colour.** Unchanged and token-driven: `text-text-primary` for `light`,
`text-white` for `dark`. No new colour, and the footer's `text-white/50`
copyright keeps its opacity.

**Responsiveness.** No breakpoint-specific rule is added. The `sm`/`md` prop is
chosen by the calling layout exactly as before, so the header, footer, and
auth-page lockups all keep their current sizes at every width. Verify no
horizontal overflow at 320px, and that the two-line stack never wraps to three.

## Manual test steps

### A. Rename completeness (the actual point of the task)

```bash
# Expect ONLY the 3 cdn.example.com/biasly-dummy/ literals in dummy-articles.sql
grep -rniI "biasly" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .

# Expect nothing
grep -rnI "BIASLY_ADMIN_SECRET\|x-biasly-admin-secret" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .

# Expect matches in AGENTS.md, .env.example, proxy.ts, prompts/oxylabs-scraping.md
grep -rnI "SKEW_ADMIN_SECRET\|x-SKEW-admin-secret" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .
```

### B. Wordmark, both sizes and both variants

```bash
npm run dev
```

1. `http://localhost:3000/design-system` — the logo section renders both `sm`
   and `md`. Confirm `SKEW` over `news`, right-aligned, and that the capitals
   are not cramped. This is the page to eyeball `tracking-normal` versus
   `tracking-wide` on.
2. `http://localhost:3000/` — header lockup (`sm`, light) and footer lockup
   (`sm`, dark, white text). Confirm the footer bar's height did not shift.
3. `http://localhost:3000/sign-in` — the auth-page lockup, and hover the home
   link to confirm it still navigates to `/`.

### C. Titles and accessible name

Check each tab title:

| URL | Expected `<title>` |
| --- | --- |
| `/` | `SKEW news — Balanced news coverage, powered by AI.` |
| `/sign-in` | `Sign in — SKEW news` |
| `/sign-up` | `Sign up — SKEW news` |
| `/design-system` | `Design System — SKEW news` |
| `/news/<any slug>` | `<article title> — SKEW news` |
| `/news/does-not-exist` | `Article not found — SKEW news` |

Then, on `/sign-in`, inspect the home link and confirm
`aria-label="SKEW news home"`.

### D. Responsive check

At 320px, 768px, and 1280px: the wordmark stays two lines, the header does not
overflow horizontally, and the footer copyright line reads
`© 2026 SKEW news. All rights reserved.`

### E. The fixture cleanup still works

Confirm the rename did not break `dummy-articles.sql`'s ability to remove its
own rows — Supabase Dashboard → SQL Editor:

```sql
-- Must still return the 9 fixture rows (the like-pattern was left alone).
select count(*) from public.articles
where image_url like 'https://cdn.example.com/biasly-dummy/%';
-- expect: 9
```

Do **not** delete them here — that is step A of the scraping prompt's own test
plan.

### F. Nothing else moved

```bash
git diff --stat
```

Expect changes confined to the 13 files listed under "Files likely to change".
No `lib/**` file, no `README.md`, no `package.json`, and no other component may
appear in the diff.
