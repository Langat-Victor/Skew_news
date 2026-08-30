import { AnalysisPanel } from "@/components/ui/analysis-panel";

export interface AiSummaryPanelProps {
  summary: string[];
  generatedAt: string;
  readingTime: string;
  disclaimer: string;
  className?: string;
}

export function AiSummaryPanel({
  summary,
  generatedAt,
  readingTime,
  disclaimer,
  className,
}: AiSummaryPanelProps) {
  return (
    <AnalysisPanel
      title="AI Summary"
      action="Provide Feedback"
      className={className}
    >
      <p className="text-caption text-text-secondary">
        Generated {generatedAt} <span aria-hidden>·</span> {readingTime}
      </p>

      <ul className="mt-4 list-disc space-y-3 pl-4 text-body-sm text-text-primary">
        {summary.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>

      {/* AGENTS.md §19: framing output is AI-estimated, never presented as fact. */}
      <p className="mt-4 text-caption text-text-secondary">{disclaimer}</p>
    </AnalysisPanel>
  );
}
