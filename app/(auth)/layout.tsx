import Link from "next/link";
import { Logo } from "@/components/ui/logo";

/*
  Standalone shell for `/sign-in` and `/sign-up`. It lives in its own route group
  so the auth pages sit OUTSIDE the `(site)` chrome — no utility bar, no nav, no
  footer, nothing to click away to while signing in. `(auth)` does not affect the
  URL, so the routes stay `/sign-in` and `/sign-up`.

  `flex-1` against the root layout's `min-h-full flex flex-col` body is what
  makes the page fill the viewport and keeps Clerk's card optically centred.
*/
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-surface px-6 py-16">
      <Link href="/" aria-label="SKEW news home">
        <Logo size="md" />
      </Link>

      {children}
    </main>
  );
}
