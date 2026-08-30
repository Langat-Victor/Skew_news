import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AnalysisPanelProps {
  title: string;
  /** The reference's circled-i affordance in the header. Inert. */
  info?: boolean;
  /**
   * Full-width action at the foot of the panel. Rendered as inert markup until
   * the feature it names exists — see the TODO below.
   */
  action?: string;
  children: ReactNode;
  className?: string;
}

/*
  Shell for the news-details analysis sidebar. Deliberately not `Panel`, which
  is the design-system showcase container: that one has an uppercase, ruled
  header, whereas these read as titled cards with an info affordance and an
  optional footer button.
*/
export function AnalysisPanel({
  title,
  info = true,
  action,
  children,
  className,
}: AnalysisPanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-bg-primary p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
        {info ? (
          <Info
            size={16}
            strokeWidth={2}
            aria-hidden
            className="mt-1 shrink-0 text-text-secondary"
          />
        ) : null}
      </div>

      <div className="mt-4">{children}</div>

      {action ? (
        /*
          TODO(analysis-actions): make this a <button>/<Link> once the
          methodology sheet, feedback form, and full source list exist. Inert
          markup keeps it out of the tab order until then.
        */
        <span
          aria-hidden
          className={buttonClasses("secondary", "mt-5 w-full")}
        >
          {action}
        </span>
      ) : null}
    </section>
  );
}
