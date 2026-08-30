import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { UtilityBar } from "@/components/layout/utility-bar";

/*
  Shared product chrome for the public site. Lives in a route group so it does
  NOT wrap `/design-system`, which has its own footer. `(site)` does not affect
  the URL, so the home page stays at `/`; the news details page drops into this
  group and inherits the chrome for free.

  The topic rail is deliberately NOT here: it is a home-page browse affordance,
  and the details page goes straight from the header into the article. It is
  rendered by `(site)/page.tsx` instead.
*/
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <UtilityBar />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
