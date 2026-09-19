# ProofStack

Developer skill-verification platform. Developers solve engineering challenges;
submissions are evaluated asynchronously; passing evaluations generate
skill evidence that feeds a public, auditable developer profile.

**Status:** Phase 0 (repository & architecture lock) complete. Stack locked:
TypeScript + npm. V1 scope excludes AI code analysis and the interviewer
system (both deferred to V2). No application code yet — see `docs/ROADMAP.md`.

- Architecture and conventions: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Frozen phase-by-phase build plan: [`docs/ROADMAP.md`](docs/ROADMAP.md)

This README will grow section by section as each phase lands (architecture
diagram, submission lifecycle, "why MongoDB," failure/recovery behavior,
what was deliberately cut and why) rather than being written from scratch
at the end.
