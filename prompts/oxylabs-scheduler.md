# Goal
Implement the Oxylabs Scheduler with Vercel Cron for automatic hourly processing, satisfying all requirements in `AGENTS.md` sections 9 and 18.

# Skills Read
- `@.agents/skills/web-scraper-api/SKILL.md` (and fetched live scheduler docs)
- `@.agents/skills/supabase/SKILL.md`

# Existing Code Inspected
- `app/api/scrape/route.ts` - manual scrape endpoint pattern.
- `lib/pipeline/scrape.ts` - pipeline logic we need to reuse/adapt.
- `lib/oxylabs/client.ts` - basic auth and fetch patterns.
- `supabase/schema.sql` - schema for `oxylabs_schedules` and `oxylabs_schedule_runs`.

# Decisions or Assumptions
1. **End time**: Scheduler API requires `end_time`. We'll set a far-future date (e.g., `"2099-12-31 23:59:59"`).
2. **Cron**: Scraper should run hourly. We will use cron `"0 * * * *"` (top of the hour).
3. **Pipeline reuse**: We'll export `processSource` and helper functions out of `lib/pipeline/scrape.ts` so `lib/pipeline/process-schedules.ts` can use them.
4. **HTML fetching**: Job results will be fetched from `https://data.oxylabs.io/v1/queries/{job_id}/results` using `content_encoding: "base64"` or just normal decoding. Wait, data API returns `results` with `content`.

# Files Likely to Change
1. `lib/oxylabs/client.ts` (add functions for `syncSchedules`, `getSchedules`, `getRuns`, `getJobResult`)
2. `lib/pipeline/scrape.ts` (export `processSource`, `emptySourceSummary`, `mergeCounts`, `tally`)
3. `lib/pipeline/process-schedules.ts` (new file with the scheduled result processing logic)
4. `app/api/oxylabs/schedules/route.ts` (new POST/GET routes)
5. `app/api/oxylabs/scheduled-results/process/route.ts` (new POST route)
6. `app/api/cron/pipeline/route.ts` (new GET route for Vercel Cron)
7. `vercel.json` (add Vercel cron config)

# Implementation Requirements
- **Sync schedules route (`POST /api/oxylabs/schedules`)**: 
  - Creates one Oxylabs schedule per active source in Supabase.
  - Updates `oxylabs_schedules`.
  - Deactivates orphan schedules in Oxylabs using `PUT /v1/schedules/{id}/state`.
- **List schedules route (`GET /api/oxylabs/schedules`)**: 
  - Reads stored schedule rows.
- **Process scheduled results (`POST /api/oxylabs/scheduled-results/process`)**:
  - Requires `x-SKEW-admin-secret`.
  - Syncs/updates schedules from active source homepages before processing.
  - Fetches completed Oxylabs job HTML via `/runs` -> `jobs` -> `result_status === 'done'`.
  - Uses exact same validation, cleanup, dedupe, existence check, and run logging as manual scraping.
- **Vercel Cron Config**:
  - Calls `/api/cron/pipeline` at :15 past every hour.
- **Cron pipeline route (`GET /api/cron/pipeline`)**:
  - Protected by `CRON_SECRET` header (skip check in dev).
  - Chain 1: process scheduled results.
  - Chain 2: run AI analysis on pending articles.
- **Large integer precision**: Read IDs from raw HTTP response text before `JSON.parse`.

# Security Requirements
- `x-SKEW-admin-secret` required on all action POST routes.
- `CRON_SECRET` required on `GET /api/cron/pipeline` (except local dev).
- Do not expose credentials.

# Acceptance Criteria
- Oxylabs schedules can be synced and orphaned ones deactivated.
- Oxylabs job runs can be processed manually and via cron.
- Cron pipeline automatically processes schedules then runs AI analysis.
- Pipeline logging is consistent with manual scraping.
- `schedule_id` and `job_id` are stored accurately as text.

# Checks to Run
- `npm run lint` and `npm run build` after changes.

# Exact Manual Test Steps
1. Sync schedules: `curl -X POST http://localhost:3000/api/oxylabs/schedules -H "x-SKEW-admin-secret: <your-secret>"`
2. List schedules: `curl http://localhost:3000/api/oxylabs/schedules -H "x-SKEW-admin-secret: <your-secret>"`
3. Process manually: `curl -X POST http://localhost:3000/api/oxylabs/scheduled-results/process -H "x-SKEW-admin-secret: <your-secret>"`
4. Test cron pipeline: `curl http://localhost:3000/api/cron/pipeline` (no secret needed in local dev). Watch terminal for logs.

