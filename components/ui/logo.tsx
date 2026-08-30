import { cn } from "@/lib/utils";

export interface LogoProps {
  /** `dark` renders white text for use on the dark footer bar. */
  variant?: "light" | "dark";
  /** `md` is the full lockup; `sm` fits headers and the footer bar. */
  size?: "sm" | "md";
  className?: string;
}

const SIZE_CLASSES = {
  sm: { word: "text-h3", sub: "text-caption" },
  md: { word: "text-h1", sub: "text-h4" },
} as const;

/** The "SKEW / news" wordmark lockup. Text-based, no SVG asset. */
export function Logo({ variant = "light", size = "md", className }: LogoProps) {
  const sizes = SIZE_CLASSES[size];

  return (
    <span
      className={cn(
        "inline-flex flex-col items-end leading-none",
        variant === "dark" ? "text-white" : "text-text-primary",
        className,
      )}
    >
      {/*
        `tracking-normal` rather than the `tracking-tight` this carried before:
        that negative tracking was tuned for six lowercase letters. Four bold
        capitals read as cramped under it, having no descenders or x-height
        variation to separate them.
      */}
      <span className={cn("font-bold tracking-normal", sizes.word)}>SKEW</span>
      <span className={cn("font-medium", sizes.sub)}>news</span>
    </span>
  );
}
