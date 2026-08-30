import { checkAdminSecret } from "@/lib/api/admin-secret";
import { syncSchedules } from "@/lib/pipeline/process-schedules";
import { listSchedules } from "@/lib/oxylabs/client";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient(url, key);
}

export async function GET(request: Request) {
  const unauthorized = checkAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getSupabase();
    const { data: dbSchedules, error } = await supabase.from("oxylabs_schedules").select("*");
    if (error) throw error;
    
    // Check oxylabs schedules too
    const oxylabsIds = await listSchedules();

    return Response.json({
      dbSchedules,
      oxylabsIds,
    });
  } catch (error) {
    console.error("[api] GET /api/oxylabs/schedules failed", error);
    return Response.json({ error: "Failed to list schedules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = checkAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await syncSchedules();
    return Response.json({ status: "completed", ...result });
  } catch (error) {
    console.error("[api] POST /api/oxylabs/schedules failed", error);
    return Response.json({ error: "Failed to sync schedules" }, { status: 500 });
  }
}

