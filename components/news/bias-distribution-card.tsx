import { Info } from "lucide-react";
import { BiasMeter, type BiasBreakdown } from "@/components/ui/bias-meter";
import { formatConfidence } from "@/lib/news/format";
import { cn } from "@/lib/utils";

export interface BiasDistributionCardProps {
  bias: BiasBreakdown;
  /** `article_analyses.confidence`, 0…1. */
  confidence: number;
  className?: string;
}

/*
  In-article framing bar. Uses the full-height meter but drops its 0/50/100 axis,
  because the reference prints a caption in that slot instead.

  The reference's caption was a cross-source count ("12 sources"), which no
  stored row supports — one article row is one article from one source. The slot
  carries the analysis' own confidence instead, and says plainly that the
  framing is AI-estimated (AGENTS.md §19).
*/
export function BiasDistributionCard({
  bias,
  confidence,
  className,
}: BiasDistributionCardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-bg-primary p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-h4 font-semibold text-text-primary">
          Bias Distribution
        </h2>
        {/* TODO(bias-explainer): open the methodology sheet once it ships. */}
        <Info
          size={16}
          strokeWidth={2}
          aria-hidden
          className="text-text-secondary"
        />
      </div>

      <BiasMeter
        variant="full"
        axis={false}
        left={bias.left}
        center={bias.center}
        right={bias.right}
        className="mt-3"
      />

      <p className="mt-2 text-body-sm text-text-secondary">
        AI-estimated <span aria-hidden>·</span> {formatConfidence(confidence)}{" "}
        confidence
      </p>
    </section>
  );
}
