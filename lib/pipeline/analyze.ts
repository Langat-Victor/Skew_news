import "server-only";

import { generateObject, embed } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getPendingAnalysisArticles } from "@/lib/supabase/queries/articles";
import { insertAnalysisAndUpdateArticle } from "@/lib/supabase/queries/analyses";
import { insertLog } from "@/lib/supabase/queries/logs";
import type { ArticleAnalysisInsert } from "@/lib/supabase/types";

export type AnalyzeInput = {
  limit?: number;
  articleIds?: string[];
};

export type AnalyzeSummary = {
  status: "completed" | "completed_with_errors" | "failed";
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  articlesProcessed: number;
  articlesAnalyzed: number;
  articlesFailed: number;
  articlesSkipped: number;
  errors: { articleId: string; message: string }[];
};

const analysisSchema = z.object({
  summary: z.string().describe("A neutral, objective summary of the article."),
  sentiment_score: z.number().min(-1).max(1).describe("Sentiment score from -1 (most negative) to 1 (most positive)."),
  sentiment_label: z.enum(["positive", "neutral", "negative"]).describe("Overall sentiment of the article."),
  left_percentage: z.number().min(0).max(100).describe("Percentage of left-leaning framing."),
  center_percentage: z.number().min(0).max(100).describe("Percentage of centrist framing."),
  right_percentage: z.number().min(0).max(100).describe("Percentage of right-leaning framing."),
  bias_label: z.enum(["left", "center", "right", "mixed", "unclear"]).describe("AI-estimated political framing label."),
  confidence: z.number().min(0).max(1).describe("Confidence in the analysis (0 to 1)."),
  framing_notes: z.string().describe("Notes on the framing, tone, and presentation of the article."),
  loaded_terms: z.array(z.string()).describe("List of loaded or emotionally charged terms used in the article."),
  disclaimer: z.string().describe("A disclaimer about the limitations of AI analysis."),
}).refine(data => {
  const sum = data.left_percentage + data.center_percentage + data.right_percentage;
  return Math.abs(sum - 100) < 0.1; // Allow small float drift but should sum to 100
}, {
  message: "Percentages must sum to 100",
});

export async function runAnalysis(input: AnalyzeInput = {}): Promise<AnalyzeSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  // Load from env, default 5
  const batchSize = parseInt(process.env.ANALYSIS_BATCH_SIZE ?? "5", 10);
  
  // Total limit if user requested, otherwise 0 for unlimited (run until no pending)
  const totalLimit = input.limit ?? 0;

  console.log(`[analyze] started — batch size: ${batchSize}, total limit: ${totalLimit > 0 ? totalLimit : "unlimited"}`);

  await insertLog({
    level: "info",
    event: "analyze.started",
    message: `Analysis run started`,
    context: { limit: input.limit, articleIds: input.articleIds },
  });

  const summary: AnalyzeSummary = {
    status: "completed",
    startedAt,
    finishedAt: "",
    totalDurationMs: 0,
    articlesProcessed: 0,
    articlesAnalyzed: 0,
    articlesFailed: 0,
    articlesSkipped: 0,
    errors: [],
  };

  const model = google("gemini-3.6-flash");
  const modelName = "gemini-3.6-flash";

  let hasMore = true;

  while (hasMore) {
    const fetchLimit = totalLimit > 0 ? Math.min(batchSize, totalLimit - summary.articlesProcessed) : batchSize;
    if (fetchLimit <= 0) break;

    const pendingArticles = await getPendingAnalysisArticles(fetchLimit);
    
    // Filter by articleIds if provided
    const articlesToProcess = input.articleIds && input.articleIds.length > 0
      ? pendingArticles.filter(a => input.articleIds!.includes(a.id))
      : pendingArticles;

    if (articlesToProcess.length === 0) {
      console.log(`[analyze] no more pending articles found`);
      hasMore = false;
      // If we filtered out all remaining fetched articles, and we are not limited by input.articleIds, we should stop
      if (!input.articleIds || input.articleIds.length === 0) break;
    }

    if (articlesToProcess.length > 0) {
      console.log(`[analyze] processing batch of ${articlesToProcess.length} articles`);
    }

    let batchAnalyzed = 0;

    for (const article of articlesToProcess) {
      summary.articlesProcessed += 1;
      console.log(`[analyze] analyzing article ${article.id} ("${article.title}")`);

      try {
        const prompt = `Analyze the following news article. Provide a neutral summary, sentiment score, framing percentages, and loaded terms according to the output schema.
        
Article Title: ${article.title}
Article Source: ${article.sourceName ?? "Unknown"}
Article Content:
${article.rawText}`;

        const { object } = await generateObject({
          model,
          schema: analysisSchema,
          prompt,
          maxRetries: 1, // Will retry once if schema validation fails
        });

        // Map to insert object
        const insertData: ArticleAnalysisInsert = {
          article_id: article.id,
          summary: object.summary,
          sentiment_score: object.sentiment_score,
          sentiment_label: object.sentiment_label,
          left_percentage: object.left_percentage,
          center_percentage: object.center_percentage,
          right_percentage: object.right_percentage,
          bias_label: object.bias_label,
          confidence: object.confidence,
          framing_notes: object.framing_notes,
          loaded_terms: object.loaded_terms,
          disclaimer: object.disclaimer,
          model: modelName,
        };

        let { embedding } = await embed({
          model: google.textEmbeddingModel("gemini-embedding-001"),
          value: article.rawText,
        });

        // The model outputs 3072 dimensions, but the database is configured for 768.
        // Thanks to Matryoshka Representation Learning, we can simply slice the array.
        if (embedding.length > 768) {
          embedding = embedding.slice(0, 768);
        }

        insertData.embedding = embedding;

        const analyzedAt = new Date().toISOString();
        const { success, error } = await insertAnalysisAndUpdateArticle(insertData, analyzedAt);

        if (success) {
          summary.articlesAnalyzed += 1;
          batchAnalyzed += 1;
          console.log(`[analyze] saved analysis for article ${article.id}`);
        } else {
          summary.articlesFailed += 1;
          summary.errors.push({ articleId: article.id, message: error ?? "Unknown db error" });
          console.error(`[analyze] failed to save analysis for article ${article.id}: ${error}`);
        }
      } catch (e: unknown) {
        summary.articlesFailed += 1;
        const errMsg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ articleId: article.id, message: errMsg });
        console.error(`[analyze] analysis failed for article ${article.id}: ${errMsg}`);
      }
    }

    if (batchAnalyzed === 0 && articlesToProcess.length > 0) {
      console.error(`[analyze] Entire batch failed to process (0 successes). Stopping to prevent infinite loop.`);
      break;
    }

    // Check if we've hit our limit
    if (totalLimit > 0 && summary.articlesProcessed >= totalLimit) {
      hasMore = false;
    }
  }

  const finishedAtMs = Date.now();
  summary.finishedAt = new Date(finishedAtMs).toISOString();
  summary.totalDurationMs = finishedAtMs - startedAtMs;

  if (summary.articlesFailed > 0) {
    summary.status = summary.articlesAnalyzed > 0 ? "completed_with_errors" : "failed";
  }

  console.log(`[analyze] ${summary.status} in ${summary.totalDurationMs}ms`);
  console.log("[analyze] summary", summary);

  await insertLog({
    level: summary.status === "completed" ? "info" : summary.status === "failed" ? "error" : "warn",
    event: summary.status === "failed" ? "analyze.failed" : "analyze.completed",
    message: `${summary.articlesAnalyzed} article(s) analyzed`,
    context: {
      status: summary.status,
      totalDurationMs: summary.totalDurationMs,
      articlesProcessed: summary.articlesProcessed,
      articlesAnalyzed: summary.articlesAnalyzed,
      articlesFailed: summary.articlesFailed,
      articlesSkipped: summary.articlesSkipped,
      errors: summary.errors,
    },
  });

  return summary;
}
