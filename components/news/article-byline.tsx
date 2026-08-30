import { Bookmark, Ellipsis, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ArticleBylineProps {
  /** `articles.author` is nullable — the "By …" segment is dropped when absent. */
  author?: string;
  /** Pre-formatted for display, e.g. `May 31, 2026`. */
  publishedAt: string;
  readingTime: string;
  className?: string;
}

/*
  Byline on the left, reader actions on the right. The actions are inert markup
  rather than buttons — saving needs Clerk, and sharing needs a client component
  — so they stay out of the tab order until they do something.
  TODO(reader-actions): make these buttons once auth and a share handler exist.
*/
export function ArticleByline({
  author,
  publishedAt,
  readingTime,
  className,
}: ArticleBylineProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <p className="flex items-center gap-3 text-body-sm text-text-secondary">
        {author ? (
          <>
            <span>By {author}</span>
            <span aria-hidden className="text-border">
              |
            </span>
          </>
        ) : null}
        <span>{publishedAt}</span>
        <span aria-hidden className="text-border">
          |
        </span>
        <span>{readingTime}</span>
      </p>

      <div
        aria-hidden
        className="flex items-center gap-5 text-body-sm text-text-secondary"
      >
        <span className="flex items-center gap-1.5">
          Save
          <Bookmark size={16} strokeWidth={2} className="text-text-primary" />
        </span>
        <span className="flex items-center gap-1.5">
          Share
          <Share2 size={16} strokeWidth={2} className="text-text-primary" />
        </span>
        <Ellipsis size={16} strokeWidth={2} className="text-text-primary" />
      </div>
    </div>
  );
}
