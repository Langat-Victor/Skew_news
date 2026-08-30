import {
  Atom,
  Building2,
  Flame,
  Globe,
  HeartPulse,
  Landmark,
  Newspaper,
  Rocket,
  ThermometerSun,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/*
  Placeholder art for an article whose `image_url` cannot be optimised (an
  unrecognised CDN host — see lib/news/image-hosts.ts). Moved verbatim out of the
  retired lib/mock/top-news.ts.

  These gradient hexes are ART, not brand tokens: they exist only to give an
  empty image slot a category-coded look, which is why they live here rather than
  in app/globals.css.
*/
export type CategoryArt = {
  /** [from, to] for the corner gradient. */
  gradient: [string, string];
  icon: LucideIcon;
};

const CATEGORY_ART: Record<string, CategoryArt> = {
  Politics: { gradient: ["#7f1d1d", "#b42318"], icon: Landmark },
  Health: { gradient: ["#166534", "#22c55e"], icon: HeartPulse },
  Science: { gradient: ["#3730a3", "#6366f1"], icon: Atom },
  World: { gradient: ["#0f766e", "#14b8a6"], icon: Globe },
  Business: { gradient: ["#1e3a8a", "#3b82f6"], icon: Building2 },
  Technology: { gradient: ["#334155", "#64748b"], icon: Rocket },
  Climate: { gradient: ["#b45309", "#f59e0b"], icon: ThermometerSun },
  Economy: { gradient: ["#155e75", "#0891b2"], icon: TrendingUp },
  Soccer: { gradient: ["#065f46", "#10b981"], icon: Trophy },
  Environment: { gradient: ["#9a3412", "#ea580c"], icon: Flame },
};

const FALLBACK_ART: CategoryArt = {
  gradient: ["#3f3f46", "#71717a"],
  icon: Newspaper,
};

/** Never throws — an unknown category from the database is neutral. */
export function categoryArt(category: string): CategoryArt {
  return CATEGORY_ART[category] ?? FALLBACK_ART;
}
