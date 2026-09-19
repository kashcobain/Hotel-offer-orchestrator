import { Connection, WorkflowClient } from '@temporalio/client';
import { config } from '../config';
import { logger } from '../logger';
import { getHotelsWorkflow } from './workflows';
import { Hotel } from '../types';

let clientPromise: Promise<WorkflowClient> | null = null;

async function getClient(): Promise<WorkflowClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const connection = await Connection.connect({ address: config.temporalAddress });
      return new WorkflowClient({ connection, namespace: config.temporalNamespace });
    })().catch((err) => {
      clientPromise = null; // allow retrying on next call instead of caching a failed connection
      throw err;
    });
  }
  return clientPromise;
}

export async function runGetHotelsWorkflow(city: string): Promise<Hotel[]> {
  const client = await getClient();
  const workflowId = `get-hotels-${city}-${Date.now()}`;
  logger.info(`Starting workflow ${workflowId} on task queue "${config.temporalTaskQueue}"`);
  return client.execute(getHotelsWorkflow, {
    taskQueue: config.temporalTaskQueue,
    workflowId,
    args: [city],
  });
}
