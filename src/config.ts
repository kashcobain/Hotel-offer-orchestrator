import * as dotenv from 'dotenv';

dotenv.config();

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  port: num(process.env.PORT, 3000),

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisTtlSeconds: num(process.env.REDIS_TTL_SECONDS, 300),

  temporalAddress: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  temporalNamespace: process.env.TEMPORAL_NAMESPACE || 'default',
  temporalTaskQueue: process.env.TEMPORAL_TASK_QUEUE || 'hotel-orchestrator',

  supplierAUrl: process.env.SUPPLIER_A_URL || 'http://localhost:3000/supplierA/hotels',
  supplierBUrl: process.env.SUPPLIER_B_URL || 'http://localhost:3000/supplierB/hotels',
};
