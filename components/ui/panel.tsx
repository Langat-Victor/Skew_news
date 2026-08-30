import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps {
  /** Uppercase section label shown in the panel header. */
  label: string;
  /** Optional note rendered next to the label, e.g. "(4px BASE UNIT)". */
  note?: string;
  children: ReactNode;
  className?: string;
}

/** Bordered section container with a ruled header. Used by every showcase section. */
export function Panel({ label, note, children, className }: PanelProps) {
  return (
    <section
      className={cn(
        "bg-bg-primary border border-border rounded-lg p-6",
        className,
      )}
    >
      <header className="border-b border-divider pb-3 mb-6 flex items-baseline gap-2">
        <h2 className="text-caption font-semibold uppercase tracking-wider text-text-primary">
          {label}
        </h2>
        {note ? (
          <span className="text-caption text-text-secondary">{note}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
