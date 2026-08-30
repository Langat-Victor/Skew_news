"use client";

import Image from "next/image";
import Link from "next/link";
import posthog from "posthog-js";
import { PlaceholderArt } from "@/components/ui/placeholder-art";
import type { RelatedStory } from "@/lib/news/types";
import { cn } from "@/lib/utils";

export interface RelatedStoryCardProps {
  story: RelatedStory;
  /** Thumbnail source, when the target story has a scraped image. */
  imageUrl?: string;
  className?: string;
}

/*
  Horizontal related-story item: fixed thumbnail, then kicker / title / date.
  Renders as a link when the target exists in the feed and as inert markup when
  it does not, so a reference-only stub never becomes a dead link.
*/
export function RelatedStoryCard({
  story,
  imageUrl,
  className,
}: RelatedStoryCardProps) {
  const body = (
    <>
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="112px"
            className="object-cover" unoptimized={imageUrl.includes("guim.co.uk")}
          />
        ) : (
          <PlaceholderArt category={story.category} iconSize={20} />
        )}
      </div>

      <div className="min-w-0">
        <p className="text-caption text-text-secondary">
          {story.category}
          {story.country ? (
            <>
              {" "}
              <span aria-hidden>·</span> {story.country}
            </>
          ) : null}
        </p>

        <h3 className="mt-0.5 text-body-sm font-semibold text-text-primary group-hover:underline">
          <span className="line-clamp-2">{story.title}</span>
        </h3>

        <p className="mt-1 text-caption text-text-secondary">
          {story.publishedAt} <span aria-hidden>·</span> {story.readingTime}
        </p>
      </div>
    </>
  );

  if (!story.slug) {
    // TODO(related): link once the feed carries these stories.
    return <article className={cn("flex gap-3", className)}>{body}</article>;
  }

  return (
    <Link
      href={`/news/${story.slug}`}
      onClick={() =>
        posthog.capture("related_story_opened", {
          article_slug: story.slug,
          category: story.category,
        })
      }
      className={cn(
        "group flex gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bias-right focus-visible:ring-offset-2",
        className,
      )}
    >
      {body}
    </Link>
  );
}
