import "server-only";

import { z } from "zod";

/*
  Oxylabs Web Scraper API client — the scraping layer (AGENTS.md §5).

  The one place OXY_WSA_USERNAME and OXY_WSA_PASSWORD are read (§21). The
  `import "server-only"` above makes importing this module from a "use client"
  file a build error, so the credentials cannot reach browser code by accident,
  and nothing here ever puts them in a log line, an error message, or a returned
  `detail` string.

  Realtime, not Push-Pull (decision 4): `POST /v1/queries` against
  `realtime.oxylabs.io` returns the page content in the same response, which is
  what §16's on-demand scrape needs. Push-Pull's callback-and-storage model is
  §18's Scheduler shape, not this one.

  This client never throws for an expected failure (decision 9). Every way a page
  can be lost comes back as a discriminated union so §9's run logging can count
  *why* — an expired credential must never be indistinguishable from "the page
  had no article".
*/

const REALTIME_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";

/** Per the skill: rendered requests need far longer than unrendered ones. */
const RENDERED_TIMEOUT_MS = 180_000;
const UNRENDERED_TIMEOUT_MS = 60_000;

/** Error bodies are echoed back truncated — enough to diagnose, never a dump. */
const MAX_DETAIL_LENGTH = 300;

export type OxylabsFailureReason =
  | "auth"
  | "rate_limited"
  | "oxylabs_error"
  | "bad_envelope"
  | "target_status"
  | "timeout"
  | "network";

export type OxylabsFetchResult =
  | { ok: true; html: string; finalUrl: string; statusCode: number }
  | { ok: false; reason: OxylabsFailureReason; detail: string };

function required(name: "OXY_WSA_USERNAME" | "OXY_WSA_PASSWORD"): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }

  return value;
}

let authorizationHeader: string | undefined;

/** Built once and cached; the plaintext credentials never leave this function. */
function basicAuth(): string {
  if (authorizationHeader) return authorizationHeader;

  const encoded = Buffer.from(
    `${required("OXY_WSA_USERNAME")}:${required("OXY_WSA_PASSWORD")}`,
  ).toString("base64");

  authorizationHeader = `Basic ${encoded}`;

  return authorizationHeader;
}

/**
 * `content` must be a string: `parse: true` is not used, so a structured
 * `content` means the request was not the one this client sent.
 */
const responseEnvelope = z.object({
  results: z
    .array(
      z.object({
        content: z.string(),
        status_code: z.number(),
        url: z.string().optional(),
      }),
    )
    .min(1),
});

function truncate(value: string): string {
  return value.length <= MAX_DETAIL_LENGTH ? value : `${value.slice(0, MAX_DETAIL_LENGTH)}…`;
}

function failure(reason: OxylabsFailureReason, detail: string): OxylabsFetchResult {
  return { ok: false, reason, detail: truncate(detail) };
}

/**
 * Fetches one page's HTML through Oxylabs.
 *
 * `render: true` runs a headless browser (decision 5) — used for source
 * homepages, whose story cards are frequently client-rendered, and skipped for
 * article detail pages, which all five outlets serve server-side. Across a
 * default run that is ~5 rendered calls instead of up to ~80.
 *
 * `geo_location` is pinned so repeat runs see the same edition rather than a
 * rotating regional homepage, and redirects are followed because outlets redirect
 * to canonical article paths.
 */
export async function fetchPageHtml(
  url: string,
  options: { render: boolean },
): Promise<OxylabsFetchResult> {
  const payload: Record<string, unknown> = {
    source: "universal",
    url,
    geo_location: "United States",
    user_agent_type: "desktop_chrome",
    context: [{ key: "follow_redirects", value: true }],
  };

  // Per the skill, `render: ""` is only for *disabling* forced rendering, so the
  // key is omitted entirely rather than sent empty.
  if (options.render) payload.render = "html";

  let response: Response;

  try {
    response = await fetch(REALTIME_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(
        options.render ? RENDERED_TIMEOUT_MS : UNRENDERED_TIMEOUT_MS,
      ),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

    return failure(
      isTimeout ? "timeout" : "network",
      error instanceof Error ? error.message : "Unknown transport error",
    );
  }

  // First status check: Oxylabs' own. Covers auth, quota, and malformed requests.
  if (!response.ok) {
    if (response.status === 401) {
      return failure("auth", "Oxylabs rejected the credentials (HTTP 401)");
    }
    if (response.status === 429) {
      return failure("rate_limited", "Oxylabs rate limit reached (HTTP 429)");
    }

    const body = await response.text().catch(() => "");

    return failure("oxylabs_error", `HTTP ${response.status}: ${body}`);
  }

  let envelope: z.infer<typeof responseEnvelope>;

  try {
    envelope = responseEnvelope.parse(await response.json());
  } catch (error) {
    return failure(
      "bad_envelope",
      error instanceof Error ? error.message : "Unrecognised response shape",
    );
  }

  const [result] = envelope.results;

  // Second status check: the *target page's* status (decision 8). A 200 from
  // Oxylabs wrapping a target 404 is a failure — checking only the outer status
  // would store an error page as an article.
  if (result.status_code !== 200) {
    return failure("target_status", `Target page returned HTTP ${result.status_code}`);
  }

  return {
    ok: true,
    html: result.content,
    finalUrl: result.url ?? url,
    statusCode: result.status_code,
  };
}

const DATA_ENDPOINT = "https://data.oxylabs.io/v1";

export async function createSchedule(url: string, cron: string): Promise<{ scheduleId: string }> {
  const payload = {
    cron,
    items: [
      {
        source: "universal",
        url,
        render: "html",
        geo_location: "United States",
        user_agent_type: "desktop_chrome",
        context: [{ key: "follow_redirects", value: true }]
      }
    ],
    end_time: "2099-12-31 23:59:59"
  };

  const response = await fetch(`${DATA_ENDPOINT}/schedules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to create schedule: ${response.status} ${body}`);
  }

  // Large integer precision extraction
  const rawText = await response.text();
  const match = rawText.match(/"schedule_id":\s*(\d+)/);
  if (!match) throw new Error("Could not extract schedule_id from response");
  
  return { scheduleId: match[1] };
}

export async function listSchedules(): Promise<string[]> {
  const response = await fetch(`${DATA_ENDPOINT}/schedules`, {
    method: "GET",
    headers: {
      Authorization: basicAuth(),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to list schedules: ${response.status} ${body}`);
  }

  const rawText = await response.text();
  // Wait, schedules is an array of IDs in JSON. e.g. {"schedules": [123, 456]}
  // A safer regex for array elements:
  const jsonArrMatch = rawText.match(/"schedules":\s*\[(.*?)\]/s);
  if (!jsonArrMatch) return [];
  const ids = [...jsonArrMatch[1].matchAll(/(\d+)/g)].map(m => m[1]);
  return ids;
}

export async function deactivateSchedule(scheduleId: string): Promise<void> {
  const response = await fetch(`${DATA_ENDPOINT}/schedules/${scheduleId}/state`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify({ active: false }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to deactivate schedule ${scheduleId}: ${response.status} ${body}`);
  }
}

export interface OxylabsRun {
  runId: string;
  jobs: { id: string; resultStatus: string }[];
}

export async function getScheduleRuns(scheduleId: string): Promise<OxylabsRun[]> {
  const response = await fetch(`${DATA_ENDPOINT}/schedules/${scheduleId}/runs`, {
    method: "GET",
    headers: {
      Authorization: basicAuth(),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to fetch runs for schedule ${scheduleId}: ${response.status} ${body}`);
  }

  const rawText = await response.text();
  
  // We need to carefully parse out runs and job IDs since they are bigints.
  // Using a regex to pre-process bigints to strings before JSON.parse
  const safeJson = rawText
    .replace(/"run_id":\s*(\d+)/g, '"run_id":"$1"')
    .replace(/"id":\s*(\d+)/g, '"id":"$1"');

  const parsed = JSON.parse(safeJson);
  if (!parsed.runs) return [];

  return parsed.runs.map((r: { run_id: string; jobs?: { id: string; result_status: string }[] }) => ({
    runId: r.run_id,
    jobs: (r.jobs || []).map((j: { id: string; result_status: string }) => ({
      id: j.id,
      resultStatus: j.result_status
    }))
  }));
}

export async function getJobResult(jobId: string): Promise<OxylabsFetchResult> {
  const response = await fetch(`${DATA_ENDPOINT}/queries/${jobId}/results`, {
    method: "GET",
    headers: {
      Authorization: basicAuth(),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return failure("oxylabs_error", `Failed to get job result: ${response.status} ${body}`);
  }

  let envelope: z.infer<typeof responseEnvelope>;
  try {
    envelope = responseEnvelope.parse(await response.json());
  } catch (error) {
    return failure("bad_envelope", error instanceof Error ? error.message : "Unrecognised response shape");
  }

  const [result] = envelope.results;

  if (result.status_code !== 200) {
    return failure("target_status", `Target page returned HTTP ${result.status_code}`);
  }

  return {
    ok: true,
    html: result.content,
    finalUrl: result.url ?? "",
    statusCode: result.status_code,
  };
}
