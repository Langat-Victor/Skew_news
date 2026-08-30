/*
  Hosts `next/image` is allowed to optimise, and the guard that keeps an
  unrecognised host from ever reaching it.

  Why a shared module: `images.remotePatterns` is an allowlist, and a URL whose
  host is not on it makes the optimiser return HTTP 400 — a broken image box, not
  a graceful fallback. So next.config.ts and the components read the SAME list,
  and anything unrecognised falls back to `PlaceholderArt` instead of breaking.

  Deliberately no imports: next.config.ts loads this file directly.

  ADDING A SOURCE: add its image CDN host here, then restart the dev server
  (next.config.ts changes are not hot-reloaded). A wildcard `**` host is not an
  option — it would let the optimiser be pointed at any server on the internet.
*/
export const IMAGE_HOSTS = [
  // Reuters (Arc Publishing)
  "www.reuters.com",
  "cloudfront-us-east-2.images.arcpublishing.com",
  // NPR
  "media.npr.org",
  // Fox News
  "a57.foxnews.com",
  "static.foxnews.com",
  // BBC News
  "ichef.bbci.co.uk",
  // The Guardian
  "i.guim.co.uk",
  "media.guim.co.uk",
] as const;

/**
 * True when `next/image` can be pointed at this URL. False for a null/blank
 * value, an unparseable URL, a non-https scheme, or an unlisted host — every one
 * of which should render placeholder art instead.
 */
export function isOptimizableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const { protocol, hostname } = new URL(url);

    if (protocol !== "https:") return false;

    return (IMAGE_HOSTS as readonly string[]).includes(hostname);
  } catch {
    return false;
  }
}
