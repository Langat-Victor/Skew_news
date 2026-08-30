import "server-only";

import {
  createSchedule,
  listSchedules,
  deactivateSchedule,
  getScheduleRuns,
  getJobResult
} from "@/lib/oxylabs/client";
import { getActiveSources } from "@/lib/supabase/queries/sources";
import { insertLog } from "@/lib/supabase/queries/logs";
import {
  emptySourceSummary,
  processSource,
  mergeCounts
} from "@/lib/pipeline/scrape";
import { createClient } from "@supabase/supabase-js";
import type { ScrapeSummary, ScrapeSourceSummary } from "@/lib/pipeline/types";

// Requires service role since we are interacting with oxylabs_schedules which is protected by RLS
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

export async function syncSchedules() {
  const supabase = getSupabase();
  const sources = await getActiveSources();
  const cron = "0 0 * * *"; // Daily (midnight)

  // Get active Oxylabs schedules
  const oxylabsIds = await listSchedules();

  const { data: dbSchedules } = await supabase.from("oxylabs_schedules").select("*");
  const dbScheduleMap = new Map(dbSchedules?.map((s) => [s.source_id, s]) || []);

  const keptIds = new Set<string>();

  for (const source of sources) {
    const existing = dbScheduleMap.get(source.id);
    if (existing && existing.is_active && existing.cron === cron) {
      keptIds.add(existing.schedule_id);
      continue;
    }

    // Create or update
    const { scheduleId } = await createSchedule(source.listing_url, cron);
    keptIds.add(scheduleId);

    if (existing) {
      await supabase
        .from("oxylabs_schedules")
        .update({ schedule_id: scheduleId, cron, is_active: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      // Deactivate old one on oxylabs
      if (existing.schedule_id !== scheduleId) {
        await deactivateSchedule(existing.schedule_id).catch(e => console.error(e));
      }
    } else {
      await supabase
        .from("oxylabs_schedules")
        .insert({
          source_id: source.id,
          schedule_id: scheduleId,
          cron,
          is_active: true
        });
    }
  }

  // Deactivate orphan schedules
  for (const id of oxylabsIds) {
    if (!keptIds.has(id)) {
      await deactivateSchedule(id).catch(e => console.error(e));
    }
  }

  // Also update DB for inactive ones
  for (const dbSchedule of dbSchedules || []) {
    if (!keptIds.has(dbSchedule.schedule_id) && dbSchedule.is_active) {
      await supabase
        .from("oxylabs_schedules")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", dbSchedule.id);
    }
  }

  return { synced: sources.length };
}

export async function processScheduledResults(): Promise<ScrapeSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  // 1. Sync schedules first per §18
  await syncSchedules();

  const supabase = getSupabase();
  const sources = await getActiveSources();
  const { data: schedules } = await supabase
    .from("oxylabs_schedules")
    .select("*")
    .eq("is_active", true);
  
  const scheduleMap = new Map(schedules?.map((s) => [s.source_id, s]) || []);

  console.log(`[scrape-cron] started — processing scheduled results for ${sources.length} active source(s)`);
  await insertLog({
    level: "info",
    event: "scrape.started",
    message: `Scheduled scrape processing started for ${sources.length} source(s)`,
    context: { sources: sources.map((s) => s.name) },
  });

  const summaries: ScrapeSourceSummary[] = [];
  const errors: { source: string; message: string }[] = [];

  for (const source of sources) {
    const schedule = scheduleMap.get(source.id);
    if (!schedule) {
      console.warn(`[scrape-cron] No active schedule for ${source.name}`);
      continue;
    }

    const summary = emptySourceSummary(source);

    try {
      const runs = await getScheduleRuns(schedule.schedule_id);
      
      // Find jobs we haven't processed yet.
      // We check db for already processed jobs.
      const { data: processedJobs } = await supabase
        .from("oxylabs_schedule_runs")
        .select("job_id")
        .eq("schedule_id", schedule.schedule_id)
        .not("processed_at", "is", null);
      
      const processedJobIds = new Set(processedJobs?.map((j) => j.job_id) || []);

      const pendingJobs = runs
        .flatMap(r => r.jobs)
        .filter(j => j.resultStatus === "done" && !processedJobIds.has(j.id));
      
      if (pendingJobs.length === 0) {
        console.log(`[scrape-cron] ${source.name}: no new completed jobs`);
        summaries.push(summary);
        continue;
      }

      // Process only the most recent completed job for the homepage
      const job = pendingJobs[0];
      const jobResult = await getJobResult(job.id);

      if (!jobResult.ok) {
        throw new Error(`Failed to fetch job result: ${jobResult.detail}`);
      }

      console.log(`[scrape-cron] ${source.name}: processing job ${job.id}`);
      
      // We pass the limit of 5 (default)
      const processed = await processSource(source, jobResult.html, 5);
      summaries.push(processed);

      // Record job as processed
      await supabase
        .from("oxylabs_schedule_runs")
        .upsert({
          schedule_id: schedule.schedule_id,
          job_id: job.id,
          result_status: "done",
          processed_at: new Date().toISOString(),
          articles_inserted: processed.articlesInserted,
        });

      await insertLog({
        level: processed.articlesFailed > 0 ? "warn" : "info",
        event: "scrape.source.completed",
        message: `${processed.articlesInserted} article(s) inserted from ${source.name} (scheduled)`,
        source_id: source.id,
        context: {
          candidatesFound: processed.candidatesFound,
          candidatesRejected: processed.candidatesRejected,
          duplicatesSkipped: processed.duplicatesSkipped,
          detailPagesScraped: processed.detailPagesScraped,
          articlesInserted: processed.articlesInserted,
          articlesRejected: processed.articlesRejected,
          articlesFailed: processed.articlesFailed,
          attemptCapReached: processed.attemptCapReached,
          rejectionReasons: processed.rejectionReasons,
          jobId: job.id,
        },
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      summary.error = message;
      summaries.push(summary);
      errors.push({ source: source.name, message });

      console.error(`[scrape-cron] ${source.name}: error — ${message}`);
      await insertLog({
        level: "error",
        event: "scrape.source.failed",
        message,
        source_id: source.id,
        context: { isScheduled: true },
      });
    }
  }

  const rejectionReasons: Record<string, number> = {};
  for (const summary of summaries) mergeCounts(rejectionReasons, summary.rejectionReasons);

  const finishedAtMs = Date.now();
  const summary: ScrapeSummary = {
    status: sources.length === 0 ? "failed" : errors.length > 0 ? "completed_with_errors" : "completed",
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    totalDurationMs: finishedAtMs - startedAtMs,
    sourcesChecked: sources.length,
    unknownSources: [],
    perSourceLimit: 5,
    candidatesFound: summaries.reduce((total, item) => total + item.candidatesFound, 0),
    candidatesRejected: summaries.reduce((total, item) => total + item.candidatesRejected, 0),
    duplicatesSkipped: summaries.reduce((total, item) => total + item.duplicatesSkipped, 0),
    detailPagesScraped: summaries.reduce((total, item) => total + item.detailPagesScraped, 0),
    articlesInserted: summaries.reduce((total, item) => total + item.articlesInserted, 0),
    articlesRejected: summaries.reduce((total, item) => total + item.articlesRejected, 0),
    articlesFailed: summaries.reduce((total, item) => total + item.articlesFailed, 0),
    rejectionReasons,
    sources: summaries,
    errors,
  };

  console.log(`[scrape-cron] ${summary.status} in ${summary.totalDurationMs}ms`);
  
  await insertLog({
    level: summary.status === "completed" ? "info" : summary.status === "failed" ? "error" : "warn",
    event: summary.status === "failed" ? "scrape.failed" : "scrape.completed",
    message: `${summary.articlesInserted} article(s) inserted from ${summary.sourcesChecked} source(s) (scheduled)`,
    context: {
      status: summary.status,
      totalDurationMs: summary.totalDurationMs,
      articlesInserted: summary.articlesInserted,
      errors: summary.errors,
    },
  });

  return summary;
}

