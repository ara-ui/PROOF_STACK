# ProofStack — Frozen Implementation Roadmap (v1.2)

**Status: FROZEN — fully locked, no open decisions remain.** This supersedes
the original 10-phase draft. Corrections from review are applied inline and
marked `[CORRECTED]`. Do not revert to the uncorrected version. The source of
truth for architecture is `ProofStack V1 — Final Engineering Blueprint`; this
document sequences its implementation.

Language/tooling: **TypeScript + npm.** Phases 7 (AI Code Analysis) and 8
(Interviewer/Assessment System) are **deferred to V2** — see their sections
below. Everything in this document, including that deferral, is final.

---

## PHASE 0 — Repository & Architecture Lock — **complete**

Establish conventions and infrastructure. No business logic.

**Acceptance criteria:**
- [x] Folder structure matches the blueprint's `src/` layout
- [x] `docker-compose.yml` runs Mongo, Redis, and a **self-hosted** Piston container — confirmed running on the actual dev machine
- [ ] `[CORRECTED]` Piston container has **no network route** to Mongo or Redis — the compose config declares this (separate `data`/`judge` networks), but it has only been confirmed that Piston *can* reach the internet, not that it *cannot* reach Mongo/Redis. Still open.
- [ ] `.env.example` defines every variable Phase 1 needs — currently **stale**: it's missing `PISTON_LANGUAGE`/`PISTON_VERSION`, which `src/config/env.ts` does read (with defaults). The real `.env` on the dev machine apparently has working values (Piston confirmed serving Node 18.15.0 and 20.11.1), but `.env.example` itself hasn't been updated to document them.
- [x] Package manager, JS vs TypeScript, and Mongoose strict-mode decided and documented
- [x] `sanitizeFilter: true` set globally on the Mongoose connection
- [x] Seeded challenge(s) committed as seed data — originally one challenge/two test cases; expanded in Phase 2 to three challenges

---

## PHASE 1 — Walking Skeleton / Core Evaluation Pipeline — **verified (partial)**

No authentication. Hardcoded user ID only.

```
hardcoded user → one challenge → POST /submissions → Mongo record
  → BullMQ/Redis → separate worker → self-hosted Piston
  → execute JavaScript → evaluate test cases → persist result
```

Lifecycle: `QUEUED → RUNNING → PASSED / FAILED / TIMEOUT / ERROR`, with a
separate `failureReason` field distinguishing candidate failures from
infrastructure/judge failures.

**What was actually confirmed on the real dev machine** (not assumed):
Docker Compose brought up Mongo/Redis/Piston; `npm run build` passed;
`npm run seed` succeeded; the API started on `:4000`; the worker started as
a separate process; `POST /api/submissions` returned a submission in
`QUEUED`; the worker picked up the job, called Piston, and a real
submission reached `PASSED` with `passedCount=2, totalCount=2`.

**What has NOT been confirmed** — do not treat these as done:
- [ ] `FAILED` on an intentionally wrong solution
- [ ] `TIMEOUT` on a genuinely long-running submission
- [ ] `ERROR` (compile or runtime) on broken code
- [ ] Idempotency: enqueuing the same submission twice, terminal-state guard actually observed under a duplicate/late write
- [ ] The 64KB source-code and stdout caps actually triggering
- [ ] `202` status code observed explicitly (the flow succeeded, but the exact status code wasn't captured in the verification transcript)

Do not mark the remaining Phase 1 items done without actually running them —
Phase 2 was built on top of the parts that *are* confirmed working, which is
enough to build on, but the gaps above are still real gaps.

---

## PHASE 2 — Evaluation Engine — **implemented, pending verification**

Expand the judge into a full evaluation system: visible/hidden/edge-case test
cases, test categories, expected outputs, execution errors, timeout handling,
runtime info where available, per-category pass/fail breakdown, challenge
difficulty, skill tags.

The deterministic judge remains the sole authority on correctness. AI is never
part of this phase.

Same query constraint as Phase 1 applies: no client-supplied filters yet.

**Status:** code implemented against the actual installed dependency
versions (see `docs/ARCHITECTURE.md`). Not yet run. See
`docs/ARCHITECTURE.md`'s Phase 2 section for the full list of changes,
including one documented scope addition (read-only `GET /api/challenges`
and `GET /api/challenges/:slug`) not explicit in the original phase text.

---

## PHASE 3 — Authentication & Authorization — **implemented, not yet run**

Registration, login, password hashing (bcrypt), access-token auth, refresh
tokens per the blueprint, password reset if retained, request validation,
ownership checks, NoSQL-injection protection, secret handling.

**Acceptance criteria:**
- [ ] Users can securely register/login — implemented, not yet run
- [ ] Protected routes reject unauthenticated users — implemented, not yet run
- [ ] User A cannot access User B's submissions (404, not 403) — implemented, not yet run
- [ ] Malformed auth input rejected by Zod before it reaches any query — implemented, not yet run
- [ ] `[CORRECTED]` Rate limiting on `POST /submissions` is built here (not tested-for-the-first-time in Phase 9) — this endpoint costs real judge compute and is MUST HAVE per the blueprint — implemented (Redis-backed, 10/min/user), not yet run
- [ ] `[CORRECTED]` Mass-assignment protection is explicit: no `new User(req.body)`, no `findByIdAndUpdate(id, req.body)` anywhere. Every write is constructed from named, Zod-parsed fields only — implemented, not yet run
- [ ] `email`/`password` schemas validate type and format before any Mongo query touches them; `mongoose.set('sanitizeFilter', true)` as defence in depth — implemented, not yet run
- [ ] Token/reset-token handling follows the blueprint (hashed at rest, single-use reset tokens, identical response whether or not an email exists) — implemented, not yet run. **Limitation**: no email provider exists (explicitly out of scope), so the reset token is only returned in the API response outside production, as a dev-only testing affordance — see `docs/ARCHITECTURE.md`'s Phase 3 section.

See `docs/ARCHITECTURE.md`'s Phase 3 section for the full security model
(token expiry/rotation/revocation, ownership semantics) and the complete
file-by-file change list.

---

## PHASE 4 — Evidence Engine

Convert evaluation results into persistent skill evidence.

`[CORRECTED]` Use the blueprint's formula exactly — do not re-derive a new
one here:

```
contribution   = difficulty × weight × testPassRatio × recencyFactor
recencyFactor  = 0.5 ^ (monthsSinceEarned / 12)      // 12-month half-life
skillStrength  = min(100, round(sum(contributions) × 12))
```

Levels: `0–24 Emerging · 25–54 Working · 55–79 Proficient · 80–100 Strong`.

Computed as a Mongo aggregation at read time — not stored, not cached, no
invalidation problem.

**Acceptance criteria:**
- [ ] `SkillEvidence` created per (submission, skill) on PASSED, using the compound unique index `{ submissionId: 1, skillId: 1 }`
- [ ] Score is explainable: every number traces to a specific submission, its difficulty, its skill weight, its pass ratio, and its age
- [ ] No AI input anywhere in this calculation

---

## PHASE 5 — Public Developer Profile

Verified skills, evidence, completed challenges, evaluation stats, recent
verification activity, skill history.

Each skill score must be **expandable into the contributing evidence** — the
challenges and dates behind the number. This is the single UI decision that
makes the evidence model credible rather than decorative; do not ship the
profile without it.

---

## PHASE 6 — React Frontend

Built only after Phases 1–5 work against curl/Postman. Screens: register/login,
challenge list, challenge detail, code editor (Monaco), submission status
(polling, `QUEUED → RUNNING → terminal`), evaluation result breakdown,
developer profile (with expandable evidence). Polling only — no WebSockets
without a specific reason to add them.

---

## PHASE 7 — AI Code Analysis — **DEFERRED TO V2**

Not part of V1. If revisited later: a strictly secondary, cosmetic layer only
— deterministic judge remains sole authority on correctness, AI output must
never touch `SkillEvidence`/`skillStrength`/PASSED-FAILED, and must be
rendered in a visually separate section. These constraints travel with the
idea regardless of when it's picked back up; they don't get relaxed later.

---

## PHASE 8 — Interviewer / Assessment System — **DEFERRED TO V2**

Not part of V1. Not a dependency for the developer-side pipeline (Phases
1–6), so its deferral doesn't block or change anything else in this roadmap.
Revisit only after Phases 0–6, 9, 10 are shipped and demoed.

---

## PHASE 9 — Reliability, Security & Testing

Duplicate submissions, duplicate jobs, concurrent submissions, worker crashes,
Redis failures, judge failures, timeouts, malformed input, unauthorized
access, NoSQL injection, expired tokens, uniqueness constraints under
concurrency, retry behavior, graceful shutdown.

**Acceptance criteria:**
- [ ] `[CORRECTED]` "Worker crashes" is tested by actually killing the worker process mid-submission and confirming the job is redelivered and the submission still reaches a terminal state — not reasoned about, demonstrated
- [ ] `[CORRECTED]` Piston network isolation (set as a Phase 0 acceptance item) is re-verified here, not verified for the first time
- [ ] Concurrent identical submissions produce exactly one `SkillEvidence` record (unique index doing its job under real concurrency, not just in theory)

---

## PHASE 10 — Deployment & Resume-Ready Release

Deploy: frontend → production API → MongoDB → Redis/BullMQ → worker →
self-hosted Piston, API and worker as **two separate deployed services**.

`[CORRECTED]` README sections (architecture diagram, lifecycle table, "why
MongoDB," "what I deliberately didn't build") are a **standing task updated
throughout the build**, not written from memory in Phase 10. Start the README
in Phase 0 and add to it as each phase lands, especially the reasoning behind
decisions — that reasoning is easiest to write down while you're making it.

Final deliverables: live demo, README, architecture diagram, API docs,
screenshots, testing notes, failure/recovery documentation, resume bullets,
interview talking points.

---

## Scope rules (unchanged, restated for the frozen version)

- Do not switch MongoDB to PostgreSQL without a genuinely blocking reason
- Do not build a custom sandbox — self-hosted Piston is the V1 judge
- Do not add languages beyond the single-language pipeline until it's reliable
- Do not build Phase 8 before Phase 1–5 work
- AI never overrides or feeds the deterministic judge
- Do not optimize the UI before the backend pipeline works

## How we work

One phase at a time. Per phase: inspect repo → identify files to touch →
implement only that phase → test → verify acceptance criteria → report files
changed and why → flag risks → **stop for approval** before the next phase.

---

## V1 build order (final)

Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 9 → 10. Phases 7 and 8 are V2 and do not
appear in the V1 sequence.
