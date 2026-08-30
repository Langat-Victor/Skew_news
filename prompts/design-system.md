# Prompt: SKEW news Design System

## Goal

Implement the SKEW news design system from the attached UI reference image as real, reusable code:

1. Design tokens (colors, typography, spacing, radius, shadows, grid) as Tailwind v4 `@theme` tokens in `app/globals.css`.
2. Poppins wired through `next/font/google` in the root layout.
3. Primitive UI components matching the reference exactly: Panel, Button, Chip, BiasMeter, ArticleCard, plus the 15-icon set.
4. A `/design-system` showcase route that reproduces the reference image panel-for-panel so fidelity can be verified in a browser.

This is a **foundation-only** task. No Supabase, no Clerk, no scraping, no AI. The showcase page renders hardcoded local demo data only.

---

## Skills read

- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` — Tailwind v4 setup, global CSS, CSS ordering, `@import "tailwindcss"`.
- `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` — `next/font/google`, variable fonts, `variable` option for CSS-variable wiring.
- `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md` — App Router file conventions.

Not applicable to this task (foundation UI only, per AGENTS.md §3): `clerk`, `supabase`, `oxylabs-web-scraper`, `ai-sdk`.

---

## Existing code inspected

| File | State |
|---|---|
| `app/globals.css` | create-next-app default: `@import "tailwindcss"`, Geist vars, `prefers-color-scheme` dark block, `font-family: Arial` on body. **All of this gets replaced.** |
| `app/layout.tsx` | Geist + Geist_Mono, `LayoutProps<"/">` typed props (Next 16 convention), `h-full antialiased` on `<html>`, `min-h-full flex flex-col` on `<body>`. Keep the structure, swap the font. |
| `app/page.tsx` | Placeholder `const home = () => <div>home</div>`. Lowercase component name — will be normalized to `Home`. |
| `package.json` | Next 16.3.2, React 19.2.8, Tailwind v4.3.3, TypeScript 5. **No `typecheck` script** — AGENTS.md §22 requires one. |
| `postcss.config.mjs` | `@tailwindcss/postcss` — correct for v4, no change. |
| `tsconfig.json` | `strict: true`, `@/*` path alias to project root. |
| `eslint.config.mjs` | flat config, `core-web-vitals` + `typescript`. |
| `components.json` | Absent — shadcn/ui not initialised. |
| `node_modules` | No `lucide-react`, `clsx`, or `tailwind-merge` installed. |

**Tailwind v4 note:** there is no `tailwind.config.ts` and none will be created. v4 is CSS-first — tokens are declared with `@theme` inside `globals.css`.

---

## Decisions and assumptions

Confirmed with the user:

1. **Scope** — tokens + primitives + `/design-system` showcase route.
2. **TEXT SECONDARY hex** — the reference label reads `#6B72B0` but the swatch renders neutral gray. Use **`#6B7280`** (Tailwind gray-500); it is consistent with the `#E5E7EB` border (gray-200). The label is a `8`→`B` rendering artifact.
3. **Icons** — install `lucide-react`. The reference icons are lucide's exact set and default style; it is also the library shadcn/ui assumes, so later shadcn components drop in cleanly.

Assumptions made without asking:

4. **Light mode only.** The reference shows one light theme. The existing `prefers-color-scheme: dark` block is removed rather than extended — a half-specified dark theme is worse than none. Adding dark later is a token-layer change only.
5. **shadcn/ui not initialised in this task.** AGENTS.md §6 lists it in the stack, but the reference specifies bespoke button/chip styling that would immediately override shadcn defaults. Components are written as plain typed React with a `cn()` helper using the same prop patterns shadcn uses (`variant`/`size` + `className` passthrough), so `npx shadcn init` later composes cleanly instead of conflicting.
6. **`clsx` + `tailwind-merge`** installed for `cn()` — the standard class-merge helper. `class-variance-authority` is *not* installed; the variant maps here are small enough for plain lookup objects.
7. **Fixed `MOCK_ARTICLE`** on the showcase page — no `Date.now()`, no random values, so the page renders deterministically.
8. **Card image** — reference shows a photo. Use `next/image` with a neutral gray placeholder `<div>` fallback; no remote domain config needed, no image committed.
9. **Bias percentages sum to 100** in every component and mock (AGENTS.md §19). The reference card panel shows `25/50/49` which sums to 124 — a mock-data error in the mockup. Use `25/50/25` for the card, matching the BIAS METER panel above it.
10. **Spacing scale** — the reference shows 4/8/16/24/32/40/64. Tailwind's default scale already provides all of these (`1/2/4/6/8/10/16`). No custom spacing tokens; document the mapping in a comment.

---

## Files likely to change

**New:**

```
lib/utils.ts                        cn() helper
components/ui/panel.tsx             bordered section container + label header
components/ui/button.tsx            primary/secondary/text × default/hover/outline/disabled
components/ui/chip.tsx              category pill with + affordance
components/ui/bias-meter.tsx        L/C/R bar, full + compact variants
components/ui/article-card.tsx      the card from CARD EXAMPLE
components/ui/logo.tsx             "SKEW / news" lockup, light + dark-on-dark
app/design-system/page.tsx          showcase route
```

**Modified:**

```
app/globals.css                     replaced with @theme token layer
app/layout.tsx                      Poppins, SKEW news metadata, bg/text tokens
app/page.tsx                        normalize `home` → `Home`, link to /design-system
package.json                        + typecheck script, + 3 deps
```

---

## Implementation requirements

### 1. Dependencies

```bash
npm install lucide-react clsx tailwind-merge
```

Add to `package.json` scripts (AGENTS.md §22 requires it and it does not exist yet):

```json
"typecheck": "tsc --noEmit"
```

### 2. `app/globals.css` — token layer

Replace the file entirely. Structure: `@import "tailwindcss";` then a single `@theme` block. Remove the dark-mode block and the `font-family: Arial` body rule.

**Colors** — exact hexes from the reference:

| Token | Hex | Reference label |
|---|---|---|
| `--color-text-primary` | `#0D0D0F` | TEXT PRIMARY |
| `--color-text-secondary` | `#6B7280` | TEXT SECONDARY (corrected, decision 2) |
| `--color-surface` | `#F6F6F6` | SURFACE |
| `--color-bias-left` | `#B42318` | LEFT BIAS |
| `--color-bias-center` | `#E5E7EB` | CENTER |
| `--color-bias-right` | `#1D4ED8` | RIGHT BIAS |
| `--color-bg-primary` | `#FFFFFF` | BG PRIMARY |
| `--color-bg-secondary` | `#F0F0F0` | BG SECONDARY |
| `--color-border` | `#E5E7EB` | BORDER |
| `--color-divider` | `#E5E7EB` | DIVIDER |

Keep `border` and `divider` as separate tokens even though the hex matches — they are semantically distinct and may diverge.

**Typography** — `--font-sans: var(--font-poppins)`. Define the 8 text styles as `--text-*` tokens with paired line heights so `text-h1` etc. work as utilities:

| Token | Size | Weight | Line height |
|---|---|---|---|
| `h1` | 32px | 700 Bold | 1.2 |
| `h2` | 24px | 600 SemiBold | 1.3 |
| `h3` | 20px | 600 SemiBold | 1.3 |
| `h4` | 16px | 500 Medium | 1.4 |
| `body-lg` | 16px | 400 Regular | 1.6 |
| `body-md` | 14px | 400 Regular | 1.6 |
| `body-sm` | 13px | 400 Regular | 1.6 |
| `caption` | 11px | 400 Regular | 1.4 |

Weight is applied at the call site (`font-bold`, `font-semibold`, `font-medium`) — the token carries size + line height.

**Radius:** `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-full: 9999px`.

**Shadows:**

```
--shadow-sm: 0px 1px 2px rgba(0,0,0,0.05)
--shadow-md: 0px 4px 12px rgba(0,0,0,0.08)
--shadow-lg: 0px 12px 24px rgba(0,0,0,0.12)
```

**Container:** `--container-page: 1280px`. The 12-column / 24px-gutter / 24px-margin grid is expressed at usage sites as `max-w-[1280px] mx-auto px-6` + `grid-cols-12 gap-6`.

Add a comment documenting the 4px spacing scale → Tailwind mapping (`4=1, 8=2, 16=4, 24=6, 32=8, 40=10, 64=16`).

### 3. `app/layout.tsx`

- Swap `Geist`/`Geist_Mono` for `Poppins` from `next/font/google`. Poppins is **not a variable font** — weights must be listed explicitly: `weight: ["400","500","600","700"]`, `subsets: ["latin"]`, `variable: "--font-poppins"`, `display: "swap"`.
- Keep the existing `LayoutProps<"/">` typed signature (Next 16 convention already in the file) and the `h-full antialiased` / `min-h-full flex flex-col` structure.
- `<body>` gets `bg-bg-primary text-text-primary font-sans`.
- Metadata: `title: "SKEW news — Balanced news coverage, powered by AI."`, matching description.

### 4. `lib/utils.ts`

```ts
export function cn(...inputs: ClassValue[]): string  // clsx + twMerge
```

### 5. Components

All are **server components** (no `"use client"`) — the reference specifies hover states, which are pure CSS, and nothing here needs interactivity. Every component: explicit exported prop interface, no `any`, `className` passthrough merged via `cn()`, forwards remaining native props where sensible.

**`Panel`** — `{ label, children, className }`. White `bg-bg-primary`, `border border-border`, `rounded-lg`, `p-6`. Label is uppercase, `text-caption`, `tracking-wide`, `text-text-primary`, with a `border-b border-divider` rule beneath it and `mb-6` gap. This is the container used by every section of the showcase.

**`Button`** — `variant: "primary" | "secondary" | "text"`, `size: "default"`. Reference states:

- `primary` — `bg-text-primary` (#0D0D0F), white label, `rounded-md`; hover darkens to pure black.
- `secondary` — white bg, `border border-border`, `text-text-primary`; hover `bg-bg-secondary`.
- `text` — no bg, no border, `text-text-primary`; hover `text-bias-right` (#1D4ED8).
- All: `text-body-md font-medium`, `px-6 py-2.5`, `transition-colors`, visible `focus-visible:ring-2` ring.
- `disabled` — `text-text-secondary/50`, `cursor-not-allowed`, no hover. The reference shows `outline` and `disabled` as *states*, so expose `disabled` via the native attribute rather than a fourth variant. The reference's "Outline" column is the `secondary` variant — document this in a comment so the mapping is not lost.

**`Chip`** — `{ label, onAdd?, className }`. Pill: `rounded-full`, `border border-border`, `bg-bg-primary`, `px-4 py-1.5`, `text-body-sm`, label + lucide `Plus` icon at 14px. Hover `bg-bg-secondary`.

**`BiasMeter`** — `{ left, center, right, variant?: "full" | "compact" }`. Three flex segments with `flex-grow` set from each percentage.

- Segment colors: left `bg-bias-left` white text, center `bg-bias-center` (#E5E7EB) `text-text-primary`, right `bg-bias-right` white text.
- `full` — `h-8`, `text-body-sm font-medium`, labels `Left 25%` / `Center 50%` / `Right 25%`, plus a `0% / 50% / 100%` axis row beneath in `text-caption text-text-secondary`. `rounded-sm`, segments flush (no gaps).
- `compact` — `h-5`, `text-caption`, same labels, no axis. Used inside the card.
- **Validate in dev**: if `left + center + right !== 100`, `console.warn` — enforces AGENTS.md §19 at the component boundary. Do not throw; a bad analysis row should not blank the page.
- `role="img"` with an `aria-label` like `"AI-estimated political framing: left 25%, center 50%, right 25%"` — the color-coded bar is meaningless to a screen reader otherwise.

**`ArticleCard`** — props `{ title, summary, category, country, imageUrl?, timeAgo, readingTime, bias: {left,center,right} }`.

- Layout: horizontal flex, `gap-5`. Image `w-[200px] h-[136px]`, `rounded-md`, `object-cover`, `shrink-0`. Below `sm`, stack vertically with a full-width image.
- Image uses `next/image` with explicit width/height. When `imageUrl` is absent render a `bg-bg-secondary` placeholder div of the same dimensions.
- Content column: meta row (`text-body-sm text-text-secondary` — `Politics · United States`), then `h3` title (`text-h3 font-semibold`, `line-clamp-2`), then summary (`text-body-md text-text-secondary`, `line-clamp-2`), then `<BiasMeter variant="compact">`, then a footer row with lucide `Clock` + time-ago and `Bookmark` + reading-time in `text-body-sm text-text-secondary`.
- Info affordance: circular `Info` icon button overlaid top-right of the image, white circle, `shadow-sm`. Give it an `aria-label`.
- Card container: `bg-bg-primary`, `border border-border`, `rounded-lg`, `p-4`, `shadow-sm`; `hover:shadow-md transition-shadow`.

**`Logo`** — `{ variant?: "light" | "dark", className }`. "SKEW" in `text-h1 font-bold tracking-normal` with "news" beneath, right-aligned, `text-h4 font-medium`. `light` = dark text on light bg; `dark` = white text for the dark footer. Text-based, not an SVG asset. (The wordmark and its `tracking-normal` are the post-rebrand values — see `prompts/skew-rebrand.md` decision 6 for why the caps are not negatively tracked.)

**Icons** — no wrapper component. Import the 15 lucide icons directly where used; the reference's "2px stroke, rounded caps" is lucide's default, so no config needed. The showcase page renders them at 24px in a grid. The 15: `Menu`, `Search`, `Bookmark`, `Clock`, `Info`, `Share`, `ExternalLink`, `Calendar`, `BarChart3`, `Tag`, `User`, `Bell`, `SlidersHorizontal`, `CheckCircle2`, `MoreHorizontal`.

### 6. `app/design-system/page.tsx`

Reproduce the reference layout panel-for-panel on `bg-surface` (#F6F6F6), `max-w-[1280px] mx-auto px-6 py-8`, 12-column grid, `gap-6`.

Row 1 — BRAND (`col-span-4`, logo + tagline) · TYPOGRAPHY (`col-span-5`, font-family blurb + the 8-row style table with live specimens) · UI ELEMENTS (`col-span-3`, button matrix, chip row, full BiasMeter).

Row 2 — COLORS (`col-span-4`, three groups: PRIMARY / SEMANTIC / NEUTRALS, each swatch a bordered square with name + hex beneath) · ICONS (`col-span-4`, 5-column grid + "Line style · 2px stroke · Rounded caps" caption) · CARD EXAMPLE (`col-span-4`, one `<ArticleCard>` with `MOCK_ARTICLE`).

Row 3 — SPACING (`col-span-4`, seven proportional squares 4→64px labeled) · GRID (`col-span-4`, 12 column bars + container/columns/gutter/margin annotations) · SHADOWS (`col-span-2`, three white squares each with a shadow token + its CSS) · BORDER RADIUS (`col-span-2`, four squares 4/8/12/full).

Footer — full-bleed `bg-text-primary`, white `Logo variant="dark"`, tagline, "Design System v1.0", a **static** date string, and "Stay consistent. Stay unbiased." right-aligned.

Responsive: `grid-cols-1` on mobile, `md:grid-cols-6` (panels span 3 or 6), `lg:grid-cols-12` as specified. The page must not overflow horizontally at 375px.

Swatch hexes on the page must be **rendered from the token values**, not retyped as arbitrary values — a hardcoded `#B42318` here would silently drift from the token.

### 7. `app/page.tsx`

Rename `home` → `Home` (PascalCase, default export). Minimal centered landing: `Logo`, tagline, and a `Button` linking to `/design-system`. Not the real home page — that is a separate task (AGENTS.md §1).

---

## Security requirements

Nothing in this task touches secrets, network calls, or the database. Concretely:

- No environment variables read or added.
- No Supabase / Oxylabs / OpenAI / Clerk imports.
- No `fetch` calls, no route handlers.
- All components are server components rendering local constants; nothing crosses the server/client boundary (AGENTS.md §21).
- No user input is accepted, so no injection surface. `MOCK_ARTICLE` is a local literal, not remote content.
- The `next/image` placeholder path adds no remote domains to `next.config.ts`.

---

## Acceptance criteria

1. `app/globals.css` defines every token in the table above via `@theme`; no `tailwind.config.ts` is created.
2. Poppins renders across the app at weights 400/500/600/700; no Geist or Arial remains.
3. The dark-mode block and default `body` font rule are gone from `globals.css`.
4. `Panel`, `Button`, `Chip`, `BiasMeter`, `ArticleCard`, `Logo` exist in `components/ui/` with exported prop types and zero `any`.
5. `Button` renders all three variants plus hover and disabled states matching the reference.
6. `BiasMeter` segment widths are proportional to the percentages; it warns on a non-100 sum and carries an `aria-label`.
7. `ArticleCard` shows title, category · country, image, bias meter, time-ago and reading time — the fields AGENTS.md §19 requires on a card.
8. `/design-system` renders all 11 panels plus the footer, visually matching the reference.
9. Swatch hexes on the showcase page derive from tokens, not literals.
10. All 15 icons render at 24px with 2px stroke.
11. Layout does not overflow horizontally at 375px, 768px, or 1280px.
12. Every bias percentage triple in the code sums to 100.
13. `npm run typecheck`, `npm run lint`, and `npm run build` all pass clean.

---

## Checks to run

```bash
npm run typecheck   # tsc --noEmit  (script added in this task)
npm run lint        # eslint
npm run build       # new route + font + CSS layer — build check required per §22
```

Report exact output. Do not claim a check passed without running it.

---

## Manual test steps

1. `npm run dev`
2. Open `http://localhost:3000` — SKEW news logo in Poppins, tagline, button through to the design system.
3. Open `http://localhost:3000/design-system` and compare against the reference image:
   - **Brand** — "SKEW" bold with "news" beneath, right-aligned.
   - **Colors** — 10 swatches; hexes match the token table (TEXT SECONDARY reads `#6B7280`).
   - **Typography** — 8 rows, each specimen at its stated size/weight.
   - **UI elements** — 3 button rows × 4 state columns; hover each primary/secondary/text button and confirm the color shift; the disabled button shows no hover and a not-allowed cursor.
   - **Chips** — 4 pills, each with a `+`, hover greys the background.
   - **Bias meter** — red 25% / gray 50% / blue 25%, with the 0/50/100 axis beneath.
   - **Icons** — 15 icons, uniform 2px stroke.
   - **Card** — image, `Politics · United States`, two-line title, summary, compact bias meter, clock + bookmark footer. Hover deepens the shadow.
   - **Spacing / Grid / Shadows / Radius** — proportions and values as labeled.
   - **Footer** — dark bar, white logo, right-aligned tagline.
4. Resize to 375px and 768px — no horizontal scrollbar, panels stack.
5. Tab through the buttons — every one shows a visible focus ring.
6. Inspect any element in devtools and confirm computed `font-family` is Poppins.

No API routes, no `x-SKEW-admin-secret` header, and no curl commands apply to this task (AGENTS.md §17 covers scraping/scheduler/analysis work).
