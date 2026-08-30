import { checkAdminSecret } from "@/lib/api/admin-secret";
import { processScheduledResults } from "@/lib/pipeline/process-schedules";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const unauthorized = checkAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const summary = await processScheduledResults();
    return Response.json(summary, { status: summary.status === "failed" ? 500 : 200 });
  } catch (error) {
    console.error("[api] POST /api/oxylabs/scheduled-results/process failed", error);
    return Response.json({ error: "Process failed" }, { status: 500 });
  }
}

