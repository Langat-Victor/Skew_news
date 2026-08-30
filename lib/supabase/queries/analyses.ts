import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { ArticleAnalysisInsert } from "@/lib/supabase/types";
import { insertLog } from "@/lib/supabase/queries/logs";

export async function insertAnalysisAndUpdateArticle(
  analysis: ArticleAnalysisInsert,
  analyzedAt: string
): Promise<{ success: boolean; error: string | null }> {
  const client = getServiceRoleClient();
  
  // Save analysis
  const { error: insertError } = await client
    .from("article_analyses")
    .insert(analysis);

  if (insertError) {
    console.error(`[supabase] Failed to insert analysis for article ${analysis.article_id}:`, insertError);
    return { success: false, error: `insert failed: ${insertError.code ?? "unknown"} - ${insertError.message}` };
  }

  // Update article analyzed_at
  const { error: updateError } = await client
    .from("articles")
    .update({ analyzed_at: analyzedAt })
    .eq("id", analysis.article_id);

  if (updateError) {
    console.error(`[supabase] Failed to update analyzed_at for article ${analysis.article_id}:`, updateError);
    // If update fails, log but the analysis is already there. The view logic relies on analysis row.
    await insertLog({
      level: "error",
      event: "analysis.update_article_failed",
      message: `Failed to update analyzed_at for article ${analysis.article_id}`,
      article_id: analysis.article_id,
      context: { error: updateError },
    });
    return { success: false, error: `update failed: ${updateError.code ?? "unknown"} - ${updateError.message}` };
  }

  return { success: true, error: null };
}

