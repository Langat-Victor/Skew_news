import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up — SKEW news",
};

/*
  Optional catch-all, same reasoning as the sign-in page: Clerk routes its own
  verification and continuation steps under /sign-up.
*/
export default function SignUpPage() {
  return <SignUp />;
}
