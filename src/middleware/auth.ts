import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service';
// No import of ../types/express here — it's a .d.ts file (no runtime JS
// emit), so a value-level `import '../types/express'` fails at runtime
// with "Cannot find module" once compiled/run by tsx or node. The
// `declare global { namespace Express { ... } }` augmentation inside that
// file applies automatically to the whole TypeScript program as long as
// the file is covered by tsconfig's `include` (it is — `src/**/*.ts`
// matches `express.d.ts`) — no import, side-effect or otherwise, is
// needed anywhere for the merge to take effect. This comment replaces the
// import that was here.

/**
 * Requires a valid `Authorization: Bearer <token>` header. On success,
 * attaches `req.user = { id, email }` from the token's verified payload —
 * never from anything client-supplied. Any failure (missing header, wrong
 * scheme, expired/invalid/wrong-algorithm token) is a 401 with a generic
 * message; the specific reason is never echoed back to the client.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    // Deliberately generic — expired vs. malformed vs. wrong signature
    // are all the same "not authenticated" to the client.
    res.status(401).json({ error: 'Unauthorized' });
  }
}
