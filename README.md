# tripplanner

A small trip planner for Cloudflare Pages: browse trips from a landing page, drill
into a single day to inspect its GPX track, and leave comments and notes that are
stored in Cloudflare D1 so they can be processed by an LLM later.

- **Frontend** — React + TypeScript, built by Vite, served as static assets by Pages.
- **API** — Cloudflare Pages Functions under `functions/api/`.
- **Storage** — Cloudflare D1 (SQLite), included in the $5/month Workers Paid plan.
- **Maps** — Leaflet with OpenStreetMap tiles; no API key or account required.

## How it fits together

```
/                              landing page, one card per trip
/trips/:tripId                 whole route on one map, per-day breakdown, trip comments
/trips/:tripId/days/:dayId     one day: stats, map, elevation profile, day comments

GET  /api/comments?tripId=&dayId=&scope=     read comments
POST /api/comments                           write a comment or note
GET  /api/export?since=&tripId=&unprocessed= bulk dump for LLM processing
```

GPX files are committed to the repo under `public/gpx/<tripId>/<dayId>.gpx` and
served as static assets. They are parsed in the browser — distance, ascent,
descent, high/low point, elapsed and moving time are all derived from the file
rather than stored anywhere, so replacing a GPX file is enough to update the
numbers.

## Adding a trip

1. Drop the GPX files in `public/gpx/<tripId>/`, one per day.
2. Add an entry to `src/data/trips.json`:

```jsonc
{
  "id": "my-trip",             // used in URLs and as the comment key — keep it stable
  "title": "My Trip",
  "region": "Somewhere",
  "status": "planned",         // "idea" | "planned" | "completed"
  "startDate": "2026-09-05",
  "endDate": "2026-09-08",
  "summary": "…",
  "days": [
    {
      "id": "day-1",           // also a comment key — keep it stable
      "date": "2026-09-05",
      "title": "A → B",
      "summary": "…",
      "gpx": "/gpx/my-trip/day-1.gpx",
      "stayingAt": "…",        // optional
      "highlights": ["…"]      // optional
    }
  ]
}
```

Any GPX 1.1 file with `<trkpt>` elements works. `<ele>` and `<time>` are optional —
the stats that depend on them are shown as `—` when missing. Files that only carry
a route (`<rtept>`) are handled too.

The two sample trips ship with generated tracks; `npm run gpx:sample` regenerates
them from `scripts/generate-sample-gpx.mjs`. Delete both trips and their GPX
directories once you have real ones.

## First-time Cloudflare setup

You need a Workers Paid ($5/mo) account for D1 writes at any real volume; the free
tier also works for small numbers of rows.

**1. Create the database**

```bash
npm install
npx wrangler login
npx wrangler d1 create tripplanner
```

Copy the `database_id` it prints into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

**2. Create the table**

```bash
npm run db:migrate:remote     # applies migrations/ to the live database
```

**3. Create the Pages project and deploy**

Either connect the GitHub repo in the Cloudflare dashboard
(*Workers & Pages → Create → Pages → Connect to Git*) with:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 or newer |

…or deploy straight from your machine:

```bash
npm run build
npx wrangler pages deploy dist
```

**4. Bind the database to the Pages project**

In the dashboard: *your Pages project → Settings → Bindings → D1 database*, with
variable name **`DB`** and the `tripplanner` database. Add it to both the
production and preview environments. Redeploy once after adding the binding —
Functions only pick up new bindings on a fresh deployment.

Without this binding every `/api/*` request fails; the UI will show
"Could not load comments".

## Local development

Two terminals:

```bash
npm run db:migrate:local   # once, creates the local SQLite copy under .wrangler/
npm run build
npx wrangler pages dev dist --port 8788   # API + built site on :8788
```

```bash
npm run dev                # Vite with HMR on :5173, proxying /api to :8788
```

Use `:5173` while working on the UI and `:8788` to check the real Pages behaviour.

Handy while debugging:

```bash
npx wrangler d1 execute tripplanner --local --command "SELECT * FROM comments"
npx wrangler d1 execute tripplanner --remote --command "SELECT COUNT(*) FROM comments"
```

## Comments and notes

Anyone can post — there is no auth yet. Each entry is either a **comment** (a
remark on the plan) or a **note** (something to remember), and is attached to a
trip or to one specific day.

The `comments` table already carries the columns the next two steps need, so
neither requires a migration:

- `user_id` / `user_email` — to be filled in once Google auth is added. The
  planned shape is Cloudflare Access in front of the Pages project, with the
  Function reading the verified identity from the `Cf-Access-Jwt-Assertion`
  header instead of trusting anything from the client.
- `metadata`, `llm_processed_at`, `llm_result` — for an LLM pass to write back
  summaries, sentiment, extracted action items, or whatever else, keyed by
  comment `id`.

`GET /api/export` is the read side of that pipeline:

```bash
curl "https://<your-project>.pages.dev/api/export?unprocessed=1&limit=200"
```

It returns every column, including the LLM fields, as JSON. Set an `EXPORT_TOKEN`
secret to require `Authorization: Bearer <token>` on that endpoint:

```bash
npx wrangler pages secret put EXPORT_TOKEN
```

Until you do, the export is world-readable — the same as the comments themselves.

## Known limits

- No auth and no rate limiting on `POST /api/comments`. Fine for a private link,
  not for a URL you post publicly. Cloudflare's WAF rate-limiting rules are the
  cheapest stopgap before Google auth lands.
- Comments cannot be edited or deleted from the UI; use `wrangler d1 execute`.
- Whole GPX files are parsed in the browser. Tracks of a few thousand points are
  fine; a 100k-point file would need simplification before rendering.
