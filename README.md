# Express + Postgres API starter

A Tarrs-ready Node + Express + TypeScript backend with Sequelize on
Postgres (no Supabase). Auth is cookie-based (httpOnly JWT signed
locally), every mutation is CSRF-checked, and the layout mirrors the
[Madeinhash](https://github.com/your-org) production backend so the
sandbox AI can scaffold new endpoints by analogy.

Pair it with `nextjs-standalone` (or any frontend) by setting the
frontend's `NEXT_PUBLIC_API_URL` to this service's URL.

## What's included

- Express 4 + TypeScript (`tsx watch` in dev, compiled to `.dist` in prod)
- **Sequelize** on Postgres via `pg`, with `sequelize-cli` raw SQL-shaped migrations
- **Controller → Service → Model** layering — controllers stay thin, business logic lives in `src/service/`
- **Response envelope**: every endpoint returns `{ success, message, data, debug?, code? }` via `utility/response.ts` — frontend has one parse path
- **Structured errors**: `httpErr(msg, code, { expected?, code? })`; the `expected: true` flag downgrades known upstream 5xx to WARN logs + forwards the message to the client (raw 500s stay opaque)
- **Request observability**: `requestLogger()` tags every request with a short `requestId` via AsyncLocalStorage (any `logger.*` call inside the handler picks it up); START / END / SLOW / ERROR lines with method, path, status, duration
- **CSRF** via Origin/Referer allowlist on every `/api` mutation (safe methods pass through)
- Native `bcrypt` password hashing (cost 10)
- httpOnly cookie sessions signed with `JWT_SECRET` via `jose`
- Helmet + CORS allowlist + cookie-parser
- Per-IP rate limit on `/auth/register` + `/auth/login`
- Pino structured logging (pino-pretty in dev, JSON in prod)
- Zod input validation
- Sample `/api/posts` resource: GET list + POST create + DELETE author-only
- Author-only deletes return 404 on cross-author access (no row-existence leak)

## Layout

```
src/
  controller/         # thin HTTP handlers — parse, call service, response()
  service/            # business logic, the only layer that touches models
  model/              # Sequelize models, one file per table + index re-export
  middleware/         # auth (loadSession + requireAuth), csrf, rateLimit
  router/             # mounts everything under /api
  utility/            # response, httpStatusCode, httpErr, logger, jwt, env, password
  db/
    sequelizeConfig.ts   # runtime Sequelize instance + boot connectivity check
    config.cjs           # sequelize-cli config (CJS — CLI doesn't load TS/ESM)
migrations/           # sequelize-cli migration files (hand-written SQL via queryInterface)
```

## How Tarrs uses this

Tarrs auto-injects:

- `DATABASE_URL` — points at the local Postgres sidecar inside the sandbox
- `JWT_SECRET` — generated per-project, stored in Sandbox Secrets

Sandbox runs on port 4000 (Tarrs convention: frontend :3000, backend
:4000, Python/agent :8080). Public URL is `<project-slug>.dev.tarrs.io`;
Caddy in the sandbox routes `/api/*` straight at this container.

## Cookie + CORS recipe (frontend on a different domain)

The default `COOKIE_SAMESITE=lax` works when the frontend and API live
on the same eTLD+1 (e.g. both under `*.example.com`). For a frontend
on Vercel calling this API on `*.dev.tarrs.io`:

```
COOKIE_SAMESITE=none      # required for cross-site cookie
CORS_ORIGINS=https://your-frontend.vercel.app
CSRF_ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

`sameSite=none` automatically forces `secure=true` (browser
requirement); never serve `none` over plain http.

## Local dev

```bash
pnpm install
cp .env.example .env
# fill DATABASE_URL + JWT_SECRET
pnpm db:migrate    # apply migrations/ to the DB at DATABASE_URL
pnpm dev           # tsx watch, port 4000
```

Try the auth flow (send a real Origin header so CSRF lets the writes
through):

```bash
curl -i -c jar.txt -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"a@b.com","password":"correctbatteryhorse"}'

curl -b jar.txt http://localhost:4000/api/auth/me
```

## Schema changes

```bash
# 1. Generate an empty migration file
pnpm db:migration:new add-something-cool

# 2. Edit the new file under migrations/ — use queryInterface for portable
#    DDL or `queryInterface.sequelize.query('ALTER TABLE ...')` for raw SQL
# 3. Edit the matching Sequelize model under src/model/ so runtime stays in sync
# 4. Apply
pnpm db:migrate

# Roll back the latest:
pnpm db:migrate:undo

# See applied / pending:
pnpm db:migrate:status
```

We deliberately do **not** call `sequelize.sync()` at boot — migrations
are the only source of truth for schema. `sync()` would silently diverge
from the migration history and corrupt production.

## Adding a new resource — the 4-file recipe

1. `src/model/foo.ts` — Sequelize model + associations
2. Add `Foo` to `src/model/index.ts`
3. `src/service/foo.ts` — `listFoos`, `createFoo`, `deleteFoo` — all DB access lives here, all auth checks (`if (foo.ownerId !== actingUserId) throw httpErr(...)`)
4. `src/controller/foo.ts` — Zod-validate input, call service, call `response()`
5. Wire routes in `src/router/index.ts`
6. Author a migration under `migrations/` + run `pnpm db:migrate`

The controller never touches a model. The service never reads `req.body`.

## Deploy to prod

The Tarrs sandbox handles deploy for you — `pnpm db:migrate` runs
inside the container at boot, the dev server starts on `:4000`, Caddy
+ ALB do the rest. If you migrate off Tarrs to Fly / Render, the same
`pnpm build && node .dist/index.js` works given a real `DATABASE_URL`.
