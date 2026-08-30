import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipProps {
  label: string;
  className?: string;
}

/** Category pill with a `+` add affordance. */
export function Chip({ label, className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-bg-primary px-4 py-1.5 text-body-sm text-text-primary transition-colors hover:bg-bg-secondary",
        className,
      )}
    >
      {label}
      <Plus size={14} strokeWidth={2} className="text-text-secondary" />
    </span>
  );
}
