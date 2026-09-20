# ProofStack

Developer skill-verification platform. Developers solve engineering challenges;
submissions are evaluated asynchronously; passing evaluations generate
skill evidence that feeds a public, auditable developer profile.

**Status:** Phase 1 verified (partial — happy path confirmed, failure/
idempotency cases not yet exercised; see `docs/ROADMAP.md`). Phase 2
(evaluation engine — test categories, three challenges, read-only challenge
endpoints) implemented on top, **not yet run**. Built against the actual
installed dependencies (Express 5, Mongoose 9, BullMQ 6, Zod 4 — see
`docs/ARCHITECTURE.md` for the full version table).

- Architecture, conventions, and per-phase implementation notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Frozen phase-by-phase build plan: [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Quick start

```bash
npm install
docker compose up -d mongo redis piston
npm run seed        # now loads 3 challenges — re-running is safe (idempotent)
npm run build        # typecheck + compile

# two terminals:
npm run dev           # API on :4000
npm run worker        # separate worker process
```

```bash
# list challenges (Phase 2)
curl http://localhost:4000/api/challenges

# challenge detail — visible test cases only
curl http://localhost:4000/api/challenges/fizzbuzz

# submit
curl -X POST http://localhost:4000/api/submissions \
  -H "Content-Type: application/json" \
  -d '{"challengeId": "<id from the challenges list above>", "sourceCode": "..."}'

curl http://localhost:4000/api/submissions/<id from the response above>
```

This README will grow section by section as each phase lands (architecture
diagram, submission lifecycle, "why MongoDB," failure/recovery behavior,
what was deliberately cut and why) rather than being written from scratch
at the end.
