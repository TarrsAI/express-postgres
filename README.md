# Express + Postgres API starter

A Tarrs-ready Node + Express + TypeScript backend with its own
Postgres (no Supabase). Auth is cookie-based (httpOnly JWT signed
locally), and every request goes through CORS allow-listing + helmet
+ rate-limited login. Pair it with `nextjs-standalone` (or any
frontend) by setting the frontend's `NEXT_PUBLIC_API_URL` to this
service's URL.

## What's included

- Express 4 + TypeScript (`tsx watch` in dev, compiled to `.dist` in prod)
- Postgres via `pg` + Drizzle ORM (typed schema, generated migrations)
- Bcrypt password hashing (cost 10)
- httpOnly cookie sessions signed with `JWT_SECRET` via `jose`
- Helmet + CORS allowlist + cookie-parser
- Per-IP rate limit on `/auth/register` + `/auth/login`
- Pino structured logging (pino-pretty in dev)
- Zod input validation
- Sample `/api/posts` resource: GET list + POST create + DELETE author-only
- Author-only deletes return 404 on cross-author access (no row-existence leak)

## How Tarrs uses this

Tarrs auto-injects:

- `DATABASE_URL` — points at the local Postgres sidecar inside the sandbox
- `JWT_SECRET` — generated per-project, stored in Sandbox Secrets

Sandbox runs on port 3000 (default Tarrs ALB target). Public URL is
`<project-slug>.dev.tarrs.io`; Caddy in the sandbox routes `/api/*`
straight at this container.

## Cookie + CORS recipe (frontend on a different domain)

The default `COOKIE_SAMESITE=lax` works when the frontend and API live
on the same eTLD+1 (e.g. both under `*.example.com`). For a frontend
on Vercel calling this API on `*.dev.tarrs.io`:

```
COOKIE_SAMESITE=none      # required for cross-site cookie
CORS_ORIGINS=https://your-frontend.vercel.app
```

`sameSite=none` automatically forces `secure=true` (browser
requirement); never serve `none` over plain http.

## Local dev

```bash
pnpm install
cp .env.example .env
# fill DATABASE_URL + JWT_SECRET
pnpm db:migrate    # apply drizzle/migrations to the DB at DATABASE_URL
pnpm dev           # tsx watch, port 3000
```

Try the auth flow:

```bash
curl -i -c jar.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"correctbatteryhorse"}'

curl -b jar.txt http://localhost:3000/api/auth/me
```

## Schema changes

```bash
# 1. Edit src/db/schema.ts
# 2. Generate a new SQL migration
pnpm db:generate
# 3. Commit the new file under drizzle/migrations/
# 4. Apply
pnpm db:migrate
```

## Deploy to prod

The Tarrs sandbox handles deploy for you — `pnpm db:migrate` runs
inside the container at boot, the dev server starts on `:3000`,
Caddy + ALB do the rest. If you migrate off Tarrs to Fly / Render,
the same `pnpm build && node .dist/index.js` works given a real
`DATABASE_URL`.
