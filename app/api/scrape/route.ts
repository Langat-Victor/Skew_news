import { z } from "zod";

import { checkAdminSecret } from "@/lib/api/admin-secret";
import { runScrape } from "@/lib/pipeline/scrape";

/*
  POST /api/scrape — the manual scrape trigger (AGENTS.md §16).

  Thin by design (§5): authorise, validate, delegate, serialise. No parsing, no
  Oxylabs call, and no Supabase query is written here.

  There is no `GET` export. §14 forbids switching scraping between methods, so an
  accidental browser visit gets Next's automatic 405 rather than starting a run.
*/

// Node runtime is required for `node:crypto` and Cheerio.
export const runtime = "nodejs";
// A five-source run makes ~80 Oxylabs calls; locally (`npm run dev`) there is no
// ceiling, which is where §17 says to test.
export const maxDuration = 300;

const requestBody = z
  .object({
    sources: z.array(z.string().min(1)).max(20).optional(),
    perSource: z.number().int().min(1).max(25).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const unauthorized = checkAdminSecret(request);
  if (unauthorized) return unauthorized;

  // An empty body is valid and means "all active sources, default limit" (§16).
  const raw = (await request.text()).trim();
  let parsedJson: unknown = {};

  if (raw.length > 0) {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Request body is not valid JSON" }, { status: 400 });
    }
  }

  const body = requestBody.safeParse(parsedJson);

  if (!body.success) {
    // Issue paths and messages only — the raw input is never echoed back.
    return Response.json(
      {
        error: "Invalid request body",
        issues: body.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const summary = await runScrape({
      sourceNames: body.data.sources,
      perSourceLimit: body.data.perSource,
    });

    return Response.json(summary, { status: summary.status === "failed" ? 500 : 200 });
  } catch (error) {
    // Logged, not returned: an underlying message could name a configuration
    // variable, and the response must never carry credentials (§21).
    console.error("[api] POST /api/scrape failed", error);

    return Response.json({ error: "Scrape failed" }, { status: 500 });
  }
}
