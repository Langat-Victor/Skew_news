# Prompt: SKEW news Home Page UI

## Goal

Build the SKEW news home page from the attached UI reference as a real, responsive Next.js route, reusing the Design System v1.0 tokens and primitives already in the repo.

The reference is a full-page composition made of four site-chrome bands plus the content area:

1. **Utility bar** — dark strip: browser-extension link, theme switcher, live date, location, edition selector.
2. **Site header** — white: menu icon, `SKEW / news` lockup, primary nav (`Home` active, `For You` with an unread dot, `Local`, `Blindspot`), `Subscribe` + `Login` actions.
3. **Topic rail** — white, horizontally scrollable row of `+` chips with an overflow affordance on the right.
4. **Main** — `Top News` heading over a 3-column grid of 12 news cards on the surface background.
5. **Site footer** — dark: lockup + tagline, `Company` / `Help` / `Connect` columns, copyright bar.

This is a **presentational** task. No Supabase, no Clerk, no scraping, no AI, no route handlers. The grid renders a typed local mock module.

---

## Skills read

- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` — `layout.tsx` / `page.tsx` conventions, nested layouts, route groups for shared chrome.
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — when a Client Component is required (state, `useEffect`, browser APIs) vs. keeping everything on the server.
- `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` — local vs. remote `next/image`, why remote hosts need `images.remotePatterns`, `width`/`height` for layout stability.
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` and `13-fonts.md` — already applied by the design-system task; re-read to confirm no token or font changes are needed here.

Not applicable (AGENTS.md §3): `clerk`, `supabase`, `oxylabs-web-scraper`, `ai-sdk` — this task touches no auth, database, scraping, or model code.

---

## Existing code inspected

| File | State | Effect on this task |
|---|---|---|
| `app/page.tsx` | Placeholder: `Logo` + tagline + link to `/design-system`. | **Replaced** by the real home page. |
| `app/layout.tsx` | Root layout: Poppins via `next/font/google`, `LayoutProps<"/">`, `min-h-full flex flex-col` body. | Unchanged except metadata. Site chrome must **not** go here — `/design-system` renders under it. |
| `app/globals.css` | Tailwind v4 `@theme` token layer: colors, `--text-*` scale, radius, shadows, `--container-page: 1280px`. | **No new tokens needed.** Everything in the reference maps to an existing token. |
| `app/design-system/page.tsx` | Showcase sheet with its own footer, `mx-auto max-w-page px-6 py-8` container, `DIAGRAM_FILL` precedent for documented non-token literals. | Must render **unchanged** after this task. Container pattern is reused. |
| `components/ui/logo.tsx` | `variant: light \| dark`, `size: sm \| md`. | Reused as-is: `size="sm"` in the header, `variant="dark" size="sm"` in the footer. |
| `components/ui/button.tsx` | `buttonClasses(variant, className)` exported so non-`<button>` elements can take button styling. | Reused for `Subscribe` (primary) and `Login` (secondary). |
| `components/ui/chip.tsx` | Pill + lucide `Plus`, renders a non-interactive `<span>`. | Reused as-is for the topic rail. |
| `components/ui/bias-meter.tsx` | `variant: full \| compact`, proportional flex segments, dev sum-100 warning, `role="img"` + `aria-label`, `truncate` on labels. | Reused, **one additive prop** (see decision 4). |
| `components/ui/article-card.tsx` | Horizontal card: 200×136 inset image, summary, `Clock` + `Bookmark` footer. | **Left untouched** (see decision 3). |
| `components/ui/panel.tsx` | Showcase-only section container. | Not used here. |
| `lib/utils.ts` | `cn()` with `font-size` class group extended for `text-h1`…`text-caption`. | Reused by every new component. |
| `next.config.ts` | Empty config, no `images.remotePatterns`. | **Stays empty** (see decision 2). |
| `package.json` | `next@16.3.2`, `react@19.2.8`, `lucide-react@1.34.0`, `clsx`, `tailwind-merge`. `typecheck` + `lint` scripts exist. | No new dependencies. |

**lucide-react 1.34.0 verified against `dist/lucide-react.d.ts`:** `Menu`, `ChevronDown`, `ChevronRight`, `Globe`, `MapPin`, `Info`, `Plus`, `Landmark`, `HeartPulse`, `Atom`, `Building2`, `Rocket`, `Cpu`, `ThermometerSun`, `TrendingUp`, `Trophy`, `Flame` all exist. **Brand icons do not** — there is no `Twitter`, `Linkedin`, `Instagram`, `Youtube`, or `Facebook` (lucide dropped brand marks). The footer's four social glyphs must be authored as inline SVG (see decision 5).

---

## Decisions and assumptions

Confirmed with the user:

1. **Data source — hardcoded mock module.** Supabase is not wired (no `lib/supabase`, no schema). The 12 stories live in a typed `lib/mock/top-news.ts` shaped to the future `articles` + `article_analyses` join (AGENTS.md §7), so replacing it with a Supabase query is a one-file change. No DB, no network.
2. **Card images — local gradient placeholders, no remote domains.** `next.config.ts` gains nothing; no `images.remotePatterns`, no network at build or runtime.
   - **Refinement of the chosen option, applied deliberately:** the placeholders are rendered **in-component as a CSS gradient + a large low-opacity category icon**, not committed as SVG files under `public/`. Rationale: `next/image` refuses to optimize an SVG `src` unless `images.dangerouslyAllowSVG` is enabled, and turning that flag on — plus its companion CSP — purely for throwaway mock art is a bad trade against AGENTS.md §21. A CSS gradient gives the identical result (local, deterministic, no remote host, no committed binaries) with zero config and zero files to delete later. The real `next/image` branch is still implemented and is what renders as soon as a scraped `image_url` exists.
3. **Interactivity — presentational only.** The topic rail scrolls natively (real `overflow-x`), `Home` is a real `<Link href="/">`. Controls whose backing feature does not exist yet — theme switcher, edition selector, `Set Location`, `Browser Extension`, menu icon, `Subscribe`, `Login`, `For You` / `Local` / `Blindspot`, the rail's overflow chevron — render as **visually correct inert markup**, not as focusable no-op `<button>`s or `href="#"` links. A focusable control that does nothing is an accessibility lie and a 404 on click is worse than no link; each one carries a `TODO` comment naming the task that will activate it. No theme toggle is wired because the token layer is light-only (design-system decision 4) — a working switch would visibly do nothing.

Assumptions made without asking:

4. **`BiasMeter` gains one optional prop, not a rewrite.** The reference labels the left segment `L 20%` while keeping `Center 31%` / `Right 49%` spelled out — the left segment is the narrowest and abbreviating buys it room. Add `labels?: "long" | "short"`, defaulting to `"long"` so `/design-system` and `ArticleCard` are byte-identical in output; `"short"` renders `L {n}%` and leaves center/right unchanged. Do **not** change the existing label strings.
5. **A new `NewsCard` component rather than a variant of `ArticleCard`.** The two cards differ structurally, not cosmetically: the reference card puts a **full-bleed 16:9 image at the top** (flush to the card's edges, top corners rounded, padding on the content block only), drops the summary entirely, and replaces the `Clock`/`Bookmark` footer with a `N sources` line. `ArticleCard` insets a 200×136 image inside `p-4`. Forcing both render trees through one component means a discriminated union and two branches sharing almost no markup. `NewsCard` composes the same `BiasMeter` and the same tokens, so nothing drifts; `ArticleCard` stays the design-system specimen it was built as.
6. **Site chrome lives in a `(site)` route group, not the root layout.** `app/(site)/layout.tsx` wraps the utility bar / header / topic rail / footer around `app/(site)/page.tsx`. Route groups do not affect the URL, so the home page stays at `/`, and `/design-system` — which has its own footer and must not inherit product chrome — is untouched. The news details page (AGENTS.md §1) drops into the same group and inherits the chrome for free.
7. **The date is live, via one small Client Component.** A news masthead showing a build-frozen date is wrong, and `new Date()` in a Server Component bakes the build date into the static prerender. `components/layout/current-date.tsx` (`"use client"`) formats `new Date()` in a mount effect and reserves its width so there is no hydration mismatch and no layout shift. This is the only client component in the task.
8. **Two reference bias triples are corrected to sum to 100.** AGENTS.md §19 requires `left + center + right === 100` and `BiasMeter` warns in dev otherwise. The reference has two arithmetic errors: the oil-prices card reads `25 / 50 / 28` (103) and the SpaceX card reads `12 / 45 / 49` (106). Rule applied uniformly: **keep the left and right percentages as drawn and adjust center**, since center is the least load-bearing number. → `25 / 47 / 28` and `12 / 39 / 49`. The other ten triples already sum to 100 and are used verbatim.
9. **The first topic chip's label is inferred.** The reference rail is drawn mid-scroll, so its first chip is clipped to a bare `+`. The rail renders from the start, so a leading label is needed: use `US Politics`. Every other chip label is transcribed exactly.
10. **`Real Madrid` card keeps its clipped left label.** At `left: 10` the segment is too narrow for `L 10%` and the existing `truncate` clips it to `L…`, exactly as the reference shows. This is correct behaviour, not a bug to work around.
11. **Placeholder gradient hexes are documented non-token literals**, following the `DIAGRAM_FILL` precedent in `app/design-system/page.tsx`. They are mock art, not brand colors, and are commented as such — they leave with the mock module.
12. **`Top News` is the page `<h1>`** styled at `text-h2` size. The reference's visual weight matches `--text-h2`, but the page needs exactly one `h1` and this is it. Card titles are `<h3>` inside `<article>` elements.

---

## Files likely to change

**New:**

```
app/(site)/layout.tsx                  utility bar + header + topic rail + footer chrome
app/(site)/page.tsx                    Top News heading + 12-card grid
components/layout/utility-bar.tsx      dark strip
components/layout/site-header.tsx      logo, nav, Subscribe/Login
components/layout/topic-rail.tsx       scrollable chip row + overflow fade
components/layout/site-footer.tsx      dark footer, 3 link columns, copyright
components/layout/current-date.tsx     "use client" — live formatted date
components/ui/news-card.tsx            stacked card: full-bleed image, meta, title, bias, sources
components/ui/social-icon.tsx          4 inline-SVG brand glyphs (lucide has none)
lib/mock/top-news.ts                   12 typed stories + category placeholder art map
```

**Modified:**

```
components/ui/bias-meter.tsx           + optional `labels?: "long" | "short"`
app/layout.tsx                         metadata only (title/description for the home page)
```

**Deleted:**

```
app/page.tsx                           moved to app/(site)/page.tsx and rewritten
```

**Untouched — regression surface to verify:** `app/globals.css`, `app/design-system/page.tsx`, `components/ui/article-card.tsx`, `components/ui/panel.tsx`, `components/ui/button.tsx`, `components/ui/chip.tsx`, `components/ui/logo.tsx`, `next.config.ts`, `package.json`.

---

## Visual interpretation of the reference

Measurements are taken from the reference render (1024px wide) and divided by the **0.75 scale factor** implied by the card geometry: three columns at a measured 295px inside a `--container-page` (1280px) container with `px-6` margins and a 24px gutter gives `(1280 − 48 − 48) / 3 = 394.7px` per card, and `295 / 0.75 = 393px`. So the reference is a 1366px-wide viewport at 75%, and **every derived value below lands on an existing token** — no arbitrary values are needed.

| Reference band | Measured (1024px) | Derived (design px) | Token / class |
|---|---|---|---|
| Utility bar height | 27px | 36px | `text-caption` + `py-2.5` |
| Header height | 61px | 81px | `py-4` around 44px controls |
| Topic rail height | 44px | 56px | `py-3` around `Chip` |
| Card width | 295px | 393px | 3 cols, `gap-6`, `max-w-page px-6` |
| Card image | 295×168px | 393×221px | `aspect-video` (16:9 = 1.778; measured 1.756) |
| Card content padding | 12px | 16px | `p-4` |
| Card title | ~16px, 2–3 lines | ~21px | `text-h3 font-semibold` |
| Card meta line | ~11px | ~14px | `text-body-sm text-text-secondary` |
| Bias bar | 17px tall, ~9px labels | 23px, ~12px | `BiasMeter variant="compact"` (`h-5`, `text-caption`) |
| `N sources` | ~10px, grey | ~13px | `text-body-sm text-text-secondary` |
| Row gap | 18px | 24px | `gap-6` |

### Band 1 — utility bar

Full-bleed `bg-text-primary` (#0D0D0F), `text-caption`. Content in the shared `max-w-page px-6` container, `flex items-center justify-between`.

- **Left group** (`flex items-center gap-6`): `Browser Extension` in `text-white/70`; then the theme switcher — the literal label `Theme:` in `text-white/70` followed by `Light` `Dark` `Auto` in `gap-2`, where `Light` is `text-white font-medium` (active) and the other two are `text-white/50`. Inert `<span>`s.
- **Right group** (`flex items-center gap-5`, `text-white/70`): `<CurrentDate />`; `Set Location`; then `Globe` (12px) + `International Edition` + `ChevronDown` (12px) in a `gap-1.5` row.
- Below `md`, hide the theme switcher, `Set Location`, and `Browser Extension`; keep the date and edition selector. The bar must never wrap to two lines.

### Band 2 — site header

`bg-bg-primary`, `border-b border-border`, container `flex items-center justify-between py-4`.

- **Left** (`flex items-center gap-6`): `Menu` icon at 24px, `text-text-primary`, inert; `<Logo size="sm" />`; then `<nav>` — `flex items-center gap-7`, each item `text-body-md`.
  - `Home`: active — `text-text-primary font-medium`, with a 2px `bg-text-primary` underline sitting ~10px below the label baseline (`relative` + `after:absolute after:-bottom-2.5 after:h-0.5 after:w-full after:bg-text-primary`). Real `<Link href="/">`.
  - `For You`: `text-text-secondary`, with a 5px `bg-bias-left` dot at the top-right of the label (`absolute -top-0.5 -right-2 size-1.5 rounded-full`), `aria-hidden` — it is decoration until a real unread count exists.
  - `Local`, `Blindspot`: `text-text-secondary`.
  - Nav collapses below `lg`; the `Menu` icon is the stated mobile affordance.
- **Right** (`flex items-center gap-3`): `Subscribe` via `buttonClasses("primary")`, `Login` via `buttonClasses("secondary")`. Rendered as inert `<span>`s carrying the button classes — the reference shows a filled dark pill and a bordered white pill of equal height (44px design). Hide `Subscribe` below `sm`.

### Band 3 — topic rail

`bg-bg-primary`, `border-b border-border`, `py-3`. Inside the container: a `relative` wrapper holding an `overflow-x-auto` flex row of `<Chip>`s at `gap-2`, scrollbar suppressed via `[scrollbar-width:none]` + `[&::-webkit-scrollbar]:hidden`, and `overscroll-x-contain`.

Right edge: an `aria-hidden`, `pointer-events-none` overflow affordance — a `w-12` gradient fade from `bg-bg-primary` to transparent with a `ChevronRight` at 16px `text-text-secondary` on top. It signals overflow; it does not claim to be a button.

Chips, in order (first label inferred per decision 9): `US Politics`, `World Cup`, `IPL`, `Social Media`, `Business & Markets`, `Health & Medicine`, `Soccer`, `Artificial Intelligence`, `Arsenal FC`, `Extreme Weather and Disasters`.

### Band 4 — main

`<main className="flex-1 bg-surface">`, container `py-8`.

- `<h1 className="text-h2 font-semibold text-text-primary">Top News</h1>`, then `mt-6` before the grid.
- Grid: `grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. 12 `<NewsCard>`s in reference order.

**Card anatomy** — `bg-bg-primary border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow`, `overflow-hidden` so the image clips to the top corners, `flex flex-col`:

1. **Image block** — `relative aspect-video w-full`. With `imageUrl`: `next/image` with `fill` + `sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"` + `object-cover`. Without: the gradient placeholder — `bg-linear-to-br` between the category's two documented hexes, with the category's lucide icon centered at 40px and `opacity-25` in white, `aria-hidden`.
2. **Info affordance** — the reference's circled `i` at the image's top-right: `absolute top-3 right-3 size-7 rounded-full bg-bg-primary/95 shadow-sm` with a 16px `Info`. Inert (`<span aria-hidden>`) per decision 3.
3. **Content block** — `flex flex-1 flex-col p-4`:
   - Meta: `{category} · {country}` in `text-body-sm text-text-secondary`, the `·` `aria-hidden`.
   - Title: `<h3 className="mt-1 text-h3 font-semibold text-text-primary">` — **no line clamp**. The reference lets titles run to three lines (`Indigenous Leader Brooklyn Rivera Dies…`, `UN Security Council to Hold Emergency Meeting…`) and clamping them would truncate real headlines mid-word.
   - `<BiasMeter variant="compact" labels="short" />` at `mt-4`, pushed to the block's bottom with `mt-auto` above it so cards in a row align their bias bars regardless of title length — visible in the reference, where row 2's bars sit level despite a 3-line title beside 2-line titles.
   - Footer: `{n} sources` in `text-body-sm text-text-secondary` at `mt-3`. Singular `1 source` handled.

Whole card is wrapped in `<article>`. It is **not** a link — the news details route does not exist yet (`TODO` comment).

### Band 5 — site footer

Full-bleed `bg-text-primary`, container `py-10`.

- Top region: `grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.
  - Column 1: `<Logo variant="dark" size="sm" />`, then `Balanced news coverage powered by AI.` in `text-body-sm text-white/60`, `mt-4`, constrained to `max-w-[15rem]` so it breaks over two lines as drawn.
  - Column 2 `Company`: About, Careers, Press, Contact.
  - Column 3 `Help`: Help Center, Guides, Privacy Policy, Terms of Service.
  - Column 4 `Connect`: the four social glyphs in a `flex gap-4` row, 18px, `text-white/60`.
  - Column headings: `text-body-sm font-semibold text-white`, `mb-3`. Link labels: `text-body-sm text-white/60`, `space-y-2`, inert `<span>`s (no destination pages exist).
- Bottom bar: `mt-10 border-t border-white/10 pt-5`, `© 2026 SKEW news. All rights reserved.` in `text-caption text-white/50`. The original reference title-cased the brand here differently from its own lowercase lockup; the rebrand (`prompts/skew-rebrand.md`) settled that inconsistency on `SKEW news` for all prose, so this line is now the post-rebrand copy rather than a verbatim transcription.

---

## Implementation requirements

### `lib/mock/top-news.ts`

Export a `TopNewsStory` type mirroring the eventual `articles` + `article_analyses` join so the Supabase swap is mechanical:

```ts
export type TopNewsStory = {
  id: string;
  title: string;
  category: string;
  country: string;
  imageUrl?: string;   // undefined until scraping populates articles.image_url
  bias: BiasBreakdown; // left + center + right === 100 (AGENTS.md §19)
  sourceCount: number;
};
```

Also export the category → placeholder art map (gradient pair + lucide icon), commented as mock-only art per decision 11.

The 12 stories, in reference order — titles transcribed exactly:

| # | Category · Country | Title | L / C / R | Sources |
|---|---|---|---|---|
| 1 | Politics · United States | Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report | 20 / 31 / 49 | 12 |
| 2 | Health · United States | Researchers Make Case for Grapes as a 'Superfood' After Review of Health Evidence | 18 / 42 / 40 | 7 |
| 3 | Science · Switzerland | CERN Finds High-Significance Hint of Physics Beyond Standard Model | 16 / 62 / 22 | 8 |
| 4 | World · Nicaragua | Indigenous Leader Brooklyn Rivera Dies in Nicaragua After Nearly 3 Years of Detention | 54 / 28 / 18 | 63 |
| 5 | World · Middle East | UN Security Council to Hold Emergency Meeting as Israel Pushes Deeper into Lebanon | 22 / 35 / 43 | 15 |
| 6 | Business · Global | Oil Prices Dip as OPEC+ Considers Output Increase Amid Weak Demand | 25 / **47** / 28 | 11 |
| 7 | Technology · United States | SpaceX Launches Starship Test Flight in Milestone for Mars Program | 12 / **39** / 49 | 9 |
| 8 | Business · United States | Apple Unveils AI-Powered Features Across iPhone, iPad and Mac | 15 / 40 / 45 | 10 |
| 9 | Climate · Global | 2025 on Track to Be Among Top 3 Hottest Years, EU Climate Service Says | 33 / 34 / 33 | 14 |
| 10 | Economy · United States | Fed Holds Rates Steady, Signals Caution on Inflation and Growth Outlook | 30 / 45 / 25 | 13 |
| 11 | Soccer · Europe | Real Madrid Win Champions League After Comeback Victory in Final | 10 / 20 / 70 | 26 |
| 12 | Environment · Canada | Wildfires Force Thousands to Evacuate Across Western Canada | 27 / 33 / 40 | 17 |

Bold = corrected per decision 8; comment each correction inline so the reference mismatch is traceable.

Category icons: Politics → `Landmark`, Health → `HeartPulse`, Science → `Atom`, World → `Globe`, Business → `Building2`, Technology → `Rocket`, Climate → `ThermometerSun`, Economy → `TrendingUp`, Soccer → `Trophy`, Environment → `Flame`. Unknown category falls back to `Newspaper` + a neutral gradient — the map must not be able to throw on a category that arrives later from the DB.

### `components/ui/bias-meter.tsx`

Add `labels?: "long" | "short"` (default `"long"`). Only the left segment's text differs: `"long"` → `Left {left}%` (unchanged), `"short"` → `L {left}%`. The `aria-label` stays fully spelled out in both modes — the abbreviation is a space constraint, not an accessibility one. Do not touch sizes, colors, the sum-100 warning, or the zero-segment filter.

### `components/ui/social-icon.tsx`

Four inline SVGs — `x`, `linkedin`, `instagram`, `youtube` — authored to lucide's conventions so they sit consistently beside lucide icons: `24×24` viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, round caps and joins, size driven by a `size` prop. Simple geometric marks (crossing strokes; `in` bar + dot + arm; rounded square + circle + corner dot; rounded rect + play triangle) — no traced brand assets, no new dependency. Export a `SocialIconName` union and a single `<SocialIcon name size />` component.

### Components and boundaries

Every component except `current-date.tsx` is a **Server Component** — no `"use client"`. All hover states are pure CSS. Each component: an exported prop interface, explicit types, no `any`, `className` passthrough merged with `cn()`.

`components/layout/current-date.tsx` is the sole Client Component: `useState<string | null>(null)` + `useEffect` setting `new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())`. Render `<span className="inline-block min-w-[10.5rem] text-right">{date ?? " "}</span>` so the slot is reserved before hydration and nothing shifts.

### Metadata

`app/layout.tsx` keeps its structure; update `metadata` to a home-page-appropriate `title` / `description` (`SKEW news — Balanced news coverage, powered by AI.` is already correct as a root default, so this may be a no-op — confirm rather than churn the file).

---

## Responsiveness

Breakpoints and required behaviour:

| Width | Grid | Chrome |
|---|---|---|
| 375px | 1 column | Utility bar shows date + edition only; nav hidden, `Menu` visible; `Subscribe` hidden, `Login` visible; rail scrolls; footer stacks to 1 column |
| 768px | 2 columns | Utility bar full; nav still hidden; both actions visible; footer 2 columns |
| 1024px | 3 columns | Nav visible; footer 4 columns |
| 1280px+ | 3 columns, container capped at `max-w-page` and centred | Full chrome as drawn |

No horizontal page scroll at any width — the topic rail is the only element allowed to scroll horizontally, and it must not force the page wider. Card titles must not overflow their card at 375px.

---

## Security requirements

- No environment variables read or added; no secrets in play.
- No Supabase / Oxylabs / OpenAI / Clerk imports; no route handlers; no `fetch`.
- No `x-SKEW-admin-secret` surface — this task creates no action routes (AGENTS.md §14/§15 do not apply).
- Only `current-date.tsx` crosses to the client, and it carries no data but a formatted date (AGENTS.md §21).
- `next.config.ts` gains no remote image hosts and `images.dangerouslyAllowSVG` is **not** enabled (decision 2).
- All rendered strings are local literals — no remote or user-supplied content, so no injection or XSS surface. The inline social SVGs are hand-authored static markup, not `dangerouslySetInnerHTML`.

---

## Acceptance criteria

1. `/` renders all five bands in reference order: utility bar, header, topic rail, `Top News` grid, footer.
2. The 12 cards match the table above exactly — category, country, title, percentages, source counts.
3. Every bias triple sums to 100; no `BiasMeter` sum warning appears in the dev console on page load.
4. Card image area is a full-bleed 16:9 block flush to the card's top and side edges, top corners rounded, with the circled `i` at its top-right.
5. Bias bars align across each row regardless of title length (`mt-auto`), and `N sources` sits below the bar.
6. `BiasMeter` shows `L 20%` / `Center 31%` / `Right 49%` on the home page and still shows `Left 25%` on `/design-system` — the new prop is additive and defaults to the old behaviour.
7. The `Real Madrid` card's 10% left segment clips its label rather than overflowing or distorting the bar.
8. Topic rail scrolls horizontally with no visible scrollbar and does not widen the page; the right-edge fade + chevron is `aria-hidden` and not focusable.
9. Tab order contains **only** genuinely working controls — the `Home` link. No focusable element does nothing when activated; no `href="#"` anywhere in the diff.
10. The utility bar date shows today's date in the browser's locale rendering with no hydration warning in the console and no layout shift on load.
11. Footer shows the dark lockup, tagline, `Company` / `Help` / `Connect` columns, four social glyphs, and the copyright bar.
12. `/design-system` is visually and functionally unchanged; `components/ui/article-card.tsx`, `app/globals.css`, `next.config.ts`, and `package.json` are untouched.
13. No new tokens in `app/globals.css`; no `tailwind.config.ts`; no arbitrary color values outside the documented mock-art map.
14. `"use client"` appears in exactly one file.
15. No horizontal page scrollbar at 375px, 768px, 1024px, or 1440px.
16. `npm run typecheck`, `npm run lint`, and `npm run build` all pass clean.

---

## Checks to run

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # new route group + new components — required per AGENTS.md §22
```

Report the exact output. Do not claim a check passed without running it.

---

## Manual test steps

No API routes, secrets, or curl commands apply to this task — AGENTS.md §17's curl guidance covers scraping, scheduler, and analysis work, none of which is touched here.

1. `npm run dev`
2. Open `http://localhost:3000` and compare against the reference top to bottom:
   - **Utility bar** — dark strip; `Browser Extension`, `Theme: Light Dark Auto` with `Light` emphasised; today's date, `Set Location`, globe + `International Edition` + chevron on the right.
   - **Header** — menu icon, `SKEW / news` lockup, `Home` underlined and darker than `For You` / `Local` / `Blindspot`, red dot on `For You`, dark `Subscribe` pill and outlined `Login` pill.
   - **Topic rail** — chips each ending in `+`; drag or shift-scroll the rail and confirm it scrolls under the right-edge fade while the page itself does not move.
   - **Grid** — 3 columns × 4 rows; spot-check card 1 (`Trump Sends Iran Revised Peace Proposal…`, `L 20% / Center 31% / Right 49%`, `12 sources`) and card 4 (`Indigenous Leader Brooklyn Rivera…`, 3-line title, `54 / 28 / 18`, `63 sources`).
   - **Row alignment** — in row 2, confirm the bias bars of the 3-line card and the 2-line cards sit on the same line.
   - **Card 11** — `Real Madrid`: the 10% left segment clips its label, matching the reference.
   - **Hover** a card and confirm the shadow deepens.
   - **Footer** — dark, white lockup, three link columns, four social glyphs, `© 2026 SKEW news. All rights reserved.`
3. Open the browser console and confirm it is clean — no hydration warning, no `BiasMeter` sum warning, no missing-`alt` or `next/image` warning.
4. Watch the date slot on a hard reload: it must not shift the elements around it as it fills in.
5. Resize to 375px, 768px, 1024px, and 1440px. At each width confirm the column count in the responsiveness table, that no horizontal scrollbar appears on the page, and that no card title overflows its card.
6. Press `Tab` from the top of the page: focus should reach the `Home` link and no inert control. Confirm nothing focusable is a dead end.
7. Open `http://localhost:3000/design-system` and confirm the sheet is unchanged — in particular that the card specimen's bias meter still reads `Left 25% / Center 50% / Right 25%`, not `L 25%`.
