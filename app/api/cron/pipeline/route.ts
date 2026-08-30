import { processScheduledResults } from "@/lib/pipeline/process-schedules";
import { runAnalysis } from "@/lib/pipeline/analyze";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  // Protect the route using CRON_SECRET unless in development
  if (process.env.NODE_ENV !== "development") {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let scrapeSummary = null;
  let scrapeError = null;
  try {
    scrapeSummary = await processScheduledResults();
  } catch (error) {
    console.error("[api-cron] step one (scrape) failed:", error);
    scrapeError = error instanceof Error ? error.message : "Unknown scrape error";
  }

  let analyzeSummary = null;
  let analyzeError = null;
  try {
    // Process all pending valid articles
    analyzeSummary = await runAnalysis({});
  } catch (error) {
    console.error("[api-cron] step two (analyze) failed:", error);
    analyzeError = error instanceof Error ? error.message : "Unknown analyze error";
  }

  return Response.json({
    scrape: scrapeSummary || { error: scrapeError },
    analyze: analyzeSummary || { error: analyzeError },
  });
}

