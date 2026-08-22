import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'scrypt';
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION },
      (error, key) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [
    algorithm,
    cost,
    blockSize,
    parallelization,
    encodedSalt,
    encodedKey,
    extra,
  ] = encodedHash.split('$');

  if (
    algorithm !== ALGORITHM ||
    cost !== String(COST) ||
    blockSize !== String(BLOCK_SIZE) ||
    parallelization !== String(PARALLELIZATION) ||
    encodedSalt === undefined ||
    encodedKey === undefined ||
    extra !== undefined
  ) {
    return false;
  }

  try {
    const expectedKey = Buffer.from(encodedKey, 'base64url');
    if (expectedKey.length !== KEY_LENGTH) {
      return false;
    }
    const actualKey = await deriveKey(
      password,
      Buffer.from(encodedSalt, 'base64url'),
    );
    return timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}
