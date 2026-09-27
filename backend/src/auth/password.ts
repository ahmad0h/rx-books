import { hash, verify } from '@node-rs/argon2';

/** argon2id with the library defaults (m=19456 KiB, t=2, p=1), as recommended by OWASP. */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Returns false for a wrong password or an unreadable hash; never throws. */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
