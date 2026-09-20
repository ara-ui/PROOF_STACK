# ProofStack — Architecture & Conventions (Phase 0)

This is the Phase 0 record: what's decided, what's confirmed, what env vars
exist. Update it as later phases land — this is the "standing README" the
roadmap refers to, not a one-time snapshot.

## Repository state

Greenfield. No prior repository existed for this project as of Phase 0 — this
scaffold is the starting point. If an existing repo surfaces later, this
document should be re-run against it rather than assumed.

## Folder structure

```
proofstack/
├── docs/
│   ├── ROADMAP.md            # frozen phase plan
│   └── ARCHITECTURE.md       # this file
├── src/
│   ├── config/                # env loading, db connection, redis connection
│   ├── middleware/             # requestId, rateLimit, auth, error handler
│   ├── routes/                  # route definitions only, no logic
│   ├── controllers/          # req/res handling, calls services
│   ├── services/                # business logic, calls models
│   ├── models/                  # Mongoose schemas
│   ├── validators/            # Zod schemas
│   ├── workers/                # worker process entrypoint(s)
│   ├── queues/                  # BullMQ queue definitions
│   ├── types/                    # shared TypeScript types/interfaces
│   └── utils/
├── seed/                        # seed scripts + seed data (challenges, skills)
├── docker-compose.yml
├── .env.example
├── tsconfig.json
└── package.json
```

This matches the blueprint's layout exactly, with one addition (`src/types/`)
for shared TypeScript interfaces — no other deviation.

All source files are `.ts`. `tsx` is used for local dev (fast, no separate
compile step); `tsc` compiles to `dist/` for production. The worker and API
are two separate compiled entrypoints (`dist/server.js`, `dist/workers/*.js`),
consistent with them being deployed as two separate services.

## Infrastructure decisions (Phase 0 — locked)

| Decision | Value |
|---|---|
| Language | **TypeScript** |
| Package manager | **npm** |
| Database | MongoDB (Mongoose), `strict: 'throw'`, `autoIndex: false` in prod |
| Queue | BullMQ on Redis |
| Judge | Self-hosted Piston (Docker container), **not** the public API |
| Judge isolation | `docker-compose.yml` declares Piston on a separate `judge` network with no route to `data` (Mongo/Redis) — the config is correct, but as of Phase 1 verification only "Piston can reach the internet" was tested, not "Piston cannot reach Mongo/Redis." Still an open verification item, not a design gap. |
| API/worker | Two separate processes, two separate entrypoints, deployed as two services |
| Validation | Zod at every route boundary before any Mongo query |
| Injection guard | `mongoose.set('sanitizeFilter', true)` set globally, on by default from Phase 0 even though no user-facing filter exists yet |
| V1 scope | Phases 7 (AI analysis) and 8 (interviewer system) deferred to V2 — not implemented in this build |

## Actual dependency versions (as installed — do not downgrade)

The versions below are what's actually running, resolved from `^` ranges to
newer majors than originally scaffolded. All Phase 1 code was written
against these ranges and confirmed building/running correctly against these
exact resolved versions — no code changes were needed for the version jump.

| Package | Installed |
|---|---|
| express | 5.2.1 |
| mongoose | 9.10.1 |
| bullmq | 6.3.8 |
| ioredis | 6.0.0 |
| dotenv | 18.0.0 |
| zod | 4.6.5 |
| typescript | 5.5.4 |
| tsx | 4.16.2 |
| @types/express | 5.0.6 |
| @types/node | 20.14.10 |

Do not downgrade any of these. If a future phase's reference code uses an
older API from any of these packages, adapt the code to the installed
version — do not install a second version or roll one back.

## Environment variables (as actually needed — `.env.example` is stale)

`src/config/env.ts` reads two variables `.env.example` doesn't currently
document: `PISTON_LANGUAGE` and `PISTON_VERSION` (both have defaults —
`javascript` / `18.15.0` — so the app runs without them being set explicitly,
but the real dev `.env` has working values since Piston is confirmed serving
both Node 18.15.0 and Node 20.11.1). `.env.example` itself has not been
updated to include these two lines — noted here rather than silently fixed,
since editing `.env.example` wasn't a genuinely required Phase 2 change.

```
MONGO_URI=mongodb://localhost:27017/proofstack
REDIS_URL=redis://localhost:6379
PISTON_URL=http://localhost:2000
PISTON_LANGUAGE=javascript
PISTON_VERSION=18.15.0
PORT=4000
NODE_ENV=development
```

## Open decisions

None remaining. Language, package manager, and V1 scope (Phases 7–8 deferred)
are all locked.

## Phase 1 — verified (partial)

**Confirmed working on the actual dev machine:** Docker Compose brings up
Mongo/Redis/Piston; `npm run build` passes against the real dependency
versions above; `npm run seed` succeeds; the API starts on `:4000`; the
worker starts as a genuinely separate process; `POST /api/submissions`
returns a `QUEUED` submission; the worker claims it, calls Piston, and a
real submission reached `PASSED` (`passedCount=2, totalCount=2` against the
original 2-test-case `sum-two-numbers` seed).

**Not yet confirmed** — do not treat as done: `FAILED` on a wrong answer,
`TIMEOUT`, `ERROR` (compile/runtime), idempotency under a duplicate enqueue
or a redelivered job, the 64KB source/stdout caps actually triggering, and
the exact `202` status code (the flow succeeded but the status code wasn't
captured in the verification transcript). See `docs/ROADMAP.md`'s Phase 1
section for the itemized list.

## Phase 2 — implemented, pending verification

Expands the judge into a fuller evaluation system, per the roadmap: test
categories, three challenges spanning difficulty 1–2, and per-category
pass/fail breakdown on results. No architecture change — same worker, same
Piston call, same lifecycle from Phase 1. Written directly against the real
dependency versions above (Express 5, Mongoose 9, Zod 4, BullMQ 6) — every
file was checked against the actual installed code, not assumed.

### What changed

- **Test case categories.** Every test case now has a `category` string
  (`basic`, `edge_case`, `validation`, ...). A submission's result includes
  `categoryBreakdown: [{category, passed, total}]` alongside the existing
  flat `passedCount`/`totalCount` — this is what lets a result show
  `Basic: 8/8, Edge Cases: 4/5` instead of one number. Category is shown
  even for hidden test cases (it's structural, not an answer); actual/
  expected output is still masked for hidden ones, unchanged from Phase 1.
- **Three challenges instead of one**, spanning difficulty 1–2:
  `sum-two-numbers`, `fizzbuzz`, `max-in-array`, all `isPublished: true`.
  Still JavaScript only. Re-running `npm run seed` will **replace** the
  existing `sum-two-numbers` document's `testCases` array (2 → 3 entries,
  now with `category`) — this is expected, not data loss; the seed script's
  upsert-by-slug behavior is unchanged.
- **Refined the compile-vs-runtime heuristic** — `COMPILE_ERROR_PATTERNS` in
  `src/config/constants.ts` replaces the Phase 1 single `SyntaxError` check
  with a small pattern list. Still a heuristic, still only trusted on the
  first test case.
- **`[ADDED, not in the original Phase 2 spec]` Read-only challenge
  endpoints**: `GET /api/challenges` (published challenges, summary shape)
  and `GET /api/challenges/:slug` (detail, visible test cases only). Needed
  to demo three categorized challenges over HTTP without querying Mongo
  directly. No write endpoints, no auth-gated fields, hidden test cases
  never leave the server — enforced in `challenge.service.ts`, not just the
  controller.

### Not changed

No auth, no ownership checks, no skill evidence, no frontend, no additional
languages, no AI. `HARDCODED_USER_ID` is still in use. Phase 1's idempotency
guarantees, size caps, and lifecycle statuses are unchanged — the worker's
claim/terminal-state guards and the queue's `jobId = submissionId` dedup are
untouched code, only extended to also carry `category`/`categoryBreakdown`
through the same paths.

### Not verified yet

Same caveat as Phase 1: this was written and statically checked but not run
in this environment. Before trusting it: `npm run build`, `npm run seed`,
restart the API and worker, then `GET /api/challenges` and
`GET /api/challenges/:slug:` and confirm hidden test inputs/outputs never
appear in either response, then submit against `fizzbuzz` or `max-in-array`
and confirm `categoryBreakdown` is present and correct on the result.
