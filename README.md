# ProofStack

Developer skill-verification platform. Developers solve engineering challenges;
submissions are evaluated asynchronously; passing evaluations generate
skill evidence that feeds a public, auditable developer profile.

**Status:** Phase 1 verified (partial), Phase 2 verified (build/seed/API/
worker/challenge endpoints/PASSED+FAILED submissions with correct
categoryBreakdown all confirmed on the real dev machine; see
`docs/ROADMAP.md`). Phase 3 (authentication & authorization — register,
login, JWT access + refresh tokens, password reset, ownership enforcement,
rate limiting) implemented on top, **not yet run**. Built against the
actual installed dependencies (Express 5, Mongoose 9, BullMQ 6, Zod 4,
jsonwebtoken, bcryptjs — see `docs/ARCHITECTURE.md` for the full version
table and the Phase 3 security model).

- Architecture, conventions, and per-phase implementation notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Frozen phase-by-phase build plan: [`docs/ROADMAP.md`](docs/ROADMAP.md)

## Quick start

```bash
npm install
# add JWT_SECRET to your real .env — required, min 32 chars:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
docker compose up -d mongo redis piston
npm run seed
npm run build

# two terminals:
npm run dev           # API on :4000
npm run worker        # separate worker process
```

```bash
# register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "a-real-password"}'
# → { user, accessToken, refreshToken }

# authenticated submission (Authorization header now required)
curl -X POST http://localhost:4000/api/submissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken from register/login>" \
  -d '{"challengeId": "<id from GET /api/challenges>", "sourceCode": "..."}'

curl http://localhost:4000/api/submissions/<id> \
  -H "Authorization: Bearer <accessToken>"
```

`GET /api/challenges` and `GET /api/challenges/:slug` remain public and
unauthenticated, unchanged from Phase 2.

This README will grow section by section as each phase lands (architecture
diagram, submission lifecycle, "why MongoDB," failure/recovery behavior,
what was deliberately cut and why) rather than being written from scratch
at the end.
