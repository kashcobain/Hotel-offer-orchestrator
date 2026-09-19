import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { config } from '../config';
import { logger } from '../logger';

async function run() {
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  try {
    const worker = await Worker.create({
      connection,
      namespace: config.temporalNamespace,
      taskQueue: config.temporalTaskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities,
    });

    logger.info(
      `Temporal worker started, polling task queue "${config.temporalTaskQueue}" ` +
        `(namespace "${config.temporalNamespace}") at ${config.temporalAddress}`
    );
    await worker.run();
  } finally {
    connection.close();
  }
}

run().catch((err) => {
  logger.error('Temporal worker failed to start:', err);
  process.exit(1);
});
