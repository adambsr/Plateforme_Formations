import 'dotenv/config';

import pino from 'pino';

import {
  ConfigurationError,
  loadAdminSeedConfig,
} from '../config/environment.js';
import {
  connectDatabase,
  disconnectDatabase,
} from '../infrastructure/database/connection.js';
import { initializeDatabaseIndexes } from '../infrastructure/database/indexes.js';
import {
  AdminSeedConflictError,
  seedInitialAdmin,
} from '../modules/users/services/seed-initial-admin.js';

async function run(): Promise<void> {
  const config = loadAdminSeedConfig();
  const logger = pino({
    level: config.logLevel,
    base: { service: 'plateforme-formations-admin-seed' },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  await connectDatabase(config.databaseUri);
  try {
    await initializeDatabaseIndexes();
    const result = await seedInitialAdmin(config.initialAdmin);
    logger.info(
      { status: result.status, userId: result.id, email: result.email },
      result.status === 'created'
        ? 'Initial Admin created; password change is required at first login'
        : 'An Admin already exists; no changes were made',
    );
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  const message =
    error instanceof ConfigurationError ||
    error instanceof AdminSeedConflictError
      ? error.message
      : 'Initial Admin seed failed. Check database availability and non-secret configuration.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
