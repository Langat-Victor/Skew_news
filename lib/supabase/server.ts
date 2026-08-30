import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/*
  The one place SUPABASE_SERVICE_ROLE_KEY is read (AGENTS.md §21).

  `import "server-only"` above makes importing this module from a "use client"
  file a build error, so the key cannot reach browser code by accident. It is
  never logged and never appears in an error message.

  No @supabase/ssr and no cookie-bound client: this app does not use Supabase
  Auth (§6) — Clerk owns identity, and every database read and write happens on
  the server with the service role.
*/

type ServiceRoleClient = SupabaseClient<Database, "public">;

let client: ServiceRoleClient | undefined;

function required(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }

  return value;
}

/**
 * Lazily-created service-role client, reused across requests.
 *
 * Service role bypasses RLS by design — every table in this schema is
 * default-deny for anon/authenticated, so this is the only key that can read or
 * write. Keep it on the server.
 */
export function getServiceRoleClient(): ServiceRoleClient {
  if (client) return client;

  client = createClient<Database, "public">(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        // No browser session to persist or refresh.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  return client;
}
