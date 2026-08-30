import "server-only";

import { cache } from "react";
import { getServiceRoleClient } from "@/lib/supabase/server";
import type { SourceRow } from "@/lib/supabase/types";

/*
  Source reads. Server-only.

  AGENTS.md §7/§8: scraping loads its sources from this table and nowhere else —
  no source URL may be hardcoded in scraping logic — and only active sources are
  ever scraped or scheduled.
*/

function logQueryError(where: string, error: { code?: string; message: string }) {
  console.error(
    `[supabase] ${where} failed${error.code ? ` (${error.code})` : ""}: ${error.message}`,
  );
}

/** Every active source, alphabetically. The default scrape set (§8). */
export const getActiveSources = cache(async (): Promise<SourceRow[]> => {
  const { data, error } = await getServiceRoleClient()
    .from("sources")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    logQueryError("getActiveSources", error);
    return [];
  }

  return data ?? [];
});

/**
 * Active sources by name, for §8's "scrape these three" selection. Unknown names
 * are simply absent from the result — the caller reports what it could not find
 * rather than inventing a source.
 */
export async function getSourcesByNames(names: string[]): Promise<SourceRow[]> {
  if (names.length === 0) return [];

  const { data, error } = await getServiceRoleClient()
    .from("sources")
    .select("*")
    .eq("is_active", true)
    .in("name", names)
    .order("name", { ascending: true });

  if (error) {
    logQueryError("getSourcesByNames", error);
    return [];
  }

  return data ?? [];
}
