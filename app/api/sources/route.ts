import { getActiveSources } from "@/lib/supabase/queries/sources";

/*
  GET /api/sources — the active source names (AGENTS.md §14).

  §8's workflow starts by showing which sources are available, and this is that
  read. No admin secret: §15 guards routes that start or mutate work, and this
  one only reads.

  It returns `name`, `listingUrl`, and `logoUrl` — no ids and no
  `parser_strategy`, so nothing here helps anyone probe the pipeline.
*/

// A source toggled active in Supabase must show up immediately; GET handlers are
// otherwise cacheable.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sources = await getActiveSources();

    return Response.json({
      sources: sources.map((source) => ({
        name: source.name,
        listingUrl: source.listing_url,
        logoUrl: source.logo_url,
      })),
      count: sources.length,
    });
  } catch (error) {
    console.error("[api] GET /api/sources failed", error);

    return Response.json({ error: "Could not load sources" }, { status: 500 });
  }
}
