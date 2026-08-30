import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — SKEW news",
};

/*
  The double brackets are an OPTIONAL catch-all: Clerk owns its own sub-routes
  under /sign-in (SSO callback, second factor, password reset), so the segment
  has to match both `/sign-in` and `/sign-in/anything`.

  No `appearance` prop — <ClerkProvider> in the root layout already themes it.
*/
export default function SignInPage() {
  return <SignIn />;
}
