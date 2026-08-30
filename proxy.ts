import { clerkMiddleware } from "@clerk/nextjs/server";

/*
  Next.js 16 renamed Middleware to Proxy; the contents are unchanged
  (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).

  Deliberately bare: SKEW news is a public reader site (AGENTS.md §1), so no route
  is protected and there is no `auth.protect()` call here. What this DOES buy is
  auth context on every request, which is what `auth()` — and therefore Clerk's
  `<Show>` — needs in order to resolve.

  When a gated feature does arrive, protect it in the page or layout with
  `await auth()` rather than growing this file: Clerk's current guidance is that
  middleware-based auth checks are no longer the recommended pattern.

  The `(api|trpc)` line is kept even though no route handler exists yet — it is
  what makes `auth()` work inside the future ones. Note that the pipeline action
  routes of §15 authenticate with `x-SKEW-admin-secret`, not with a Clerk
  session, and this proxy must never become an alternative to that secret.
*/
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
