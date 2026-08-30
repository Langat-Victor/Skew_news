import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/*
  The `x-SKEW-admin-secret` guard for action routes (AGENTS.md §15).

  Every route that starts or mutates work calls this first. Three cases return
  the SAME opaque 401 — no header, a wrong value, and an unconfigured secret — so
  a caller cannot learn from the response whether the server has a secret set.
  The unconfigured case logs server-side and never falls open.

  The secret is never read from the query string (§15), never echoed in a
  response, and never logged.
*/

const HEADER_NAME = "x-SKEW-admin-secret";

/**
 * `SKEW_ADMIN_SECRET` is canonical and the one to set on Vercel. The hyphenated
 * fallback is the header name reused as a variable name in `.env.local`, which
 * `@next/env`'s dotenv parser accepts (its key class is `[\w.-]+`). Both names
 * resolve to the same single secret, so this widens the *name* surface and never
 * the permission.
 */
function expectedSecret(): string | undefined {
  return process.env.SKEW_ADMIN_SECRET ?? process.env[HEADER_NAME];
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Comparison is constant-time *and* constant-length: `timingSafeEqual` throws on
 * a length mismatch, which would itself leak the secret's length, so both sides
 * are hashed to a fixed 32 bytes first.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * Returns `null` when the request is authorised, or a ready-to-return `401`.
 *
 * Header field names are case-insensitive per RFC 9110 §5.1, and `Headers.get()`
 * implements that — `x-skew-admin-secret` and `X-SKEW-Admin-Secret` both match.
 */
export function checkAdminSecret(request: Request): Response | null {
  const expected = expectedSecret();

  if (!expected) {
    console.error("[api] SKEW_ADMIN_SECRET is not configured; rejecting request");
    return unauthorized();
  }

  const provided = request.headers.get(HEADER_NAME);

  if (!provided || !secretsMatch(provided, expected)) return unauthorized();

  return null;
}
