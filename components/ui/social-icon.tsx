import { cn } from "@/lib/utils";

/*
  lucide-react 1.x ships no brand marks (there is no `Twitter`, `Linkedin`,
  `Instagram`, or `Youtube` export), so the footer's social glyphs are authored
  here as simple geometric marks. They follow lucide's drawing conventions —
  24x24 viewBox, no fill, 2px currentColor stroke, round caps and joins — so
  they sit consistently beside real lucide icons. Not traced brand assets.
*/
export type SocialIconName = "x" | "linkedin" | "instagram" | "youtube";

export interface SocialIconProps {
  name: SocialIconName;
  /** Rendered edge length in px. Matches lucide's `size` prop convention. */
  size?: number;
  className?: string;
}

const LABELS: Record<SocialIconName, string> = {
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  youtube: "YouTube",
};

const PATHS: Record<SocialIconName, React.ReactNode> = {
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  linkedin: (
    <>
      <path d="M6 21V9" />
      <path d="M6 4.5h.01" />
      <path d="M14 21V9" />
      <path d="M14 13a4 4 0 0 1 8 0v8" />
    </>
  ),
  instagram: (
    <>
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </>
  ),
  youtube: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="4" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
};

export function SocialIcon({ name, size = 18, className }: SocialIconProps) {
  return (
    <svg
      role="img"
      aria-label={LABELS[name]}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      {PATHS[name]}
    </svg>
  );
}
