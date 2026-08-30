# Goal
Implement pgvector support and the related articles feature as defined in AGENTS.md §20.

# Skills Read
- .agents/skills/supabase

# Existing Code Inspected
- `supabase/schema.sql`
- `lib/supabase/types.ts`
- `app/api/analyze/route.ts`
- `lib/pipeline/analyze.ts`
- `lib/supabase/queries/articles.ts`
- `app/(site)/news/[slug]/page.tsx`

# Decisions or Assumptions
- We will add the `vector` extension to `supabase/schema.sql` (if not already there) and add `embedding vector(1536)` to `article_analyses`.
- We will create an IVFFlat cosine index on `embedding` in `article_analyses`.
- We will create a `match_articles` RPC function in `schema.sql` returning `setof public.articles` so that `supabase-js` can seamlessly chain `.select(JOINED_SELECT)`. This gracefully handles ordering by cosine distance.
- The `ArticleAnalysisRow` and `ArticleAnalysisInsert` types will be updated with `embedding?: string` (or `number[]` since standard AI SDK `embed` returns `number[]`, and `supabase-js` accepts either).
- In `lib/pipeline/analyze.ts`, we'll generate embeddings via `embed({ model: openai.embedding("text-embedding-3-small"), value: object.summary })`? Wait, AGENTS.md §20 says: "call OpenAI text-embedding-3-small for each article alongside the existing analysis call and save the result...". We should embed the article raw text or summary? "call OpenAI text-embedding-3-small for each article...". I'll use `article.rawText` or `article.title + '\n' + article.rawText`.
- We will update `getRelatedArticles` in `queries/articles.ts` to take `embedding: number[]` (or string), drop the category fallback, and call the RPC `match_articles`.
- In `news/[slug]/page.tsx`, we pass `analysis.embedding` (if it exists) to `getRelatedArticles`.

# Files Likely to Change
- `supabase/schema.sql`
- `lib/supabase/types.ts`
- `lib/supabase/queries/articles.ts`
- `app/api/analyze/route.ts` (or `lib/pipeline/analyze.ts` where analysis runs)
- `lib/supabase/queries/analyses.ts`
- `app/(site)/news/[slug]/page.tsx`
- `lib/news/types.ts` (add embedding to ArticleDetailView/Analysis)

# Implementation Requirements
1. Enable `pgvector` in `schema.sql` via `create extension if not exists vector;`.
2. Add `embedding vector(1536)` to `article_analyses`.
3. Add an IVFFlat index: `create index if not exists article_analyses_embedding_idx on public.article_analyses using ivfflat (embedding vector_cosine_ops) with (lists = 100);`.
4. Add `match_articles` function to `schema.sql`.
5. Update `lib/supabase/types.ts` to include `embedding?: number[]` in inserts and rows.
6. In `lib/pipeline/analyze.ts`, use `@ai-sdk/openai` to call `embed` with `text-embedding-3-small` for the article's text, and pass it to the db insert.
7. Update `getRelatedArticles` to take `(articleId: string, embedding: number[], limit = 5)` and use `.rpc("match_articles", { query_embedding: embedding, match_article_id: articleId, match_limit: limit })`.
8. Update `app/(site)/news/[slug]/page.tsx` to conditionally call `getRelatedArticles` if `embedding` is not null.

# Security Requirements
- Ensure `match_articles` is `security invoker`.
- Ensure we use `text-embedding-3-small` server-side only.

# Acceptance Criteria
- `pgvector` enabled and index present.
- `article_analyses` rows store the embedding.
- Analysis pipeline handles generating embeddings.
- News details page displays similar articles based on cosine distance.
- Works flawlessly without UI changes to the general details page.

# Checks to Run
- `npm run typecheck`
- `npm run lint`

# Manual Test Steps
1. Apply `supabase/schema.sql` in Supabase SQL Editor.
2. Ensure OPENAI_API_KEY is available.
3. Call `POST /api/analyze` to trigger the pipeline (using `x-SKEW-admin-secret`).
4. Load an article's detail page and verify the related articles rail renders up to 5 similar items.
