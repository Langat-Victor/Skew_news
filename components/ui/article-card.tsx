import Image from "next/image";
import { Bookmark, Clock, ImageIcon, Info } from "lucide-react";
import { BiasMeter, type BiasBreakdown } from "@/components/ui/bias-meter";
import { cn } from "@/lib/utils";

export interface ArticleCardProps {
  title: string;
  summary: string;
  category: string;
  country: string;
  imageUrl?: string;
  /** Pre-formatted relative time, e.g. "2h ago". */
  timeAgo: string;
  /** Pre-formatted reading time, e.g. "12 min read". */
  readingTime: string;
  bias: BiasBreakdown;
  className?: string;
}

const IMAGE_WIDTH = 200;
const IMAGE_HEIGHT = 136;

export function ArticleCard({
  title,
  summary,
  category,
  country,
  imageUrl,
  timeAgo,
  readingTime,
  bias,
  className,
}: ArticleCardProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-5 rounded-lg border border-border bg-bg-primary p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row",
        className,
      )}
    >
      <div className="relative shrink-0">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            className="h-[136px] w-full rounded-md object-cover sm:w-[200px]"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-[136px] w-full items-center justify-center rounded-md bg-bg-secondary sm:w-[200px]"
          >
            <ImageIcon size={24} strokeWidth={2} className="text-text-secondary" />
          </div>
        )}
        <button
          type="button"
          aria-label="About this analysis"
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-bg-primary shadow-sm transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bias-right"
        >
          <Info size={16} strokeWidth={2} className="text-text-primary" />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-body-sm text-text-secondary">
          {category} <span aria-hidden>·</span> {country}
        </p>

        <h3 className="text-h3 font-semibold text-text-primary line-clamp-2">
          {title}
        </h3>

        <p className="text-body-md text-text-secondary line-clamp-2">
          {summary}
        </p>

        <BiasMeter
          variant="compact"
          left={bias.left}
          center={bias.center}
          right={bias.right}
          className="mt-1"
        />

        <div className="mt-1 flex items-center gap-6 text-body-sm text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={16} strokeWidth={2} />
            {timeAgo}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bookmark size={16} strokeWidth={2} />
            {readingTime}
          </span>
        </div>
      </div>
    </article>
  );
}
