import bcrypt from 'bcryptjs';

// Cost factor 12 per the blueprint's explicit recommendation. Higher costs
// slow down both legitimate logins and brute-force attempts — 12 is a
// reasonable balance for this scale, not a value to casually bump up
// without measuring login latency first.
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
