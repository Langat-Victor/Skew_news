import type { BiasBreakdown } from "@/components/ui/bias-meter";

/*
  Display vocabulary for the analysis enums. Moved verbatim out of the retired
  lib/mock/article-details.ts — these are presentation helpers, not mock data, so
  they outlive it.

  The unions mirror the CHECK constraints in supabase/schema.sql and the narrow
  types in lib/supabase/types.ts. Kept structural rather than imported so this
  module stays free of any database dependency and safe for client components.
*/

const LEANS = ["left", "center", "right"] as const;

export type SourceLean = (typeof LEANS)[number];
export type BiasLabel = SourceLean | "mixed" | "unclear";
export type SentimentLabel = "positive" | "neutral" | "negative";

/** Keeps casing out of the components. */
export const BIAS_LABEL_TEXT: Record<BiasLabel, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
  mixed: "Mixed",
  unclear: "Unclear",
};

export const SENTIMENT_LABEL_TEXT: Record<SentimentLabel, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export type OverallBias = {
  label: BiasLabel;
  /** The strongest lean — drives the heading colour even when label is `mixed`. */
  tone: SourceLean;
  /** The strongest lean's percentage. */
  percentage: number;
};

/**
 * AGENTS.md §19's labelling rule applied to stored percentages: the strongest
 * lean wins unless the top two are within 5 points, in which case the framing is
 * `mixed`. Sorting is stable, so ties resolve left → center → right.
 *
 * This derives a heading from the three percentages for display. It does not
 * replace `article_analyses.bias_label`, which the model produced and the
 * database stores.
 */
export function overallBiasFor(bias: BiasBreakdown): OverallBias {
  const [top, second] = [...LEANS].sort((a, b) => bias[b] - bias[a]);
  const label: BiasLabel = bias[top] - bias[second] < 5 ? "mixed" : top;

  return { label, tone: top, percentage: bias[top] };
}
