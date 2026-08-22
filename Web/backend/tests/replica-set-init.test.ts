import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../docker/init-replica-set.js',
);
const initializationScript = new Script(readFileSync(scriptPath, 'utf8'));

class QuitSignal extends Error {
  readonly exitCode: number;

  constructor(exitCode: number) {
    super(`mongosh exited with code ${exitCode}`);
    this.exitCode = exitCode;
  }
}

function executeScript(rs: object): number {
  try {
    initializationScript.runInNewContext({
      db: {
        hello: () => ({ isWritablePrimary: true }),
      },
      print: vi.fn(),
      quit: (exitCode: number) => {
        throw new QuitSignal(exitCode);
      },
      rs,
      sleep: vi.fn(),
      tojson: JSON.stringify,
    });
  } catch (error) {
    if (error instanceof QuitSignal) {
      return error.exitCode;
    }

    throw error;
  }

  throw new Error('The replica-set initializer did not exit.');
}

describe('MongoDB replica-set initializer', () => {
  it('initializes a fresh replica set and waits for its primary', () => {
    const initiate = vi.fn(() => ({ ok: 1 }));

    const exitCode = executeScript({
      conf: () => {
        throw Object.assign(new Error('not initialized'), {
          code: 94,
          codeName: 'NotYetInitialized',
        });
      },
      initiate,
    });

    expect(exitCode).toBe(0);
    expect(initiate).toHaveBeenCalledWith({
      _id: 'rs0',
      members: [{ _id: 0, host: 'mongodb:27017' }],
    });
  });

  it('is idempotent when the expected replica set already exists', () => {
    const initiate = vi.fn();

    const exitCode = executeScript({
      conf: () => ({
        _id: 'rs0',
        members: [{ _id: 0, host: 'mongodb:27017' }],
      }),
      initiate,
    });

    expect(exitCode).toBe(0);
    expect(initiate).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an unexpected existing configuration', () => {
    expect(() =>
      executeScript({
        conf: () => ({
          _id: 'another-set',
          members: [{ _id: 0, host: 'mongodb:27017' }],
        }),
        initiate: vi.fn(),
      }),
    ).toThrow('The existing MongoDB replica-set configuration is unexpected.');
  });
});
