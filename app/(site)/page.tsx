import { TopicRail } from "@/components/layout/topic-rail";
import { NewsCard } from "@/components/ui/news-card";
import { getPublishedArticles } from "@/lib/supabase/queries/articles";

/*
  Stored data only (AGENTS.md §5): this page reads analysed articles and never
  scrapes, analyses, or mutates pipeline state. `getPublishedArticles` is
  server-only, so nothing here can leak the service-role key to the browser.

  The topic rail renders here rather than in `(site)/layout.tsx` so it stays a
  home-page affordance and does not appear above article pages.
*/

/**
 * Re-read at most every 5 minutes. The pipeline inserts hourly, so a fresh query
 * per visitor would buy nothing. `cacheComponents` is off, so this is the
 * route-level revalidate.
 *
 * It has no effect while `(site)/layout.tsx` renders auth controls that await
 * `auth()` — that makes every route in this group render on demand. Kept so the
 * intended window is recorded and applies as soon as it can.
 */
export const revalidate = 300;

export default async function Home(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const topic = typeof searchParams.topic === "string" ? searchParams.topic : undefined;

  const articles = await getPublishedArticles(24, topic);

  return (
    <>
      <TopicRail currentTopic={topic} />

      <main className="flex-1 bg-surface">
        <div className="mx-auto max-w-page px-6 py-8">
          <h1 className="text-h2 font-semibold text-text-primary">Top News</h1>

          {articles.length === 0 ? (
            <div className="mt-6 rounded-lg border border-border bg-bg-primary px-6 py-16 text-center">
              <p className="text-h3 font-semibold text-text-primary">
                No articles yet
              </p>
              <p className="mx-auto mt-2 max-w-prose text-body-md text-text-secondary">
                Stories appear here once they have been collected and analysed.
                Nothing has finished analysis so far.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <NewsCard
                  key={article.slug}
                  id={article.slug}
                  title={article.title}
                  category={article.category}
                  country={article.country}
                  imageUrl={article.imageUrl}
                  bias={article.bias}
                  biasLabel={article.biasLabel}
                  sourceName={article.sourceName}
                  publishedAt={article.publishedAt}
                  sentimentLabel={article.sentimentLabel}
                  confidence={article.confidence}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
