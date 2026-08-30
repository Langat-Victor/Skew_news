import { AnalysisPanel } from "@/components/ui/analysis-panel";
import {
  BIAS_LABEL_TEXT,
  SENTIMENT_LABEL_TEXT,
  type BiasLabel,
  type SentimentLabel,
} from "@/lib/news/labels";

export interface FramingDetailsPanelProps {
  /**
   * `article_analyses.bias_label` — the model's own label, which can be `mixed`
   * or `unclear` and need not match the heading `overallBiasFor` derives from
   * the percentages.
   */
  biasLabel: BiasLabel;
  sentimentLabel: SentimentLabel;
  /** −1…1 */
  sentimentScore: number;
  /** 0…1 */
  confidence: number;
  framingNotes: string;
  loadedTerms: string[];
  className?: string;
}

/*
  Not in the UI reference. AGENTS.md §19 requires the details page to show
  sentiment, confidence, framing notes, and loaded terms, and the reference draws
  none of the four — so they are collected here, in one droppable panel, rather
  than sprinkled through the reference-faithful sections. The stored framing
  label joins them: the bias panels above derive their heading from the
  percentages, so this is the only place the model's own label appears.
*/
export function FramingDetailsPanel({
  biasLabel,
  sentimentLabel,
  sentimentScore,
  confidence,
  framingNotes,
  loadedTerms,
  className,
}: FramingDetailsPanelProps) {
  return (
    <AnalysisPanel title="Framing Details" className={className}>
      <dl className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-body-sm text-text-secondary">
            AI-estimated framing
          </dt>
          <dd className="text-body-sm font-medium text-text-primary">
            {BIAS_LABEL_TEXT[biasLabel]}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="text-body-sm text-text-secondary">Sentiment</dt>
          <dd className="text-body-sm font-medium tabular-nums text-text-primary">
            {SENTIMENT_LABEL_TEXT[sentimentLabel]} (
            {sentimentScore.toFixed(2)})
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="text-body-sm text-text-secondary">Confidence</dt>
          <dd className="text-body-sm font-medium tabular-nums text-text-primary">
            {Math.round(confidence * 100)}%
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-body-sm text-text-secondary">{framingNotes}</p>

      {loadedTerms.length > 0 ? (
        <>
          <p className="mt-4 text-caption font-medium text-text-secondary">
            Loaded terms
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {loadedTerms.map((term) => (
              <li
                key={term}
                /*
                  Hand-rolled rather than reusing `Chip`, whose built-in `+` icon
                  reads as "follow this topic" — wrong meaning for a term the
                  analysis flagged.
                */
                className="rounded-full border border-border bg-bg-secondary px-2.5 py-1 text-caption text-text-secondary"
              >
                {term}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </AnalysisPanel>
  );
}
