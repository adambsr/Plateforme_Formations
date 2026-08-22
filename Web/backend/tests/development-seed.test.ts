import { describe, expect, it } from 'vitest';

import {
  DEVELOPMENT_SEED_CONFIRMATION,
  assertDevelopmentSeedTarget,
} from '../src/scripts/seed-development.js';

const validEnvironment = {
  NODE_ENV: 'development',
  CONFIRM_DEVELOPMENT_SEED: DEVELOPMENT_SEED_CONFIRMATION,
  MONGODB_URI:
    'mongodb://localhost:27017/plateforme_formations?replicaSet=rs0&directConnection=true',
};

describe('development seed target guard', () => {
  it('accepts the dedicated local development database', () => {
    expect(assertDevelopmentSeedTarget(validEnvironment)).toBe(
      validEnvironment.MONGODB_URI,
    );
  });

  it.each([
    [{ ...validEnvironment, NODE_ENV: 'production' }],
    [{ ...validEnvironment, CONFIRM_DEVELOPMENT_SEED: undefined }],
    [
      {
        ...validEnvironment,
        MONGODB_URI: 'mongodb://localhost:27017/another_db',
      },
    ],
    [
      {
        ...validEnvironment,
        MONGODB_URI:
          'mongodb+srv://user:secret@example.mongodb.net/plateforme_formations',
      },
    ],
  ])('rejects unsafe configuration %#', (environment) => {
    expect(() => assertDevelopmentSeedTarget(environment)).toThrow();
  });
});
