// Declaration merging into Express's own Request type, so req.user is
// typed everywhere without every controller needing a custom Request type.
// Populated exclusively by src/middleware/auth.ts after verifying a JWT —
// nothing else should ever set this.
export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
