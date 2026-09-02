import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiSummaryPanel } from "@/components/news/ai-summary-panel";
import { ArticleByline } from "@/components/news/article-byline";
import { ArticleHero } from "@/components/news/article-hero";
import { BiasAnalysisPanel } from "@/components/news/bias-analysis-panel";
import { BiasDistributionCard } from "@/components/news/bias-distribution-card";
import { FramingDetailsPanel } from "@/components/news/framing-details-panel";
import { NewsletterCta } from "@/components/news/newsletter-cta";
import { RelatedStories } from "@/components/news/related-stories";
import { SourcePanel } from "@/components/news/source-panel";
import { auth } from "@clerk/nextjs/server";
import {
  getArticleBySlug,
  getRecentArticleSlugs,
  getRelatedArticles,
} from "@/lib/supabase/queries/articles";

/** Matches the home feed's window; see `app/(site)/page.tsx`. */
export const revalidate = 300;

/**
 * The most recent analysed slugs, for prerendering.
 *
 * Returns [] when the database is unreachable, so a build without credentials
 * still succeeds. Note that `(site)/layout.tsx` renders auth controls that await
 * `auth()`, which makes every route in this group render on demand — so nothing
 * is prerendered today. This stays because it costs one query at build time and
 * takes effect the moment the header's auth state moves client-side.
 */
export async function generateStaticParams() {
  const slugs = await getRecentArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(
  props: PageProps<"/news/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await getArticleBySlug(slug);

  if (!article) return { title: "Article not found — SKEW news" };

  return {
    title: `${article.title} — SKEW news`,
    description: article.analysis.summary[0],
  };
}

export default async function NewsDetailsPage(
  props: PageProps<"/news/[slug]">,
) {
  await auth.protect();

  const { slug } = await props.params;
  // `slug` is only ever a lookup key here — never interpolated into a path,
  // query, or markup (AGENTS.md §21).
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const { analysis } = article;
  const related = await getRelatedArticles(article.id, analysis.embedding);
  return (
    <main className="flex-1 bg-surface">
      <div className="mx-auto max-w-page px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <article className="lg:col-span-8">
            <p className="text-body-sm text-text-secondary">
              {article.category}
              {article.country ? (
                <>
                  {" "}
                  <span aria-hidden>·</span> {article.country}
                </>
              ) : null}
            </p>

            <h1 className="mt-2 text-h1 font-semibold text-text-primary">
              {article.title}
            </h1>

            <ArticleByline
              author={article.author}
              publishedAt={article.publishedAt}
              readingTime={article.readingTime}
              className="mt-4"
            />

            {/*
              No caption or credit: the scraper stores an image URL, not the
              photographer or a caption, and inventing either would be a
              fabrication.
            */}
            <ArticleHero
              category={article.category}
              imageUrl={article.imageUrl}
              className="mt-5"
            />

            <BiasDistributionCard
              bias={analysis.bias}
              confidence={analysis.confidence}
              className="mt-5"
            />

            <div className="mt-6 space-y-6">
              {/*
                Index keys: real article text can repeat a line, so keying by
                content would collide.
              */}
              {article.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-body-lg text-text-primary">
                  {paragraph}
                </p>
              ))}
            </div>

            {related.length > 0 && (
              <RelatedStories stories={related} className="mt-8" />
            )}
          </article>

          {/* Not sticky: the reference gives no evidence for it. */}
          <aside className="space-y-6 lg:col-span-4">
            <BiasAnalysisPanel
              bias={analysis.bias}
              confidence={analysis.confidence}
            />

            <AiSummaryPanel
              summary={analysis.summary}
              generatedAt={analysis.generatedAt}
              readingTime={analysis.readingTime}
              disclaimer={analysis.disclaimer}
            />

            <SourcePanel
              name={article.source.name}
              logoUrl={article.source.logoUrl}
              originalUrl={article.originalUrl}
            />

            {/* Required by AGENTS.md §19, not drawn in the reference. */}
            <FramingDetailsPanel
              biasLabel={analysis.biasLabel}
              sentimentLabel={analysis.sentimentLabel}
              sentimentScore={analysis.sentimentScore}
              confidence={analysis.confidence}
              framingNotes={analysis.framingNotes}
              loadedTerms={analysis.loadedTerms}
            />
          </aside>
        </div>

        <NewsletterCta className="mt-8" />
      </div>
    </main>
  );
}
