# AI Analysis Pipeline Implementation Prompt

## Goal
Implement the AI analysis pipeline as described in `AGENTS.md` section 19, which processes valid unanalyzed articles, uses the Vercel AI SDK and OpenAI provider to generate neutral summaries, sentiment, and AI-estimated political framing, validates the output with Zod, and saves it to the `article_analyses` Supabase table.

## Skills Read
- `.agents/skills/supabase` (for secure server-side client, schema interaction, and best practices)
- `.agents/skills/ai-sdk` (for Vercel AI SDK usage, `generateObject`, OpenAI provider setup, and type-safety)

## Existing Code Inspected
- `AGENTS.md` section 19 and 21
- `lib/api/admin-secret.ts` (for the `x-SKEW-admin-secret` check)
- `lib/supabase/types.ts` (for `ArticleAnalysisInsert`, `ArticlePendingAnalysisRow`, etc.)
- `lib/supabase/queries/articles.ts` (for `getPendingAnalysisArticles`)
- `package.json` (Zod is installed, need to install `ai` and `@ai-sdk/openai`)

## Decisions or Assumptions
- Will use `generateObject` from the AI SDK with Zod schema for structured output to ensure the result exactly matches `ArticleAnalysisInsert` requirements.
- Will create a new `lib/pipeline/analyze.ts` (similar to `scrape.ts`) to handle the batching, iteration, and logging of the analysis pipeline.
- Will create a `POST /api/analyze` route that uses `checkAdminSecret` before running the pipeline.
- `ANALYSIS_BATCH_SIZE` env var will be used with a default of 5 as per `.env.example` mentioned in `AGENTS.md`.
- Articles will be processed until there are no pending articles left.
- We will insert `article_analyses` and then update the `articles.analyzed_at` column in a single transaction (or sequentially using the service role).

## Files Likely to Change
- `package.json` (to add `ai` and `@ai-sdk/openai` packages)
- `app/api/analyze/route.ts` (New file for the endpoint)
- `lib/pipeline/analyze.ts` (New file for orchestration)
- `lib/supabase/queries/analyses.ts` (New file for inserting analyses and updating `analyzed_at`)

## Implementation Requirements
1. **API Route**: Create `POST /api/analyze`. Must require the `x-SKEW-admin-secret` header.
2. **Pending Check**: Use `getPendingAnalysisArticles` which left-joins `article_analyses` to find articles missing analysis.
3. **Batching**: Process in configurable batches (default 5, via `ANALYSIS_BATCH_SIZE`), looping until no pending articles remain.
4. **AI Generation**: Use `generateObject` from the Vercel AI SDK with the OpenAI provider (`openai('gpt-4o-mini')` or latest).
5. **Validation**: Use Zod to ensure the AI output includes all required fields (`summary`, `sentiment_score`, `sentiment_label`, `left_percentage`, `center_percentage`, `right_percentage`, `bias_label`, `confidence`, `framing_notes`, `loaded_terms`, `disclaimer`).
6. **Data Storage**: Save valid analyses to `article_analyses` and mark `analyzed_at` on the `articles` table *only* after a successful save.
7. **Logging**: Log progress in the server console during the run and return a final summary object.

## Security Requirements
- The `POST /api/analyze` route MUST use `checkAdminSecret(request)` and reject unauthorized requests.
- Never expose the OpenAI API key to the client. The analysis runs completely server-side.
- The `service_role` client must be used to perform pipeline reads and writes (as it bypasses RLS for backend tasks).

## Acceptance Criteria
- Calling `POST /api/analyze` with the correct admin secret starts processing unanalyzed articles.
- Analysis objects are accurately shaped according to `ArticleAnalysisInsert`.
- `bias_score` is NOT provided in the insert (the database computes it).
- The three percentages (left, center, right) must sum to 100.
- `analyzed_at` is only updated after a valid analysis is stored.

## Checks to Run
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Exact Manual Test Steps Expected After Implementation
1. Add `OPENAI_API_KEY` and `SKEW_ADMIN_SECRET` to `.env.local` if not already present.
2. Run `npm install` (since new packages were added).
3. Start the server with `npm run dev`.
4. Trigger the pipeline manually via curl:
   ```bash
   curl -X POST http://localhost:3000/api/analyze \
     -H "x-SKEW-admin-secret: your-secret-here"
   ```
5. Watch the Next.js dev server terminal for the console logging progress.
6. Verify in the Supabase dashboard that `article_analyses` has new rows and the corresponding `articles` have `analyzed_at` populated.

