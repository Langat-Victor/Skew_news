import "server-only";

import { getServiceRoleClient } from "@/lib/supabase/server";
import type { LogInsert, LogRow } from "@/lib/supabase/types";

/*
  Pipeline log persistence (AGENTS.md §9 run logging, §16). Server-only.

  These rows are the durable record behind `GET /api/logs`; the neat per-run
  console output §9 asks for is emitted by the pipeline itself, not here.
*/

/** Newest-first page size for the logs route. */
const DEFAULT_LOG_LIMIT = 100;

/**
 * Append one log row. Never throws and never rejects: a logging failure must not
 * take down the scrape or analysis run it was describing.
 */
export async function insertLog(entry: LogInsert): Promise<void> {
  const { error } = await getServiceRoleClient().from("logs").insert(entry);

  if (error) {
    console.error(
      `[supabase] insertLog failed${error.code ? ` (${error.code})` : ""}: ${error.message}`,
    );
  }
}

/** Most recent log rows, newest first. */
export async function getRecentLogs(
  limit: number = DEFAULT_LOG_LIMIT,
): Promise<LogRow[]> {
  const { data, error } = await getServiceRoleClient()
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(
      `[supabase] getRecentLogs failed${error.code ? ` (${error.code})` : ""}: ${error.message}`,
    );
    return [];
  }

  return data ?? [];
}
