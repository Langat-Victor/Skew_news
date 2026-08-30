import Image from "next/image";
import { PlaceholderArt } from "@/components/ui/placeholder-art";
import { cn } from "@/lib/utils";

export interface ArticleHeroProps {
  category: string;
  imageUrl?: string;
  /**
   * Caption and credit render only when set. No mock story has a scraped photo,
   * so printing a credit under placeholder art would be a fabrication.
   */
  caption?: string;
  credit?: string;
  className?: string;
}

export function ArticleHero({
  category,
  imageUrl,
  caption,
  credit,
  className,
}: ArticleHeroProps) {
  return (
    <figure className={cn(className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-md">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={caption ?? ""}
            fill
            sizes="(min-width: 1024px) 66vw, 100vw"
            priority
            className="object-cover" unoptimized={imageUrl.includes("guim.co.uk")}
          />
        ) : (
          <PlaceholderArt category={category} iconSize={56} />
        )}
      </div>

      {caption || credit ? (
        <figcaption className="mt-2 text-caption text-text-secondary">
          {caption ? <span className="block">{caption}</span> : null}
          {credit ? <span className="block">{credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
