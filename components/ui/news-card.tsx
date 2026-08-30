"use client";

import Image from "next/image";
import Link from "next/link";
import posthog from "posthog-js";
import { Info } from "lucide-react";
import { BiasMeter, type BiasBreakdown } from "@/components/ui/bias-meter";
import { PlaceholderArt } from "@/components/ui/placeholder-art";
import { formatConfidence } from "@/lib/news/format";
import {
  BIAS_LABEL_TEXT,
  SENTIMENT_LABEL_TEXT,
  type BiasLabel,
  type SentimentLabel,
} from "@/lib/news/labels";
import { cn } from "@/lib/utils";

export interface NewsCardProps {
  /** Story slug — the card links to `/news/{id}`. */
  id: string;
  title: string;
  category: string;
  /** `articles.country` is nullable; the meta line omits it when absent. */
  country?: string;
  imageUrl?: string;
  bias: BiasBreakdown;
  /** The model's stored framing label — §19 requires it on every card. */
  biasLabel: BiasLabel;
  sourceName: string;
  /** Pre-formatted for display, e.g. `Aug 26, 2026`. */
  publishedAt: string;
  sentimentLabel: SentimentLabel;
  /** `article_analyses.confidence`, 0…1. */
  confidence: number;
  className?: string;
}

/*
  Home-page story card: a full-bleed 16:9 image on top (flush to the card
  edges, top corners rounded), then meta / title / bias / attribution. Distinct
  from `ArticleCard`, which insets a fixed-size image inside its padding. Both
  compose the same `BiasMeter`, so nothing drifts.

  The reference printed a cross-source count ("12 sources") in the bottom slot.
  No stored row supports that — one article row is one article from one source —
  so the slot carries the things AGENTS.md §19 requires a card to show and the
  reference omits: source name, published date, framing label, sentiment label,
  and confidence.

  The whole card is one link, so the `<article>` stays inside it and the info
  badge stays a non-interactive `<span>` — a nested control would be both
  invalid markup and an extra tab stop over the same destination.
*/
export function NewsCard({
  id,
  title,
  category,
  country,
  imageUrl,
  bias,
  biasLabel,
  sourceName,
  publishedAt,
  sentimentLabel,
  confidence,
  className,
}: NewsCardProps) {
  return (
    <Link
      href={`/news/${id}`}
      onClick={() =>
        posthog.capture("article_opened", {
          article_slug: id,
          category,
          bias_label: biasLabel,
          sentiment_label: sentimentLabel,
        })
      }
      className={cn(
        "group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bias-right focus-visible:ring-offset-2",
        className,
      )}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-bg-primary shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative aspect-video w-full">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover" unoptimized={imageUrl.includes("guim.co.uk")}
            />
          ) : (
            <PlaceholderArt category={category} iconSize={40} />
          )}

          {/* TODO(bias-explainer): open the methodology sheet once it ships. */}
          <span
            aria-hidden
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-bg-primary/95 shadow-sm"
          >
            <Info size={16} strokeWidth={2} className="text-text-primary" />
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="text-body-sm text-text-secondary">
            {category}
            {country ? (
              <>
                {" "}
                <span aria-hidden>·</span> {country}
              </>
            ) : null}
          </p>

          <h3 className="mt-1 text-h3 font-semibold text-text-primary group-hover:underline">
            {title}
          </h3>

          <BiasMeter
            variant="compact"
            labels="short"
            left={bias.left}
            center={bias.center}
            right={bias.right}
            className="mt-auto pt-4"
          />

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-body-sm text-text-secondary">
            <p>
              {sourceName} <span aria-hidden>·</span> {publishedAt}
            </p>
            <p>
              {BIAS_LABEL_TEXT[biasLabel]} framing <span aria-hidden>·</span>{" "}
              {SENTIMENT_LABEL_TEXT[sentimentLabel]} <span aria-hidden>·</span>{" "}
              {formatConfidence(confidence)} confident
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
