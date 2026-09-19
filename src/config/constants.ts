// Phase 1 has no authentication. This constant stands in for `req.user.id`
// everywhere a real user identity would otherwise come from a verified
// token. It is the ONLY place this value is defined — nothing else should
// hardcode the string directly. Deleted in Phase 3 when real auth lands.
export const HARDCODED_USER_ID = 'phase1-dev-user';

// Source code size cap, enforced in the Zod validator (rejects the request)
// and again at the schema level (defence in depth). 64KB per the frozen
// roadmap's Phase 1 acceptance criteria.
export const MAX_SOURCE_CODE_BYTES = 65_536;

// Judge stdout cap. Output beyond this is truncated before it's compared
// or persisted, so a submission that prints in an infinite loop can't
// exhaust worker memory or bloat the database.
export const MAX_OUTPUT_BYTES = 65_536;

// Extra time given to the HTTP call to Piston on top of the challenge's
// own timeLimitMs, so a slow-but-legitimate response isn't mistaken for a
// network-level failure. Piston's own `run_timeout` is what actually kills
// the candidate's process; this is a second, outer backstop per the
// blueprint's "external timeout as backstop" guidance.
export const PISTON_HTTP_BUFFER_MS = 5_000;
