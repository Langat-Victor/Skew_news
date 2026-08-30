# Prompt: Clerk Authentication

## Goal

Add real Clerk authentication to SKEW news: reader sign-up, sign-in, sign-out, and a user menu.

Scope, as confirmed with the user:

- **Nothing is gated.** `/`, `/news/[slug]`, and `/design-system` stay public for signed-out readers. `proxy.ts` runs a bare `clerkMiddleware()` so auth context exists on every request, but performs no auth checks. AGENTS.md §1 lists no gated feature; the action routes of §15 are protected by `x-SKEW-admin-secret`, not Clerk.
- **The header's two inert buttons become real.** `Subscribe` (primary) → sign-up, `Login` (secondary) → sign-in. Signed in, both collapse to Clerk's `<UserButton />`.
- **Dedicated standalone auth pages** at `/sign-in` and `/sign-up` — outside the `(site)` chrome. A bare, full-height, centred page: the SKEW news logo above Clerk's card. No utility bar, no nav, no footer.

Out of scope: billing/subscriptions (`clerk-billing`), organizations, webhook → Supabase user sync, protected routes, Clerk-authenticated API routes, custom sign-in flows built from `useSignIn`/`useSignUp` hooks. This task ships Clerk's prebuilt components only.

---

## Skills read

- `.agents/skills/clerk/SKILL.md` — router + SDK version table. `@clerk/nextjs` v7+ is the **current SDK** (Core 3); v5–v6 is Core 2/LTS. Every `> **Core 2 ONLY**` callout in the skills below is therefore **skipped**.
- `.agents/skills/clerk-setup/SKILL.md` — framework detection, `ClerkProvider` placement, common pitfalls, shadcn theme rule.
- `.agents/skills/clerk-nextjs-patterns/SKILL.md` — server vs client auth APIs, `<Show>` control component, pitfalls table.
- `.agents/skills/clerk-nextjs-patterns/references/middleware-strategies.md` — public-first strategy and the canonical matcher.
- `.agents/skills/clerk-nextjs-patterns/templates/nextjs-basic-auth/` — reference `proxy.ts` and `layout.tsx`.
- `.agents/skills/clerk-custom-ui/SKILL.md` — `appearance` prop: `variables` / `options`, themes from `@clerk/ui`.
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — "Starting with Next.js 16, Middleware is now called Proxy… The functionality remains the same." `proxy.ts` lives at the project root, same level as `app/`.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — single function per file, default or named `proxy` export; optional `config.matcher`; without a matcher it runs on every request including `_next/static` and `public/` assets.

Live Clerk docs fetched (the skills defer to them):

- `https://clerk.com/docs/nextjs/getting-started/quickstart` — "Choose the filename from the `next` version in `package.json`: `proxy.ts` for Next.js 16 and newer, `middleware.ts` for 15 and older." `ClerkProvider` must sit **inside `<body>`**.
- `https://clerk.com/docs/nextjs/guides/development/custom-sign-in-or-up-page` — optional catch-all route `app/sign-in/[[...sign-in]]/page.tsx`; the three `NEXT_PUBLIC_CLERK_*` env vars and what each one does.
- `https://clerk.com/docs/nextjs/reference/components/overview.md` — current control components include `<Show />`, `<ClerkLoading />`, `<ClerkLoaded />`. **`<SignedIn>`, `<SignedOut>`, and `<Protect>` do not appear in the v7 reference at all**; `<Show>` is documented as the component that "conditionally render[s] content based on authentication and authorization state".
- `https://clerk.com/docs/nextjs/reference/components/unstyled/sign-in-button.md` — `mode` defaults to `'redirect'`; `children` "Only accepts one child; if you want to render multiple elements, wrap them in a single parent element."
- `https://clerk.com/docs/nextjs/reference/components/user/user-button.md` — `afterSignOutUrl` on `<UserButton>` is **deprecated**; move it to `<ClerkProvider />`. `fallback` renders while the component mounts.
- `https://clerk.com/docs/nextjs/guides/customizing-clerk/appearance-prop/variables` — exact `variables` names and defaults; deprecation of `colorText` → `colorForeground`, `colorTextSecondary` → `colorMutedForeground`, `colorInputBackground` → `colorInput`, `spacingUnit` → `spacing`. Warns that Clerk derives shades with `color-mix()` / relative color syntax, so **literal color values** are safer than CSS variables.

Not applicable (AGENTS.md §3): `supabase`, `oxylabs-web-scraper`, `ai-sdk` — this task touches no database, scraping, or model code.

---

## Existing code inspected

| File | State | Effect on this task |
|---|---|---|
| `package.json` | `next@16.3.2`, `react@19.2.8`, `react-dom@19.2.8`. No auth library of any kind. | Next.js **16** → `proxy.ts`, not `middleware.ts`. Fresh install, no migration. |
| `app/layout.tsx` | `<html>` → `<body className="min-h-full flex flex-col …">` → `{children}`. Poppins via `next/font/google` with weights 400/500/600/700 on `--font-poppins`. Uses the generated `LayoutProps<"/">` type. | **Modified**: `<ClerkProvider>` wraps `{children}` **inside `<body>`**. The `flex flex-col` body plus `flex-1` children is what lets the auth pages fill the viewport. |
| `app/(site)/layout.tsx` | `UtilityBar` → `SiteHeader` → children → `SiteFooter`. Route group, so `/` is unaffected. | **Untouched.** The precedent for adding a second group: `(auth)`. |
| `app/(site)/page.tsx` | `TopicRail` + `<main className="flex-1 bg-surface">`. Static, mock data. | **Untouched.** Becomes dynamically rendered as a side effect — see decision 4. |
| `app/(site)/news/[slug]/page.tsx` | Public article page. | **Untouched**, and must stay reachable signed-out. |
| `app/design-system/page.tsx` | Outside `(site)`, root layout only. | **Untouched.** Renders inside `ClerkProvider` but uses nothing from it. |
| `components/layout/site-header.tsx` | Server Component. `Menu` icon, `Logo size="sm"`, `SiteNav`, then a `flex items-center gap-3` div holding two **inert `<span>`s** — `Subscribe` (`buttonClasses("primary")`, `hidden sm:inline-flex`) and `Login` (`buttonClasses("secondary")`) — under the comment `{/* Inert until Clerk + billing ship (AGENTS.md §1). */}`. | **Modified**: that div is replaced by `<AuthControls />`; the stale comment goes. Everything left of it is byte-identical. |
| `components/layout/site-nav.tsx` | `"use client"` (needs `usePathname`). The precedent for extracting one interactive slice out of the header. | **Untouched**, but the pattern is followed by `auth-controls.tsx`. |
| `components/ui/button.tsx` | `buttonClasses(variant, className)` exists specifically to give a non-`<button>` element button styling. `BASE_CLASSES` = `rounded-md px-6 py-2.5 text-body-md font-medium`, focus ring `ring-bias-right`. | Reused verbatim for the two auth buttons — the classes carry over unchanged, so the header is pixel-identical to today. |
| `components/ui/logo.tsx` | `Logo` with `variant: light \| dark`, `size: sm \| md`. `md` = `text-h1` word + `text-h4` sub. | Reused at `size="md"` on the auth pages. |
| `app/globals.css` | Tailwind v4 `@theme` tokens. `--color-text-primary: #0d0d0f`, `--color-text-secondary: #6b7280`, `--color-surface: #f6f6f6`, `--color-bg-primary: #ffffff`, `--color-border: #e5e7eb`, `--color-bias-left: #b42318`, `--color-bias-right: #1d4ed8`, `--radius-md: 8px`, `--text-body-md: 14px`. No dark layer. | **No new tokens.** These literal values seed Clerk's `appearance.variables` (decision 5). |
| `next.config.ts` | Empty config. `typedRoutes` **not** enabled. | **Stays empty.** Plain string `href="/"` in `Link` is fine. |
| `.next/types/routes.d.ts` | `AppRoutes = "/" \| "/design-system" \| "/news/[slug]"`, `LayoutRoutes = "/"`. | Regenerates to include `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]`. Route groups add no layout route, so `LayoutProps<"/">` is the correct type for `(auth)/layout.tsx` — exactly as `(site)/layout.tsx` already uses it. |
| `.env.local` | Already contains `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. | **Appended to**, not rewritten. The two keys are already in place, so no `clerk init` / key provisioning is needed. |
| `.gitignore` | `.env*` ignores every env file. | **Modified**: one `!.env.example` negation (decision 7). |
| `components.json` | **Does not exist** — shadcn/ui is not installed despite AGENTS.md §6 listing it. | The `clerk-setup` / `clerk-custom-ui` "ALWAYS apply the shadcn theme" rule **does not apply**. No `@clerk/ui` install; theming is done with `appearance.variables` against this project's own tokens. |
| `README.md` | Still the `create-next-app` boilerplate. | **Untouched** — unrelated to this change. |

Environment verified: Node **v20.20.1** ≥ the 20.9.0 Clerk requires. `@clerk/nextjs@7.8.1` peer range is `next: … ^16.1.0-0` and `react: … ~19.2.3`, so `next@16.3.2` + `react@19.2.8` satisfy it. Its dependency tree (`@clerk/react`, `@clerk/shared`, `@clerk/backend`) does **not** include `@clerk/ui` — prebuilt component styling ships with clerk-js at runtime, so `@clerk/nextjs` is the only package to install.

---

## Decisions and assumptions

Confirmed with the user:

1. **Nothing is protected.** `proxy.ts` is `export default clerkMiddleware()` with the canonical matcher and no `createRouteMatcher` / `auth.protect()` call. Note that the Clerk sign-in-page guide now says middleware-based auth checks are "no longer recommended" — so when a gated feature does arrive, protect it in the page/layout with `await auth()`, not by growing `proxy.ts`.
2. **`Subscribe` → sign-up, `Login` → sign-in.** `Subscribe` is read as "create an account", not "pay" — billing is not in the §1 build list. Both labels stay exactly as the UI reference has them; only the wrapper changes.
3. **Standalone centred auth pages** in a new `(auth)` route group, so they inherit no site chrome.

Assumptions made without asking:

4. **`<Show>` drives the header — and it is server-side.** ~~Reading `await auth()` in `SiteHeader` would opt `/`, `/news/[slug]`, and every future page into dynamic rendering just to pick a button label. `<Show when="signed-out">` / `<Show when="signed-in">` resolves auth client-side and leaves the pages static.~~

   **Corrected during implementation** — the original rationale above was wrong, and it was checked against the installed package rather than the docs (implementation step 2). Facts from `@clerk/nextjs@7.8.1`:
   - `Show` is exported from `dist/types/components.server.d.ts` as an **async Server Component**: `Show(props): Promise<JSX.Element | null>`, whose body is `const { has, userId } = await auth(...)`. It resolves auth **on the server**, exactly like a direct `await auth()` call.
   - There is no client-side alternative to fall back to: `SignedIn`, `SignedOut`, and `Protect` are exported from `dist/types/removedControlComponents.d.ts` as stubs typed `never`, documented as "removed from `@clerk/nextjs` in Clerk Core 3 (released March 3, 2026) and replaced by the `<Show>` component".

   So the trade-off inverts, in the good direction on UX and the costly direction on rendering:
   - **Gained:** no flicker and no empty header slot at all. The correct branch is server-rendered, so the header is right in the first byte. The `<ClerkLoading>` escape hatch is unnecessary.
   - **Cost:** `SiteHeader` sits in `(site)/layout.tsx`, so reading auth there makes every route in the group dynamic (`ƒ`). This is acceptable and largely academic here: `/` and `/news/[slug]` are about to become Supabase-backed reads (AGENTS.md §7) that would be dynamic regardless.
   - **If static rendering of `/` ever matters more than flicker**, the one-file change is to make `AuthControls` a `"use client"` component branching on `useAuth().isSignedIn` — hand-rolling what `Show` does, plus a loading state. Not worth it today.
5. **`appearance.variables` with literal hex, set once on `ClerkProvider`.** Clerk's card would otherwise arrive in its own default palette next to a design system that has exactly one primary (`#0d0d0f`) and one radius (8px). The values are duplicated from `globals.css` **deliberately**: the variables docs warn that Clerk derives shades via `color-mix()` / relative color syntax, so passing `var(--color-text-primary)` risks broken derived shades. A comment in `app/layout.tsx` must point at `globals.css` as the source of truth so the two cannot drift silently.
   - `fontFamily` is **omitted on purpose** — it defaults to `inherit`, so Clerk inherits Poppins from `body.font-sans` for free.
   - Only current (non-deprecated) variable names are used: `colorForeground`, `colorMutedForeground`, `colorInput`, `spacing`-family. Never `colorText`, `colorTextSecondary`, `colorInputBackground`, `spacingUnit`.
6. **Two separate auth pages, not one combined sign-in-or-up page.** AGENTS.md §21 lists *both* `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, and the header has two distinct buttons. Each page owns its own optional catch-all route.
7. **`.env.example` is created with the Clerk block only.** AGENTS.md §21 says the canonical env list lives there and must stay in sync with the table, but the file does not exist yet. This task adds only the six variables it owns, with a header comment saying later features append theirs. Because `.gitignore` ignores `.env*`, a single `!.env.example` negation is added — the smallest change that lets the template be committed while `.env.local` stays ignored.
8. **`AuthControls` is a Server Component that renders Clerk's client components.** No `"use client"` directive: `Show`, `SignInButton`, `SignUpButton`, and `UserButton` carry their own client boundary inside `@clerk/nextjs` (this is exactly what Clerk's own `app/layout.tsx` example does). `SiteHeader` therefore stays a Server Component, and `buttonClasses()` still runs at build time into a plain string.
9. **The auth buttons become real `<button>`s.** Today they are inert `<span>`s, following the repo rule that controls with no backing feature must not be focusable. That rule now *inverts* for these two: the feature exists, so they must be keyboard-operable. `<SignInButton>`/`<SignUpButton>` take exactly one child, so each wraps one `<button type="button">` carrying the existing `buttonClasses(...)` string — including `hidden sm:inline-flex` on `Subscribe`, so its responsive behaviour is unchanged.
10. **Clerk owns the post-auth navigation.** Wrapping the buttons in `<SignInButton>`/`<SignUpButton>` (default `mode="redirect"`) rather than hand-rolling `<Link href="/sign-in">` keeps redirect handling inside Clerk. The destination after auth comes from `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`, both `/`. No `forceRedirectUrl` is hardcoded in JSX — the docs prefer the env vars.
11. **`afterSignOutUrl="/"` goes on `ClerkProvider`**, not on `<UserButton>`, where it is deprecated.

---

## Files likely to change

**New**

| Path | Purpose |
|---|---|
| `proxy.ts` | `clerkMiddleware()` + matcher. Project root, beside `app/`. |
| `components/layout/auth-controls.tsx` | The header's signed-out / signed-in control pair. |
| `app/(auth)/layout.tsx` | Centred, chrome-free shell with the SKEW news logo. |
| `app/(auth)/sign-in/[[...sign-in]]/page.tsx` | `<SignIn />`. |
| `app/(auth)/sign-up/[[...sign-up]]/page.tsx` | `<SignUp />`. |
| `.env.example` | Committed template for the Clerk variables (§21). |

**Modified**

| Path | Change |
|---|---|
| `app/layout.tsx` | `<ClerkProvider>` inside `<body>`, with `afterSignOutUrl` and `appearance`. |
| `components/layout/site-header.tsx` | Inert `<span>` pair → `<AuthControls />`. |
| `.env.local` | Append the four `NEXT_PUBLIC_CLERK_*` URL variables. |
| `.gitignore` | Add `!.env.example`. |
| `package.json` + `package-lock.json` | `@clerk/nextjs` dependency. |

`AGENTS.md` needs **no** change — §21's table already lists every variable this task introduces.

---

## Implementation requirements

1. **Install.** `npm install @clerk/nextjs` (resolves to 7.8.1, the current SDK / Core 3). No `@clerk/ui` — see the `components.json` row above.

2. **Verify the exported component names before writing any JSX.** Grep the installed package's type declarations for `Show`, `SignInButton`, `SignUpButton`, `UserButton`, `SignIn`, `SignUp`, and `ClerkProvider`. The v7 docs reference `<Show>` and omit `<SignedIn>`/`<SignedOut>` entirely — confirm that against the shipped `.d.ts` rather than trusting the docs. If `Show` is genuinely absent from the installed build, fall back to `<SignedIn>`/`<SignedOut>` and say so in the completion summary.

3. **`proxy.ts`** at the project root:
   ```ts
   import { clerkMiddleware } from "@clerk/nextjs/server";

   export default clerkMiddleware();

   export const config = {
     matcher: [
       "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
       "/(api|trpc)(.*)",
     ],
   };
   ```
   The matcher is the canonical one from `middleware-strategies.md`. Keep the `(api|trpc)` line even though no route handler exists yet — it is what makes `auth()` work in future handlers. Add a short comment stating that no route is protected and that gating belongs in pages, per decision 1.

4. **`app/layout.tsx`** — wrap `{children}` inside `<body>`:
   ```tsx
   import { ClerkProvider } from "@clerk/nextjs";
   import type { ComponentProps } from "react";
   ```
   Declare the appearance above the component, typed off the provider so no Clerk type needs importing by name:
   ```tsx
   const clerkAppearance: ComponentProps<typeof ClerkProvider>["appearance"] = {
     variables: {
       colorPrimary: "#0d0d0f",       // --color-text-primary
       colorForeground: "#0d0d0f",    // --color-text-primary
       colorMutedForeground: "#6b7280", // --color-text-secondary
       colorBackground: "#ffffff",    // --color-bg-primary
       colorInput: "#ffffff",         // --color-bg-primary
       colorMuted: "#f6f6f6",         // --color-surface
       colorBorder: "#e5e7eb",        // --color-border
       colorRing: "#1d4ed8",          // --color-bias-right, matches buttonClasses' focus ring
       colorDanger: "#b42318",        // --color-bias-left
       borderRadius: "8px",           // --radius-md
       fontSize: "14px",              // --text-body-md
     },
   };
   ```
   with the comment from decision 5 explaining why the values are literals rather than `var(--…)`. Then:
   ```tsx
   <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-sans">
     <ClerkProvider afterSignOutUrl="/" appearance={clerkAppearance}>
       {children}
     </ClerkProvider>
   </body>
   ```
   Do not add the `dynamic` prop. Do not move `ClerkProvider` outside `<body>`. Leave `metadata`, the Poppins setup, and both `className` strings untouched.

5. **`components/layout/auth-controls.tsx`** — no `"use client"`:
   ```tsx
   import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
   import { buttonClasses } from "@/components/ui/button";
   import { cn } from "@/lib/utils";
   ```
   Render a `flex items-center gap-3` wrapper containing:
   - `<Show when="signed-out">` → a single fragment child holding `<SignUpButton>` around `<button type="button" className={cn(buttonClasses("primary"), "hidden sm:inline-flex")}>Subscribe</button>` and `<SignInButton>` around `<button type="button" className={buttonClasses("secondary")}>Login</button>`.
   - `<Show when="signed-in">` → `<UserButton />`.

   The fragment matters: `SignInButton`/`SignUpButton` accept exactly one child each, and passing `Show` a single child is safe regardless of its own arity. Do not pass `afterSignOutUrl` to `UserButton` (deprecated — it is on the provider). Do not set `forceRedirectUrl`/`fallbackRedirectUrl` in JSX (env vars own that). Document the no-`"use client"` choice from decision 8 in a short comment.

6. **`components/layout/site-header.tsx`** — replace the two-`<span>` div and its `{/* Inert until Clerk + billing ship … */}` comment with `<AuthControls />`. Change nothing else: the `Menu` icon, `Logo`, `SiteNav`, `<header>`/container classes, and import ordering all stay as they are. Drop the now-unused `buttonClasses` / `cn` imports from this file if nothing else uses them.

7. **`app/(auth)/layout.tsx`** — typed `LayoutProps<"/">`, matching `(site)/layout.tsx`:
   - A single `<main className="flex flex-1 flex-col items-center justify-center gap-8 bg-surface px-6 py-16">`.
   - Inside: `<Link href="/">` wrapping `<Logo size="md" />` with an accessible label, then `{children}`.
   - A comment saying the group exists to keep the auth pages outside the `(site)` chrome, and that `(auth)` does not affect the URL.

8. **`app/(auth)/sign-in/[[...sign-in]]/page.tsx`** — `export default function SignInPage() { return <SignIn />; }` plus `export const metadata: Metadata = { title: "Sign in — SKEW news" }`. Note the **double** brackets: Clerk needs the optional catch-all so it can own its sub-routes (SSO callback, factor-two, reset password). Mirror it in `app/(auth)/sign-up/[[...sign-up]]/page.tsx` with `<SignUp />` and `title: "Sign up — SKEW news"`. No `appearance` prop on either component — the provider already themes them.

9. **Env variables.** Append to `.env.local` (do not touch or reprint the two existing keys):
   ```env
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
   ```
   Create `.env.example` with the same four plus **placeholder-only** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx` and `CLERK_SECRET_KEY=sk_test_xxx`, a comment marking `CLERK_SECRET_KEY` server-only, and a note that later features append their own variables (§21). Add `!.env.example` to `.gitignore` beneath the existing `.env*` line.

10. **Restart the dev server** after the env change — `NEXT_PUBLIC_*` values are inlined at build time and a running server will not pick them up.

---

## Security requirements

Per AGENTS.md §21:

1. **`CLERK_SECRET_KEY` must never reach browser code.** It is read only by Clerk's own server SDK from the environment. No file in `app/`, `components/`, or `lib/` may reference it — not even in a server component.
2. `@clerk/nextjs/server` (`clerkMiddleware`, `auth`) is imported **only** by `proxy.ts` in this change. Client-side Clerk imports come from `@clerk/nextjs`. Never mix the two entry points.
3. Only the `NEXT_PUBLIC_CLERK_*` variables are browser-exposed, and all four new ones are non-secret route paths.
4. `.env.example` carries **placeholders only** — never a real `pk_`/`sk_` value. `.env.local` stays gitignored; the `!.env.example` negation must not accidentally un-ignore anything else.
5. Do not log key values, and do not print `.env.local` contents in the completion summary.
6. `clerkMiddleware()` performs no auth checks, so nothing in this change can accidentally gate a public page — but equally, **no page may assume it is protected**. There is no protected page yet.
7. This change touches no action route, so the `x-SKEW-admin-secret` rule (§15) and `CRON_SECRET` rule (§18) are unaffected. Clerk sessions must never become an alternative to the admin secret on pipeline routes.

---

## Acceptance criteria

1. `@clerk/nextjs@^7` is in `package.json` dependencies; `@clerk/ui` is **not** installed.
2. `proxy.ts` exists at the project root (not `middleware.ts`, not inside `app/`), default-exports `clerkMiddleware()`, and contains no `auth.protect()` call.
3. `<ClerkProvider>` sits **inside** `<body>` in `app/layout.tsx`, with `afterSignOutUrl="/"` and the `appearance.variables` object. No deprecated variable names (`colorText`, `colorTextSecondary`, `colorInputBackground`, `spacingUnit`) appear anywhere.
4. Signed out, the header renders a working `Subscribe` and `Login`; both are real focusable `<button>`s and look pixel-identical to the previous inert spans (same `buttonClasses` output, `Subscribe` still `hidden sm:inline-flex`).
5. Signed in, `Subscribe` and `Login` are gone and `<UserButton />` is in their place.
6. `/sign-in` and `/sign-up` render Clerk's card centred on `bg-surface` under the `size="md"` SKEW news logo, with **no** utility bar, nav, or footer. The logo links to `/`.
7. Clerk's card visibly picks up the design system: near-black primary button, 8px radius, Poppins type, `#e5e7eb` borders.
8. `/`, `/news/<any-existing-slug>`, and `/design-system` all render for a signed-out visitor, unchanged.
9. Sign-up completes, sign-out returns to `/`, and the header updates in both directions without a manual reload.
10. ~~`/` and `/news/[slug]` are still **statically** prerendered in the `npm run build` output (`○`/`●`, not `ƒ`) — proof that `<Show>` did not drag them into dynamic rendering.~~

    **Inverted during implementation** (see decision 4): `<Show>` is an async Server Component that awaits `auth()`, so `/` and `/news/[slug]` are expected to be **`ƒ` (dynamic)** in the `npm run build` output. `/design-system` and `/_not-found`, which sit outside `(site)` and never touch `AuthControls`, must stay `○`. Observed:

    ```
    ┌ ƒ /
    ├ ○ /_not-found
    ├ ○ /design-system
    ├ ƒ /news/[slug]
    ├ ƒ /sign-in/[[...sign-in]]
    └ ƒ /sign-up/[[...sign-up]]
    ƒ Proxy (Middleware)
    ```
11. No `sk_test_`/`sk_live_` string appears anywhere in `.next/static/`.
12. `git status` shows `.env.local` still ignored and `.env.example` tracked.

---

## Checks to run

Per AGENTS.md §22 — routes, root layout, and a new server-side file all changed, so `build` is required, not optional:

```bash
npm run typecheck
npm run lint
npm run build
```

Report the exact output of each. Then the secret-leak check:

```bash
grep -rl "sk_test_\|sk_live_" .next/static/ || echo "no secret key in client bundle"
```

---

## Manual test steps

Run the dev server and watch this terminal — Clerk logs configuration problems (bad keys, missing proxy file) here (§17):

```bash
npm run dev
```

There are no API endpoints in this change, so no `curl` commands are needed.

1. **Signed-out header** — open `http://localhost:3000`. The header shows `Subscribe` and `Login` exactly as before. Tab to each: both take focus and show the blue focus ring (previously they were unfocusable `<span>`s).
2. **Sign-up** — click `Subscribe`. You land on `http://localhost:3000/sign-up`: SKEW news logo, Clerk's card centred on the light grey background, no nav and no footer. Confirm the card's primary button is near-black with 8px corners and Poppins type, not Clerk's default blue.
3. Create an account with a real email (Clerk emails a verification code in dev). After verification you are returned to `/`, and the header now shows the avatar `UserButton` instead of the two buttons — **no page reload needed**.
4. **User menu** — click the avatar → `Manage account` opens Clerk's profile modal. Close it.
5. **Sign out** from the same menu. You land on `/` and the header returns to `Subscribe` / `Login`.
6. **Sign-in** — click `Login` → `/sign-in`, same standalone framing. Sign in with the account from step 3; you return to `/` signed in.
7. **Already-signed-in guard** — while signed in, visit `/sign-in` directly. Clerk sends you to `/` (the `…SIGN_IN_FALLBACK_REDIRECT_URL`) instead of showing the form again.
8. **Public pages stay public** — in a **private/incognito window** (guaranteed signed out) open `/`, then click any story card through to `/news/<slug>`, then open `/design-system`. All three render fully; nothing redirects to `/sign-in`.
9. **Sub-route ownership** — visit `/sign-in/factor-one` directly. It renders through the optional catch-all rather than 404ing; this is what the `[[...sign-in]]` brackets buy.
10. **Responsive** — narrow the window below the `sm` breakpoint (640px) signed out: `Subscribe` disappears, `Login` remains — identical to the pre-Clerk behaviour. Signed in, the `UserButton` stays visible at every width. Check `/sign-up` at 375px: the card is not clipped and has breathing room from the `px-6` gutter.
11. **Terminal** — confirm no Clerk warnings in the dev server output during any of the above.

---

## Visual expectations

**Header (modified).** Pixel-identical to today when signed out. Same `flex items-center gap-3` row, same `buttonClasses("primary")` / `buttonClasses("secondary")` strings, same `hidden sm:inline-flex` on `Subscribe`, same labels. The only rendered difference is the tag name — `<span>` → `<button>` — which adds focusability and the existing `focus-visible:ring-bias-right` ring. Signed in, the row holds Clerk's ~28–32px circular avatar; the header's height is set by `Logo size="sm"` (~41px) in every state, so the row never changes height. During the brief pre-hydration window the right slot is empty (decision 4).

**Auth pages (new).**

```
┌──────────────────────────────────────────┐  bg-surface #f6f6f6, min-height: viewport
│                                          │
│                  SKEW                    │  Logo size="md": text-h1 32px/1.2 bold
│                   News                   │  + text-h4 16px/1.4 medium, right-aligned
│                                          │  → links to /
│           ↕ gap-8 (32px)                 │
│         ┌────────────────────┐           │
│         │                    │           │  Clerk <SignIn /> / <SignUp /> card,
│         │   Clerk card       │           │  its own intrinsic width, centred
│         │                    │           │
│         └────────────────────┘           │
│                                          │
└──────────────────────────────────────────┘  py-16 (64px) vertical, px-6 (24px) gutters
```

- **Layout** — one `<main>`, `flex flex-1 flex-col items-center justify-center`. `flex-1` against the root layout's `min-h-full flex flex-col` body is what makes the page fill the viewport and keeps the card optically centred.
- **Spacing** — all from the 4px scale already in use: `gap-8` between logo and card, `py-16`, `px-6` (the same gutter as `max-w-page` containers elsewhere). No arbitrary values.
- **Colour** — `bg-surface` (`#f6f6f6`) behind a white Clerk card, the same figure/ground pairing the home page uses for its news cards. Logo in default `light` variant (`#0d0d0f`).
- **Typography** — Poppins throughout, inherited: the page from `body.font-sans`, Clerk's card because `variables.fontFamily` defaults to `inherit`. Clerk's base size is pinned to 14px (`--text-body-md`), matching body copy site-wide.
- **Card internals are Clerk's** — do not restyle its inner elements with custom CSS. The only permitted lever is `appearance` on the provider. Clerk's "Secured by Clerk" badge stays; removing it is a paid-plan feature.
- **Responsiveness** — Clerk's card is responsive on its own; the `px-6` gutter guarantees margin at 375px. Nothing here needs a breakpoint.
