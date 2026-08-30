import { categoryArt } from "@/lib/news/category-art";
import { cn } from "@/lib/utils";

export interface PlaceholderArtProps {
  /** Picks the gradient + glyph. Unknown categories fall back to neutral. */
  category: string;
  /** Glyph size in px. Scale it to the slot: 40 on a card, 56 on a hero. */
  iconSize?: number;
  className?: string;
}

/*
  Fills an image slot for an article with no usable image: either `image_url` has
  not been scraped yet, or its host is not one `next/image` may optimise (see
  lib/news/image-hosts.ts). Shared by the home card, the details-page hero, and
  the related-story thumbnails so the three cannot drift; the gradient stops
  themselves live in lib/news/category-art.ts.

  Decorative by definition — it carries no information the surrounding text does
  not already state, so it is `aria-hidden` and the caller's `<Image alt>`
  equivalent is simply absent.
*/
export function PlaceholderArt({
  category,
  iconSize = 40,
  className,
}: PlaceholderArtProps) {
  const art = categoryArt(category);
  const Icon = art.icon;

  return (
    <div
      aria-hidden
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{
        // Set inline rather than via `from-*`/`to-*` utilities because the
        // stops are data, not tokens — Tailwind cannot generate them at build
        // time.
        backgroundImage: `linear-gradient(to bottom right, ${art.gradient[0]}, ${art.gradient[1]})`,
      }}
    >
      <Icon
        size={iconSize}
        strokeWidth={1.5}
        className="text-white opacity-25"
      />
    </div>
  );
}
