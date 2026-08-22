import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/shared/auth/password.js';

describe('password hashing', () => {
  it('creates salted scrypt hashes and verifies only the correct password', async () => {
    const password = 'a-valid-password';
    const [firstHash, secondHash] = await Promise.all([
      hashPassword(password),
      hashPassword(password),
    ]);

    expect(firstHash).toMatch(/^scrypt\$/);
    expect(firstHash).not.toContain(password);
    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', firstHash)).resolves.toBe(
      false,
    );
  });

  it('rejects malformed or unsupported hashes safely', async () => {
    await expect(
      verifyPassword('password', 'not-a-password-hash'),
    ).resolves.toBe(false);
    await expect(
      verifyPassword('password', 'scrypt$999999$8$1$c2FsdA$a2V5'),
    ).resolves.toBe(false);
  });
});
