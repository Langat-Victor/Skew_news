"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href?: string; dot?: boolean };

/*
  Only `Home` has a destination — the other sections do not exist yet, so they
  render as non-focusable `<span>`s rather than links to nowhere. `For You`'s
  red dot is decorative until a real unread count exists.
  TODO(nav): turn these into <Link>s as /for-you, /local, /blindspot ship.
*/
const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "For You", dot: true },
  { label: "Local" },
  { label: "Blindspot" },
];

/*
  The only client component the header needs: `active` is derived from the current
  pathname, so `Home` stops being underlined while reading an article. `SiteHeader`
  itself stays a Server Component.
*/
export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-7 lg:flex">
      {NAV_ITEMS.map((item) => {
        const active = item.href !== undefined && pathname === item.href;

        const labelNode = (
          <span
            className={cn(
              "relative",
              active
                ? "text-text-primary after:absolute after:-bottom-2.5 after:left-0 after:h-0.5 after:w-full after:bg-text-primary"
                : "text-text-secondary",
            )}
          >
            {item.label}
            {item.dot ? (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-2 size-1.5 rounded-full bg-bias-left"
              />
            ) : null}
          </span>
        );

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="text-body-md font-medium"
          >
            {labelNode}
          </Link>
        ) : (
          <span key={item.label} className="text-body-md">
            {labelNode}
          </span>
        );
      })}
    </nav>
  );
}
