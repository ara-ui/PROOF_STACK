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
| Judge isolation | No network route from Piston to Mongo/Redis — enforced in `docker-compose.yml` networks |
| API/worker | Two separate processes, two separate entrypoints, deployed as two services |
| Validation | Zod at every route boundary before any Mongo query |
| Injection guard | `mongoose.set('sanitizeFilter', true)` set globally, on by default from Phase 0 even though no user-facing filter exists yet |
| V1 scope | Phases 7 (AI analysis) and 8 (interviewer system) deferred to V2 — not implemented in this build |

## Environment variables (Phase 0 / Phase 1 scope only)

Only what Phase 1 needs. `JWT_SECRET` and auth-related vars are intentionally
absent until Phase 3.

```
MONGO_URI=mongodb://localhost:27017/proofstack
REDIS_URL=redis://localhost:6379
PISTON_URL=http://localhost:2000
PORT=4000
NODE_ENV=development
```

## Open decisions

None remaining. Language, package manager, and V1 scope (Phases 7–8 deferred)
are all locked as of this Phase 0 revision.

## What Phase 0 deliberately does not include

No business logic, no models with real fields yet beyond what's needed to
prove the Docker services boot, no routes, no worker code. That's Phase 1.
