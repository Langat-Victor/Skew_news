/*
  Article detail page parsing and validation (AGENTS.md §13).

  This is the gate that decides whether a fetched page becomes a stored article.
  It is deliberately strict in one direction: every field §13 calls required —
  title, image, published date, meaningful body — must be present and plausible,
  or the page is rejected with a named reason. §16 is explicit that inserting
  fewer good articles beats inserting bad ones.

  Two rules from §13 shape the body logic in ways worth flagging up front:

    • "Do not reject a page only because paragraph extraction returned one
      paragraph." Hence the one-big-paragraph split BEFORE the gate, not after.
    • Body quality passes on EITHER 3+ meaningful paragraphs OR 900+ meaningful
      characters — not both.

  Pure parsing. No network, no environment access, no Supabase.
*/

import * as cheerio from "cheerio";

import { hasRejectedPathSegment, isGenericTitle } from "@/lib/parsing/reject-list";
import { absolutize, normalizeUrl, pathnameOf } from "@/lib/parsing/url";
import type { RejectionReason } from "@/lib/pipeline/types";

export type ParsedArticle = {
  title: string;
  imageUrl: string;
  publishedAt: string; // ISO 8601
  canonicalUrl: string | null;
  author: string | null;
  category: string | null;
  paragraphs: string[];
};

export type ParseArticleResult =
  | { ok: true; article: ParsedArticle }
  | { ok: false; reason: RejectionReason; detail?: string };

type Selection = ReturnType<cheerio.CheerioAPI>;

function fail(reason: RejectionReason, detail?: string): ParseArticleResult {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = collapseWhitespace(value);

  return trimmed.length > 0 ? trimmed : null;
}

// ── JSON-LD ───────────────────────────────────────────────────────────────────

const ARTICLE_LD_TYPES = ["NewsArticle", "Article", "ReportageNewsArticle", "BlogPosting"];

type LdNode = Record<string, unknown>;

function isRecord(value: unknown): value is LdNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Expands arrays and `@graph` wrappers into a flat list of candidate nodes. */
function flattenLd(value: unknown, into: LdNode[]): void {
  if (Array.isArray(value)) {
    for (const item of value) flattenLd(item, into);
    return;
  }

  if (!isRecord(value)) return;

  into.push(value);

  if ("@graph" in value) flattenLd(value["@graph"], into);
}

function ldTypeMatches(node: LdNode): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];

  return types.some((entry) => typeof entry === "string" && ARTICLE_LD_TYPES.includes(entry));
}

/**
 * The first JSON-LD node that describes an article, or null.
 *
 * Each script block is parsed in its own `try`/`catch`: outlets ship several
 * blocks per page and one malformed blob must not cost us the whole article.
 */
function readArticleLd($: cheerio.CheerioAPI): LdNode | null {
  const nodes: LdNode[] = [];

  for (const element of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(element).text().trim();
    if (!raw) continue;

    try {
      flattenLd(JSON.parse(raw), nodes);
    } catch {
      continue;
    }
  }

  return nodes.find(ldTypeMatches) ?? null;
}

// ── Metadata field chains ─────────────────────────────────────────────────────

function metaContent($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const selector of selectors) {
    for (const element of $(selector).toArray()) {
      const content = asString($(element).attr("content"));
      if (content !== null) return content;
    }
  }

  return null;
}

/** `Headline of the story | Outlet` → `Headline of the story`. */
function stripOutletSuffix(pageTitle: string): string {
  return collapseWhitespace(pageTitle.replace(/\s+[|–—-]\s+[^|–—-]{1,40}$/, ""));
}

function readTitle($: cheerio.CheerioAPI, ld: LdNode | null): string | null {
  return (
    asString(ld?.headline) ??
    metaContent($, ['meta[property="og:title"]', 'meta[name="og:title"]']) ??
    asString($("h1").first().text()) ??
    (() => {
      const pageTitle = asString($("title").first().text());
      return pageTitle === null ? null : asString(stripOutletSuffix(pageTitle));
    })()
  );
}

/** JSON-LD `image` is a string, an object with `url`, or an array of either. */
function ldImageCandidates(value: unknown): string[] {
  if (typeof value === "string") return [value];

  if (Array.isArray(value)) return value.flatMap(ldImageCandidates);

  if (isRecord(value)) {
    const url = asString(value.url) ?? asString(value.contentUrl);
    return url === null ? [] : [url];
  }

  return [];
}

/**
 * Rejected image forms. `data:` URIs are inline placeholders rather than the
 * story's picture, and an `.svg` is a logo or an icon on every one of these
 * outlets.
 */
function isUsableImage(url: string): boolean {
  if (url.toLowerCase().startsWith("data:")) return false;

  const withoutQuery = url.split("?")[0]?.toLowerCase() ?? "";

  return !withoutQuery.endsWith(".svg");
}

function readImageUrl(
  $: cheerio.CheerioAPI,
  ld: LdNode | null,
  container: Selection,
  requestUrl: string,
): string | null {
  const candidates = [
    ...ldImageCandidates(ld?.image),
    metaContent($, ['meta[property="og:image"]', 'meta[name="og:image"]']),
    metaContent($, ['meta[name="twitter:image"]', 'meta[property="twitter:image"]']),
    ...container
      .find("figure img[src]")
      .toArray()
      .map((element) => $(element).attr("src") ?? null),
  ];

  for (const candidate of candidates) {
    if (candidate === null || !isUsableImage(candidate)) continue;

    const absolute = absolutize(candidate, requestUrl);
    if (absolute === null) continue;

    const normalized = normalizeUrl(absolute);
    // Stored as found (decision 10): no IMAGE_HOSTS allowlist is applied here —
    // that is a rendering guard, and an unlisted CDN must not cost a real story.
    if (normalized !== null) return normalized;
  }

  return null;
}

const PUBLISHED_META_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[name="article:published_time"]',
  'meta[name="pubdate"]',
  'meta[name="publish-date"]',
  'meta[itemprop="datePublished"]',
  'meta[name="date"]',
  'meta[name="DC.date.issued"]',
];

/** Anything older than this is a mis-parse, not a news article we just scraped. */
const EARLIEST_PUBLISH_YEAR = 2000;
/** Clock-skew tolerance for outlets that stamp a story slightly ahead. */
const MAX_FUTURE_MS = 2 * 24 * 60 * 60 * 1000;

function readPublishedAtRaw($: cheerio.CheerioAPI, ld: LdNode | null): string | null {
  return (
    asString(ld?.datePublished) ??
    metaContent($, PUBLISHED_META_SELECTORS) ??
    asString($("time[datetime]").first().attr("datetime"))
  );
}

function readCanonicalUrl($: cheerio.CheerioAPI, requestUrl: string): string | null {
  const candidate =
    asString($('link[rel="canonical"]').first().attr("href")) ??
    metaContent($, ['meta[property="og:url"]', 'meta[name="og:url"]']);

  if (candidate === null) return null;

  const absolute = absolutize(candidate, requestUrl);
  if (absolute === null) return null;

  return normalizeUrl(absolute);
}

function readAuthor($: cheerio.CheerioAPI, ld: LdNode | null): string | null {
  const ldAuthor = ld?.author;
  const fromLd = Array.isArray(ldAuthor)
    ? asString(isRecord(ldAuthor[0]) ? ldAuthor[0].name : ldAuthor[0])
    : isRecord(ldAuthor)
      ? asString(ldAuthor.name)
      : asString(ldAuthor);

  const author =
    fromLd ??
    metaContent($, ['meta[name="author"]', 'meta[property="article:author"]']) ??
    asString($('[rel="author"]').first().text());

  return author === null ? null : asString(author.replace(/^by\s+/i, ""));
}

/**
 * Section names this project recognises in a URL's first path segment. Kept
 * short on purpose: a wrong guess here mislabels an article in the UI, and the
 * column is nullable.
 */
const SECTION_VOCABULARY: ReadonlySet<string> = new Set([
  "world",
  "us",
  "politics",
  "business",
  "technology",
  "science",
  "health",
  "environment",
  "climate",
  "entertainment",
  "culture",
  "media",
  "opinion",
  "education",
  "money",
]);

/**
 * Title-cases a lowercase section name for display, but leaves a value that
 * already carries capitals alone — `U.S. News` must not become `U.s. News`.
 */
function forDisplay(value: string): string {
  if (/[A-Z]/.test(value)) return value;

  return value.replace(/(^|[\s-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
}

function readCategory($: cheerio.CheerioAPI, ld: LdNode | null, requestUrl: string): string | null {
  const section = Array.isArray(ld?.articleSection)
    ? asString(ld.articleSection[0])
    : asString(ld?.articleSection);

  const explicit =
    section ?? metaContent($, ['meta[property="article:section"]', 'meta[name="article:section"]']);

  if (explicit !== null) return forDisplay(explicit);

  const firstSegment = (pathnameOf(requestUrl) ?? "").split("/").filter(Boolean)[0]?.toLowerCase();

  return firstSegment && SECTION_VOCABULARY.has(firstSegment) ? forDisplay(firstSegment) : null;
}

// ── Body extraction and cleanup (§13) ─────────────────────────────────────────

const BODY_CONTAINER_SELECTORS = [
  '[itemprop="articleBody"]',
  "article",
  "main",
  '[role="main"]',
  "body",
];

/** The container holding the most paragraph text wins. */
function pickBodyContainer($: cheerio.CheerioAPI): Selection {
  let best: Selection = $("body");
  let bestLength = -1;

  for (const selector of BODY_CONTAINER_SELECTORS) {
    for (const element of $(selector).toArray()) {
      const candidate = $(element);
      const length = candidate.find("p").text().trim().length;

      if (length > bestLength) {
        best = candidate;
        bestLength = length;
      }
    }
  }

  return best;
}

/** §13's cleanup list, as element selectors. */
const BODY_STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "form",
  "figcaption",
  "aside",
  "nav",
  "header",
  "footer",
  '[aria-hidden="true"]',
  "[hidden]",
].join(", ");

/** §13's cleanup list, as class/id substrings. */
const BODY_STRIP_NAME_SUBSTRINGS = [
  "newsletter",
  "subscribe",
  "sign-up",
  "paywall",
  "related",
  "most-read",
  "most-viewed",
  "recommend",
  "trending",
  "promo",
  "advert",
  "sponsor",
  "social",
  "share",
  "tags",
  "byline",
  "caption",
  "credit",
  "disclaimer",
  "read-more",
  "load-more",
];

const BOILERPLATE_PREFIX =
  /^(advertisement|sponsored|share this|follow us|sign up|subscribe|read more|related|most read|most viewed|load more|copyright|all rights reserved|©|photo:|image:|credit:|getty|ap photo|watch:|listen:|editor'?s note:)/i;

const SENTENCE_END = /[.!?]["')\]]?$/;

/** Short and unpunctuated reads as a caption or a nav label, not a sentence. */
const MIN_STANDALONE_PARAGRAPH = 40;
const NON_LETTER_RATIO_LIMIT = 0.6;

function nonLetterRatio(text: string): number {
  const letters = text.replace(/[^A-Za-z]/g, "").length;

  return text.length === 0 ? 1 : 1 - letters / text.length;
}

function isBoilerplate(paragraph: string): boolean {
  if (paragraph.length < MIN_STANDALONE_PARAGRAPH && !SENTENCE_END.test(paragraph)) return true;
  if (BOILERPLATE_PREFIX.test(paragraph)) return true;

  // A CSS rule dump, or inline JavaScript that leaked into the text.
  if (paragraph.includes("{") && paragraph.includes("}") && paragraph.includes(":")) return true;
  if (/function\s*\(|\bvar\s+[\w$]+\s*=/.test(paragraph)) return true;

  return nonLetterRatio(paragraph) >= NON_LETTER_RATIO_LIMIT;
}

/** Over this length, one paragraph is an extraction artefact rather than a paragraph. */
const ONE_BIG_PARAGRAPH_LIMIT = 600;
const SENTENCES_PER_CHUNK = 3;

function splitIntoParagraphs(text: string): string[] {
  const byBlankLine = text
    .split(/\n{2,}/)
    .map(collapseWhitespace)
    .filter((part) => part.length > 0);

  if (byBlankLine.length > 1) return byBlankLine;

  const sentences = collapseWhitespace(text).match(/[^.!?]+[.!?]+["')\]]*\s*/g);
  if (sentences === null) return byBlankLine;

  const chunks: string[] = [];
  for (let index = 0; index < sentences.length; index += SENTENCES_PER_CHUNK) {
    const chunk = collapseWhitespace(sentences.slice(index, index + SENTENCES_PER_CHUNK).join(" "));
    if (chunk.length > 0) chunks.push(chunk);
  }

  return chunks.length > 0 ? chunks : byBlankLine;
}

function extractParagraphs($: cheerio.CheerioAPI, container: Selection): string[] {
  container.find(BODY_STRIP_SELECTORS).remove();

  for (const name of BODY_STRIP_NAME_SUBSTRINGS) {
    container.find(`[class*="${name}" i], [id*="${name}" i]`).remove();
  }

  const rawParagraphs = container.find("p").toArray();
  const collected: string[] = [];
  const seen = new Set<string>();

  for (const element of rawParagraphs) {
    const paragraph = collapseWhitespace($(element).text());

    if (!paragraph || isBoilerplate(paragraph)) continue;
    // Repeated navigation labels survive cleanup on some outlets; an exact
    // duplicate of an earlier paragraph is never real body copy.
    if (seen.has(paragraph)) continue;

    seen.add(paragraph);
    collected.push(paragraph);
  }

  // §13: one extracted paragraph is not grounds for rejection. Split before the
  // gate rather than failing a page whose body arrived as a single block.
  if (collected.length === 1 && collected[0].length > ONE_BIG_PARAGRAPH_LIMIT) {
    const sourceText = $(rawParagraphs[0]).text();
    const split = splitIntoParagraphs(sourceText);

    if (split.length > 1) return split;
  }

  if (collected.length === 0) {
    return splitIntoParagraphs(container.text()).filter((paragraph) => !isBoilerplate(paragraph));
  }

  return collected;
}

// ── The §13 gate ──────────────────────────────────────────────────────────────

const MIN_PARAGRAPHS = 3;
const MIN_BODY_CHARACTERS = 900;

const HEADLINE_LIKE_LIMIT = 80;
const HEADLINE_LIKE_RATIO = 0.5;

const TITLE_WORD_MIN_LENGTH = 5;
const TITLE_STOPWORDS: ReadonlySet<string> = new Set([
  "about",
  "after",
  "again",
  "against",
  "among",
  "because",
  "before",
  "being",
  "between",
  "could",
  "during",
  "every",
  "first",
  "found",
  "their",
  "there",
  "these",
  "those",
  "under",
  "until",
  "where",
  "which",
  "while",
  "would",
]);

/**
 * A body that is mostly short, unpunctuated lines is a list of other stories'
 * headlines (§13: "body is mostly unrelated headlines").
 */
function isMostlyHeadlines(paragraphs: string[]): boolean {
  const headlineLike = paragraphs.filter(
    (paragraph) => paragraph.length < HEADLINE_LIKE_LIMIT && !SENTENCE_END.test(paragraph),
  ).length;

  return headlineLike / paragraphs.length >= HEADLINE_LIKE_RATIO;
}

/**
 * Heuristic, not a proof (§13: "page has no clear article-specific subject").
 * If a significant word from the headline never appears in the body, the body
 * probably belongs to a different page than the title — a listing wrapper, or a
 * consent interstitial. When the headline has no significant word to test, the
 * check is skipped rather than treated as a failure.
 */
function mentionsTitleSubject(title: string, body: string): boolean {
  const haystack = body.toLowerCase();

  const significant = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= TITLE_WORD_MIN_LENGTH && !TITLE_STOPWORDS.has(word));

  if (significant.length === 0) return true;

  return significant.some((word) => haystack.includes(word));
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Parses one article detail page. Never throws: an unusable page comes back as
 * `{ ok: false, reason }` so §9's run logging can tally why pages were lost.
 *
 * `requestUrl` is the URL actually fetched, used to resolve relative hrefs.
 */
export function parseArticle(html: string, requestUrl: string): ParseArticleResult {
  const $ = cheerio.load(html);
  const ld = readArticleLd($);

  // Container first: the image fallback reads `figure img` from it, and body
  // cleanup would strip those figures away.
  const container = pickBodyContainer($);

  const title = readTitle($, ld);
  if (title === null) return fail("missing_title");
  if (isGenericTitle(title)) return fail("generic_title", title);

  const imageUrl = readImageUrl($, ld, container, requestUrl);
  if (imageUrl === null) return fail("missing_image");

  const publishedRaw = readPublishedAtRaw($, ld);
  if (publishedRaw === null) return fail("missing_published_date");

  const published = new Date(publishedRaw);
  if (Number.isNaN(published.getTime())) return fail("invalid_published_date", publishedRaw);
  if (published.getUTCFullYear() < EARLIEST_PUBLISH_YEAR) {
    return fail("invalid_published_date", publishedRaw);
  }
  if (published.getTime() > Date.now() + MAX_FUTURE_MS) {
    return fail("invalid_published_date", publishedRaw);
  }

  const canonicalUrl = readCanonicalUrl($, requestUrl);
  if (canonicalUrl !== null) {
    // §13 rejects a page whose canonical points at a listing/category/program/
    // product page. The comparison against the source's own listing path needs
    // the source row, so the pipeline re-checks the canonical there; what is
    // visible from here is the site root and §9's reject list.
    const canonicalPath = pathnameOf(canonicalUrl);
    if (canonicalPath === null || canonicalPath === "/" || canonicalPath === "") {
      return fail("canonical_is_listing", canonicalUrl);
    }
    const rejectedSegment = hasRejectedPathSegment(canonicalPath);
    if (rejectedSegment !== null) return fail("canonical_is_listing", rejectedSegment);
  }

  const paragraphs = extractParagraphs($, container);
  const bodyCharacters = paragraphs.reduce((total, paragraph) => total + paragraph.length, 0);

  // §13's either/or gate: 3+ paragraphs OR 900+ meaningful characters.
  if (paragraphs.length < MIN_PARAGRAPHS && bodyCharacters < MIN_BODY_CHARACTERS) {
    return fail("body_too_thin", `${paragraphs.length} paragraphs, ${bodyCharacters} chars`);
  }

  if (isMostlyHeadlines(paragraphs)) return fail("body_mostly_headlines");

  if (!mentionsTitleSubject(title, paragraphs.join(" "))) return fail("no_clear_subject");

  return {
    ok: true,
    article: {
      title,
      imageUrl,
      publishedAt: published.toISOString(),
      canonicalUrl,
      author: readAuthor($, ld),
      // `country` is deliberately not extracted (decision 11): article markup
      // carries no honest country signal.
      category: readCategory($, ld, requestUrl),
      paragraphs,
    },
  };
}
