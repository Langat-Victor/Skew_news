import type { BiasBreakdown } from "@/components/ui/bias-meter";
import { cn } from "@/lib/utils";

/** The three framing leans, tied to `BiasBreakdown` so they cannot drift. */
export type BiasTone = keyof BiasBreakdown;

export interface BiasRowProps {
  /** `Left` / `Center` / `Right`. */
  label: string;
  /** Right-hand figure, e.g. `20%` or `2 (20%)`. */
  value: string;
  /** 0-100. Drives the mini bar's fill width. */
  percentage: number;
  tone: BiasTone;
  className?: string;
}

/** Text colour per lean, shared with the sidebar panels so tints cannot drift. */
export const biasToneText: Record<BiasTone, string> = {
  left: "text-bias-left",
  // Center has no editorial tint, so it stays in body colour rather than using
  // --color-bias-center, which is a fill and unreadable as text.
  center: "text-text-primary",
  right: "text-bias-right",
};

const FILL_CLASSES: Record<BiasTone, string> = {
  left: "bg-bias-left",
  center: "bg-bias-center",
  right: "bg-bias-right",
};

/*
  One lean's line in the sidebar panels: label, figure, and a small proportional
  bar. Fixed label and track widths keep the figures and bars aligned down the
  column regardless of label length.
*/
export function BiasRow({
  label,
  value,
  percentage,
  tone,
  className,
}: BiasRowProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-24 shrink-0 text-body-sm text-text-primary">
        {label}
      </span>

      <span
        className={cn(
          "flex-1 text-body-sm font-medium tabular-nums",
          biasToneText[tone],
        )}
      >
        {value}
      </span>

      <span
        aria-hidden
        className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-bg-secondary"
      >
        <span
          // Data-driven width, so it cannot be a utility class.
          style={{ width: `${percentage}%` }}
          className={cn("block h-full rounded-full", FILL_CLASSES[tone])}
        />
      </span>
    </div>
  );
}
