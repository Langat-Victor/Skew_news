/*
  AGENTS.md §9's non-article reject list, as data.

  WHEN §9's LIST CHANGES, IT CHANGES HERE. §9 is explicit that the list is
  canonical in one place and referred to by name everywhere else; this module is
  that place for code. Nothing else in the parsing layer should carry its own
  copy of these words.

  Pure data and pure functions — no imports, no environment access.
*/

/**
 * §9's page types as URL path words. Matched as whole path segments only, so a
 * story slug like `/news/live-aid-at-40-…` is not rejected for containing
 * "live".
 *
 * `video`/`videos`/`watch` are here because §9 allows a video page only when it
 * also carries full article text, and §12's tie-breaker says an uncertain
 * candidate is rejected rather than fetched (decision 14).
 */
export const NON_ARTICLE_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  // category and section pages
  "category",
  "categories",
  "section",
  "sections",
  // topic and tag pages
  "topic",
  "topics",
  "tag",
  "tags",
  // author pages
  "author",
  "authors",
  "profile",
  // search pages
  "search",
  // show, program, and podcast pages
  "show",
  "shows",
  "program",
  "programs",
  "podcast",
  "podcasts",
  // live pages
  "live",
  "live-news",
  // video-only pages (decision 14)
  "video",
  "videos",
  "watch",
  // game pages
  "game",
  "games",
  "puzzles",
  // product, review, and shopping pages
  "product",
  "products",
  "review",
  "reviews",
  "shop",
  "shopping",
  "store",
  "deals",
  // corporate and support pages
  "about",
  "about-us",
  "contact",
  "support",
  "help",
  "faq",
  "careers",
  "jobs",
  "corporate",
  "press",
  "legal",
  "terms",
  "privacy",
  // newsletter and subscription pages
  "newsletter",
  "newsletters",
  "subscribe",
  "subscription",
  // account and machine-readable endpoints
  "signin",
  "sign-in",
  "login",
  "register",
  "account",
  "sitemap",
  "rss",
  "feed",
  // non-news verticals §11 names for BBC and Fox
  "weather",
  "sport",
  "sports",
]);

/**
 * Returns the offending path segment, or null when the path is clean.
 *
 * The segment is returned rather than a boolean so the caller can name it in a
 * rejection reason — §9's run logging groups rejections by cause, and "rejected
 * for `/topics/`" is far more useful than "rejected".
 */
export function hasRejectedPathSegment(pathname: string): string | null {
  for (const segment of pathname.toLowerCase().split("/")) {
    if (!segment) continue;
    if (NON_ARTICLE_PATH_SEGMENTS.has(segment)) return segment;
  }

  return null;
}

/**
 * Titles that identify a listing, section, show, or error page rather than a
 * story (§13: "title is generic", "title is a category, section, show, program,
 * podcast, product, game, live, or corporate page name").
 */
const GENERIC_TITLES: ReadonlySet<string> = new Set([
  "news",
  "latest news",
  "breaking news",
  "top stories",
  "home",
  "homepage",
  "video",
  "videos",
  "watch live",
  "live",
  "live updates",
  "podcasts",
  "podcast",
  "shows",
  "programmes",
  "programs",
  "sitemap",
  "search",
  "page not found",
  "not found",
  "error",
  "access denied",
  "subscribe",
  "newsletters",
  "sign in",
  "log in",
]);

/** Below this, a headline is a nav label rather than a story title. */
const MIN_TITLE_LENGTH = 15;

export function isGenericTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, " ");

  if (!normalized) return true;
  if (GENERIC_TITLES.has(normalized)) return true;

  return normalized.length < MIN_TITLE_LENGTH;
}
