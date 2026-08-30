"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
  The header's auth pair. Signed out it is `Subscribe` (create an account) and
  `Login`; signed in both collapse into Clerk's user menu.

  Clerk's client hook exposes the authenticated user's stable `id`, so this
  component identifies PostHog when Clerk resolves an existing session as well
  as after a sign-in or sign-up. PostHog retains that identity for all following
  events and exception reports until Clerk signs out.

  These are real `<button>`s, not the inert `<span>`s they replaced: the repo
  keeps unbacked controls unfocusable, and this feature now exists.

  Redirect targets come from the NEXT_PUBLIC_CLERK_*_URL environment variables
  (AGENTS.md §21), so nothing is hardcoded here.
*/
export function AuthControls() {
  const { isLoaded, isSignedIn, user } = useUser();
  const previousUserId = useRef<string | null>(null);
  const userId = user?.id;
  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName ?? undefined;

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && userId) {
      if (previousUserId.current && previousUserId.current !== userId) {
        posthog.reset();
      }

      posthog.identify(userId, { email, name });
      previousUserId.current = userId;
    } else if (previousUserId.current) {
      posthog.reset();
      previousUserId.current = null;
    }
  }, [email, isLoaded, isSignedIn, name, userId]);

  return (
    <div className="flex items-center gap-3">
      {!isSignedIn ? (
        <>
          <SignUpButton>
            <button
              type="button"
              onClick={() => posthog.capture("sign_up_started")}
              className={cn(buttonClasses("primary"), "hidden sm:inline-flex")}
            >
              Subscribe
            </button>
          </SignUpButton>
          <SignInButton>
            <button
              type="button"
              onClick={() => posthog.capture("login_started")}
              className={buttonClasses("secondary")}
            >
              Login
            </button>
          </SignInButton>
        </>
      ) : (
        <UserButton />
      )}
    </div>
  );
}
