"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import posthog from "posthog-js";
import { AnalysisPanel } from "@/components/ui/analysis-panel";
import { buttonClasses } from "@/components/ui/button";

export interface SourcePanelProps {
  name: string;
  /** `sources.logo_url` — omitted when the source has no stored logo. */
  logoUrl?: string;
  /** `articles.original_url` — where this text was scraped from. */
  originalUrl: string;
  className?: string;
}

/*
  Takes the aside slot the reference gave "Source Breakdown". That panel counted
  outlets covering a story, which nothing in the schema supports — one article
  row is one article from one source. Attribution is what the slot can honestly
  carry, and scraped text needs it anyway: the outlet, and a link back to the
  original.

  Unlike the other analysis panels, the footer here is a real anchor rather than
  inert markup, because the destination already exists.
*/
export function SourcePanel({
  name,
  logoUrl,
  originalUrl,
  className,
}: SourcePanelProps) {
  return (
    <AnalysisPanel title="Source" className={className}>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          /*
            `unoptimized`: a logo is a small, often vector asset that gains
            nothing from the optimiser, and `sources.logo_url` can point at any
            host an editor stores — an unlisted host would make `/_next/image`
            return 400 and draw a broken box. Serving it as-is skips that check.
          */
          <Image
            src={logoUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="size-8 shrink-0 rounded-sm object-contain"
          />
        ) : null}

        <p className="min-w-0 truncate text-body-md font-medium text-text-primary">
          {name}
        </p>
      </div>

      <a
        href={originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => posthog.capture("original_source_opened")}
        className={buttonClasses("secondary", "mt-5 w-full")}
      >
        Read the original
        <ExternalLink size={16} strokeWidth={2} aria-hidden />
      </a>
    </AnalysisPanel>
  );
}
