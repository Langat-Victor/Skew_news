import { cn } from "@/lib/utils";

export interface BiasBreakdown {
  /** 0-100. Must sum to 100 with `center` and `right` (AGENTS.md §19). */
  left: number;
  center: number;
  right: number;
}

export interface BiasMeterProps extends BiasBreakdown {
  /** `full` adds the 0/50/100 axis beneath the bar. `compact` fits inside a card. */
  variant?: "full" | "compact";
  /**
   * `short` abbreviates the left segment to `L 20%`. The left segment is
   * usually the narrowest, so narrow cards need the extra room. Center and
   * right are unaffected, and the `aria-label` stays spelled out either way.
   */
  labels?: "long" | "short";
  /**
   * Set `false` to drop the 0/50/100 axis from the `full` variant, for callers
   * that put their own caption under the bar (the details page prints the
   * source count there). Ignored by `compact`, which has no axis.
   */
  axis?: boolean;
  className?: string;
}

type Segment = {
  key: keyof BiasBreakdown;
  label: string;
  value: number;
  className: string;
};

export function BiasMeter({
  left,
  center,
  right,
  variant = "full",
  labels = "long",
  axis = true,
  className,
}: BiasMeterProps) {
  const total = left + center + right;

  if (process.env.NODE_ENV !== "production" && total !== 100) {
    // Surface bad analysis data without blanking the page it renders on.
    console.warn(
      `BiasMeter: percentages must sum to 100, received ${total} (left ${left}, center ${center}, right ${right}).`,
    );
  }

  const allSegments: Segment[] = [
    {
      key: "left",
      label: labels === "short" ? `L ${left}%` : `Left ${left}%`,
      value: left,
      className: "bg-bias-left text-white",
    },
    {
      key: "center",
      label: `Center ${center}%`,
      value: center,
      className: "bg-bias-center text-text-primary",
    },
    {
      key: "right",
      label: `Right ${right}%`,
      value: right,
      className: "bg-bias-right text-white",
    },
  ];

  const segments = allSegments.filter((segment) => segment.value > 0);

  const isFull = variant === "full";

  return (
    <div className={cn("w-full", className)}>
      <div
        role="img"
        aria-label={`AI-estimated political framing: left ${left}%, center ${center}%, right ${right}%`}
        className={cn(
          "flex w-full overflow-hidden rounded-sm",
          isFull ? "h-8" : "h-5",
        )}
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{ flexGrow: segment.value, flexBasis: 0 }}
            className={cn(
              "flex items-center justify-center overflow-hidden px-2 font-medium whitespace-nowrap",
              isFull ? "text-body-sm" : "text-caption",
              segment.className,
            )}
          >
            <span className="truncate">{segment.label}</span>
          </div>
        ))}
      </div>

      {isFull && axis ? (
        <div
          aria-hidden
          className="mt-1.5 flex justify-between text-caption text-text-secondary"
        >
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      ) : null}
    </div>
  );
}
