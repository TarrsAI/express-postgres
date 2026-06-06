# Architecture (locked)

When you add or change code in this repo, **follow these rules**. They
are not preferences — they are how this template is supposed to work.
Deviating is a bug.

## Stack — pinned

| Concern | Choice | Don't substitute |
|---|---|---|
| Data access | **Sequelize 6** | No Drizzle / Prisma / TypeORM / raw `pg` queries in routes. The ORM is Sequelize because it's what this template + the matching frontend templates (`nextjs-postgres`) use. Pick one stack, stick with it. |
| Authorization | **In code, in `src/service/`** | Every protected operation checks `if (resource.ownerId !== actingUserId) throw httpErr('Not found', 404)` in the service layer. The controller never does this check — it's a property of the resource, not of the HTTP transport. |
| Auth (sessions) | bcrypt + jose HS256, httpOnly cookie | Don't swap to JWT in localStorage / Authorization header. Don't switch to `jsonwebtoken` — `jose` matches our edge-runtime use cases in `nextjs-postgres`. |
| Migrations | **`sequelize-cli` migrations under `migrations/`** | No `sequelize.sync()`. Ever. Migrations are the only source of truth for schema. |
| Validation | Zod | No yup / joi / class-validator. |
| Response shape | `response(res, statusCode, message, data, debug?, code?)` from `src/utility/response.ts` | Every endpoint returns `{ success, message, data, debug?, code? }`. No bare `res.json(...)` or `res.status(...).send(...)`. |
| Errors | `httpErr(msg, statusCode, { code?, expected? })` from `src/utility/httpErr.ts` | Don't `throw new Error(...)` from service code with a hand-set `.statusCode`. Use the helper so the global error handler can do its job (log routing + envelope shaping). |
| HTTP status codes | `HTTP_STATUS_CODE` enum from `src/utility/httpStatusCode.ts` | No magic numbers (`res.status(404)`). |
| Logging | `logger` from `src/utility/logger.ts` (pino) | Don't `console.log` from service / controller code. |
| CSRF | `requireCsrf` middleware on every `/api` mutation | Don't add per-route CSRF tokens; the Origin/Referer allowlist already covers writes. |

## Folder layout — what each layer is for

```
src/
  index.ts             Express app + middleware order + error chain.
                       Nothing business-logic here.
  router/index.ts      Mounts all controllers under /api.
  controller/          Thin HTTP shell. Parse (Zod-validate via service),
                       call service, call response(). NO direct model
                       access. NO business logic. NO ownership checks.
  service/             Business logic. The ONLY layer that touches
                       models. Throws httpErr on failure. Takes plain
                       args (NOT Request / Response). Returns plain
                       objects.
  model/               Sequelize models, one file per table + index.ts
                       re-export. Associations declared here (not in a
                       separate associate() phase).
  middleware/
    auth.ts            loadSession + requireAuth (cookie -> req.user)
    csrf.ts            Origin / Referer allowlist
    rateLimit.ts       per-IP throttle factory
  utility/
    response.ts        envelope
    httpStatusCode.ts  enum
    httpErr.ts         throwable Error with statusCode + expected/code
    logger.ts          pino + requestLogger + errorLogger middlewares
    jwt.ts             jose-based sign/verify + SESSION_COOKIE_NAME
    password.ts        native bcrypt (cost 10)
    env.ts             validateEnv (boot crash on missing) + cookieDefaults
migrations/            sequelize-cli migration files (hand-written DDL
                       via queryInterface). The schema source of truth.
```

## The 6-file recipe — adding a new resource

1. `src/model/foo.ts` — Sequelize model + associations.
2. Add `Foo` to `src/model/index.ts`.
3. `src/service/foo.ts` — `listFoos`, `createFoo(input)`, `deleteFoo(id, actingUserId)`. ALL DB access lives here. ALL ownership / role checks live here.
4. `src/controller/foo.ts` — Zod-validate input, call service, call `response()`.
5. Wire routes in `src/router/index.ts`.
6. Author a migration under `migrations/` + `pnpm db:migrate`.

The controller never touches a model. The service never reads `req.body`.

## Errors — `expected: true` semantics

5xx errors come in two flavors:

**Unexpected** (a bug, a DB blow-up, an unhandled case): `throw httpErr(msg, 500)`. The handler logs at ERROR with a stack and the client sees `"Internal error"`. The raw message may contain PG error text / SQL fragments / IPs — we don't echo it.

**Expected** (a known upstream / downstream state we threw on purpose): `throw httpErr(msg, 502, { expected: true })`. The handler logs at WARN (no stack spam) and forwards the message to the client. Use this for:
- Third-party service unreachable / 502
- Customer's RDS paused
- "Project is paused" or similar known states

The errorHandler in `src/index.ts` reads the `expected` flag. The errorLogger in `src/utility/logger.ts` reads it for log-level routing. Keep the two in sync.

## What NOT to do

- ❌ Don't add Drizzle / Prisma — use Sequelize.
- ❌ Don't call a model from a controller — go through `service/`.
- ❌ Don't validate `req.body` in service code — that's the controller's job.
- ❌ Don't check `if (resource.ownerId !== userId)` in a controller — that's the service's job.
- ❌ Don't `sequelize.sync()`. Ever.
- ❌ Don't `res.status(...).json(...)` directly — wrap in `response(...)`.
- ❌ Don't `console.log` — use `logger.info(...)`.
- ❌ Don't `throw new Error('Bad')` with a hand-set statusCode — use `httpErr(...)`.

## What to do when in doubt

Read `src/controller/posts.ts` + `src/service/posts.ts` — they're the canonical example.
