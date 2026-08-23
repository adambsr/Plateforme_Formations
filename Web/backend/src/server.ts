import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Workspace scripts run from Web/backend. Repository-level overrides are
// loaded first, then Web/backend/.env fills the remaining local values.
dotenv.config({
  path: [
    fileURLToPath(new URL('../../../.env', import.meta.url)),
    fileURLToPath(new URL('../.env', import.meta.url)),
  ],
  quiet: true,
});

import type { Server } from 'node:http';

import { createApp } from './app.js';
import { ConfigurationError, loadAppConfig } from './config/environment.js';
import { createLogger } from './config/logger.js';
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
} from './infrastructure/database/connection.js';
import { initializeDatabaseIndexes } from './infrastructure/database/indexes.js';

async function start(): Promise<void> {
  const config = loadAppConfig();
  const logger = createLogger(config);

  await connectDatabase(config.database.uri);
  logger.info('MongoDB connection established');
  await initializeDatabaseIndexes();
  logger.info('MongoDB indexes initialized');

  const app = createApp({ config, logger, databaseReady: isDatabaseReady });
  let server: Server;

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Graceful shutdown started');
    server.close(async (closeError) => {
      if (closeError !== undefined) {
        logger.error({ err: closeError }, 'HTTP server shutdown failed');
        process.exitCode = 1;
      }
      await disconnectDatabase();
      logger.info('Graceful shutdown completed');
    });
  };

  server = app.listen(config.application.port, () => {
    logger.info({ port: config.application.port }, 'Backend listening');
  });

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  const message =
    error instanceof ConfigurationError
      ? error.message
      : 'Backend startup failed. Check database availability and non-secret configuration.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
