import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('stores an argon2id hash, never the password', async () => {
    const hash = await hashPassword('s3cret-pharmacy');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('s3cret-pharmacy');
  });

  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('s3cret-pharmacy');
    expect(await verifyPassword(hash, 's3cret-pharmacy')).toBe(true);
    expect(await verifyPassword(hash, 'S3cret-pharmacy')).toBe(false);
  });

  it('returns false instead of throwing for a broken hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});
