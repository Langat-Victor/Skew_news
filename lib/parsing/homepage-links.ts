/*
  Homepage story-card link extraction (AGENTS.md §11).

  ── The visibility limit, stated plainly (decision 15) ──────────────────────────
  §11 asks for "visible story/article card links". Static HTML cannot report
  computed visibility: there is no layout, no CSS cascade, and no viewport here,
  so nothing in this module *tests* whether a link is on screen. What it does
  instead is approximate:

    • strip the containers that structurally are not story cards — header,
      footer, nav, aside, forms, and anything whose class or id reads as
      navigation, menu, breadcrumb, promo, advert, sponsor, social, newsletter,
      or subscribe;
    • honour the explicit hiding signals that ARE in the markup — `[hidden]`,
      `[aria-hidden="true"]`, and an inline `display:none`.

  Anything a stylesheet hides is invisible to this code. The candidate URL filter
  (§12) and article validation (§13) are the real gates; this step only decides
  which links are worth spending a fetch on.
*/

import * as cheerio from "cheerio";

import { absolutize, normalizeUrl } from "@/lib/parsing/url";
import type { SourceRow } from "@/lib/supabase/types";

/** Structurally-not-a-story-card containers, removed before anything is selected. */
const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "header",
  "footer",
  "nav",
  "aside",
  "form",
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  "[hidden]",
  '[aria-hidden="true"]',
  '[style*="display:none"]',
  '[style*="display: none"]',
].join(", ");

/** Class/id substrings that mark a container as chrome rather than content. */
const STRIP_NAME_SUBSTRINGS = [
  "nav",
  "menu",
  "breadcrumb",
  "subscribe",
  "newsletter",
  "promo-banner",
  "advert",
  "sponsor",
  "footer",
  "social",
];

/**
 * Where story cards live, in priority order. Earlier selectors are the ones a
 * news homepage actually uses for its lead stories.
 */
const CARD_SELECTORS = [
  "main a[href]",
  '[role="main"] a[href]',
  "article a[href]",
  '[data-testid*="card" i] a[href]',
  '[class*="card" i] a[href]',
  '[class*="story" i] a[href]',
  '[class*="promo" i] a[href]',
  "h1 a[href], h2 a[href], h3 a[href], h4 a[href]",
];

/** Below this the card selectors clearly missed the page, so widen the net. */
const MIN_SELECTED_ANCHORS = 5;

/** A headline is at least this long; shorter link text is a nav label or an icon. */
const MIN_HEADLINE_LENGTH = 15;

/**
 * Cheerio's node and selection types are derived from its public API rather than
 * imported from `domhandler`, which is a transitive dependency this project does
 * not declare.
 */
type Selection = ReturnType<cheerio.CheerioAPI>;
type Node = ReturnType<Selection["toArray"]>[number];

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * A link carries a plausible headline when its own text is long enough, when it
 * wraps an image whose alt text is, or when it sits inside a heading. A
 * text-free icon link is navigation, not a story card.
 */
function looksLikeHeadline($: cheerio.CheerioAPI, anchor: Selection): boolean {
  if (collapseWhitespace(anchor.text()).length >= MIN_HEADLINE_LENGTH) return true;

  const hasDescriptiveAlt = anchor
    .find("img[alt]")
    .toArray()
    .some((img) => collapseWhitespace($(img).attr("alt") ?? "").length >= MIN_HEADLINE_LENGTH);

  if (hasDescriptiveAlt) return true;

  return anchor.closest("h1, h2, h3, h4").length > 0;
}

/**
 * Normalised, deduped story links from a source homepage, in document order.
 *
 * Document order is preserved deliberately: page position is the only prominence
 * signal static HTML offers, so taking the top N is meaningfully better than
 * taking a random N.
 */
export function extractStoryLinks(html: string, source: SourceRow): string[] {
  const $ = cheerio.load(html);

  $(STRIP_SELECTORS).remove();

  for (const name of STRIP_NAME_SUBSTRINGS) {
    $(`[class*="${name}" i], [id*="${name}" i]`).remove();
  }

  const selected = new Set<Node>();
  for (const selector of CARD_SELECTORS) {
    for (const element of $(selector).toArray()) selected.add(element);
  }

  const allAnchors = $("a[href]").toArray();

  // One pass over the stripped document puts the selection back into document
  // order regardless of which selector contributed each anchor.
  const ordered =
    selected.size >= MIN_SELECTED_ANCHORS
      ? allAnchors.filter((element) => selected.has(element))
      : allAnchors;

  const links: string[] = [];
  const seen = new Set<string>();

  for (const element of ordered) {
    const anchor = $(element);

    if (!looksLikeHeadline($, anchor)) continue;

    const href = anchor.attr("href");
    if (!href) continue;

    const absolute = absolutize(href, source.listing_url);
    if (absolute === null) continue;

    const normalized = normalizeUrl(absolute);
    if (normalized === null || seen.has(normalized)) continue;

    seen.add(normalized);
    links.push(normalized);
  }

  return links;
}
