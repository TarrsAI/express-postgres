import bcrypt from 'bcrypt';

// 10 rounds = ~80ms on modern hardware. Bumping it linearly increases
// the per-login cost; 10 is the bcrypt default and a reasonable
// throughput/security trade for an API used by humans (not an OAuth
// service hashing millions of times).
const ROUNDS = 10;

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, ROUNDS);

export const verifyPassword = (
  plain: string,
  hash: string,
): Promise<boolean> => bcrypt.compare(plain, hash);
