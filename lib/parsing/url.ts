/*
  URL absolutization, normalization, and same-site comparison.

  Pure functions over the WHATWG URL parser — no imports, no I/O. `normalizeUrl`
  is the most load-bearing function in the pipeline: its output becomes
  `articles.original_url`, which is the dedupe key §10 relies on. If the same
  page normalises two different ways, dedupe silently breaks and duplicates
  accumulate, so every rule here is deliberately stable and order-independent.
*/

/** Schemes that are never a story link. */
const NON_HTTP_SCHEMES = ["mailto:", "tel:", "javascript:", "data:", "sms:"];

/**
 * Tracking parameters stripped before a URL becomes a dedupe key. Everything
 * else in the query string is KEPT — some outlets carry a real story id there,
 * and dropping it would merge distinct articles.
 */
const TRACKING_PARAM_EXACT: ReadonlySet<string> = new Set([
  "fbclid",
  "gclid",
  "cmpid",
  "cmp",
  "icid",
  "ito",
  "srnd",
  "taid",
  "smid",
  "ns_campaign",
  "ns_mchannel",
  "ns_source",
  "ref",
  "referrer",
  "mc_cid",
  "mc_eid",
]);

/** Prefix-matched tracking families. */
const TRACKING_PARAM_PREFIXES = ["utm_", "at_"];

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();

  if (TRACKING_PARAM_EXACT.has(lower)) return true;

  return TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Resolves `href` against `baseUrl`. Returns null for non-navigational hrefs
 * (`mailto:`, `tel:`, `javascript:`, a bare `#`) and unparseable values.
 */
export function absolutize(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();

  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return null;

  const lower = trimmed.toLowerCase();
  if (NON_HTTP_SCHEMES.some((scheme) => lower.startsWith(scheme))) return null;

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Canonical form of a URL for storage and comparison. Returns null for anything
 * that is not `https`.
 *
 * `https` only, deliberately: this is the value the pipeline later fetches, so
 * refusing plaintext here means a manipulated homepage cannot downgrade a
 * request. Every one of the five configured outlets serves https.
 */
export function normalizeUrl(url: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";

  for (const key of [...parsed.searchParams.keys()]) {
    if (isTrackingParam(key)) parsed.searchParams.delete(key);
  }

  // Sort what survives: two links to the same story with the params in a
  // different order must produce one key, not two.
  parsed.searchParams.sort();

  // Trailing slash is dropped everywhere but the root, so `/a/b` and `/a/b/`
  // are one URL.
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  const query = parsed.searchParams.toString();

  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${query ? `?${query}` : ""}`;
}

/**
 * Multi-part public suffixes this project actually encounters. A deliberate
 * approximation, NOT the Public Suffix List — the full list is thousands of
 * entries and a moving target, and the only hosts compared here come from
 * `sources.listing_url` rows we control.
 */
const MULTI_PART_TLDS: ReadonlySet<string> = new Set([
  "co.uk",
  "co.jp",
  "com.au",
  "co.nz",
  "co.za",
  "co.in",
  "com.br",
]);

/** `www.sub.bbc.co.uk` → `bbc.co.uk`. */
function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);

  if (labels.length <= 2) return labels.join(".");

  const lastTwo = labels.slice(-2).join(".");
  const take = MULTI_PART_TLDS.has(lastTwo) ? 3 : 2;

  return labels.slice(-take).join(".");
}

export function registrableDomainOf(url: string): string | null {
  try {
    return registrableDomain(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * True when both URLs sit on the same registrable domain.
 *
 * This is the fetch-scope guard: every candidate is checked against its own
 * source's `listing_url` before any detail page is requested, so a manipulated
 * or hijacked homepage cannot point the scraper at an arbitrary host.
 */
export function sameSite(candidateUrl: string, sourceUrl: string): boolean {
  const candidate = registrableDomainOf(candidateUrl);
  const source = registrableDomainOf(sourceUrl);

  return candidate !== null && source !== null && candidate === source;
}

/** Pathname of a URL, or null when unparseable. Trailing slash normalised away. */
export function pathnameOf(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  } catch {
    return null;
  }
}
