import type { Logger } from 'pino';

export async function deliverBestEffort(
  logger: Logger,
  event: string,
  delivery: () => Promise<void>,
): Promise<void> {
  try {
    await delivery();
  } catch (error) {
    logger.error(
      { err: error, emailEvent: event },
      'Transactional email delivery failed after the business operation succeeded',
    );
  }
}
