import { AnalysisPanel } from "@/components/ui/analysis-panel";
import type { BiasBreakdown } from "@/components/ui/bias-meter";
import { BiasRow, biasToneText } from "@/components/ui/bias-row";
import { formatConfidence } from "@/lib/news/format";
import {
  BIAS_LABEL_TEXT,
  overallBiasFor,
  type SourceLean,
} from "@/lib/news/labels";
import { cn } from "@/lib/utils";

export interface BiasAnalysisPanelProps {
  bias: BiasBreakdown;
  /** `article_analyses.confidence`, 0…1. */
  confidence: number;
  className?: string;
}

/*
  Boilerplate copy, not article data: this describes how the product analyses
  framing in general and must not be confused with `article_analyses.framing_notes`,
  which is per-article and lives in the Framing Details panel.
*/
const METHODOLOGY =
  "Our analysis is based on the political leaning of the publication and how the story is framed. Sources are weighted by reliability and recency.";

const ROWS: readonly { lean: SourceLean; label: string }[] = [
  { lean: "left", label: "Left" },
  { lean: "center", label: "Center" },
  { lean: "right", label: "Right" },
];

export function BiasAnalysisPanel({
  bias,
  confidence,
  className,
}: BiasAnalysisPanelProps) {
  const overall = overallBiasFor(bias);

  return (
    <AnalysisPanel
      title="Bias Analysis"
      action="How We Analyze Bias"
      className={className}
    >
      <p className="text-body-sm text-text-secondary">Overall Bias</p>

      <p
        className={cn(
          "mt-1 text-h2 font-semibold",
          biasToneText[overall.tone],
        )}
      >
        {BIAS_LABEL_TEXT[overall.label]} {overall.percentage}%
      </p>

      {/*
        The reference read "Based on N balanced sources". Nothing stored backs a
        source count — one article row is one article from one source — so this
        states what the number actually is: the model's own confidence in an
        AI-estimated framing (AGENTS.md §19).
      */}
      <p className={cn("mt-1 text-body-sm", biasToneText[overall.tone])}>
        AI-estimated from this article <span aria-hidden>·</span>{" "}
        {formatConfidence(confidence)} confidence
      </p>

      <div className="mt-4 space-y-3 border-t border-divider pt-4">
        {ROWS.map((row) => (
          <BiasRow
            key={row.lean}
            label={row.label}
            value={`${bias[row.lean]}%`}
            percentage={bias[row.lean]}
            tone={row.lean}
          />
        ))}
      </div>

      <p className="mt-4 border-t border-divider pt-4 text-body-sm text-text-secondary">
        {METHODOLOGY}
      </p>
    </AnalysisPanel>
  );
}
