import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  logger.info(`Connected to Redis at ${config.redisUrl}`);
});

export async function pingRedis(): Promise<'up' | 'down'> {
  try {
    const reply = await redis.ping();
    return reply === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
}
