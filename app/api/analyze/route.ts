import { z } from "zod";

import { checkAdminSecret } from "@/lib/api/admin-secret";
import { runAnalysis } from "@/lib/pipeline/analyze";

/*
  POST /api/analyze — the manual AI analysis trigger (AGENTS.md §19).
*/

// Node runtime is required for node:crypto and likely AI SDK's needs
export const runtime = "nodejs";
export const maxDuration = 300;

const requestBody = z
  .object({
    limit: z.number().int().min(1).optional(),
    articleIds: z.array(z.string()).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const unauthorized = checkAdminSecret(request);
  if (unauthorized) return unauthorized;

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
    const summary = await runAnalysis({
      limit: body.data.limit,
      articleIds: body.data.articleIds,
    });

    return Response.json(summary, { status: summary.status === "failed" ? 500 : 200 });
  } catch (error) {
    console.error("[api] POST /api/analyze failed", error);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}

