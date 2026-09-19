import { redis } from './client';
import { config } from '../config';
import { logger } from '../logger';
import { Hotel } from '../types';

/**
 * Storage shape per city:
 *   hotels:{city}:index               -> sorted set, score = price, member = hotel name
 *   hotels:{city}:hotel:{hotelName}    -> JSON string of the full Hotel object
 *
 * Keeping price in a sorted set is what lets price-range filtering be done
 * *inside* Redis via ZRANGEBYSCORE instead of pulling everything out and
 * filtering in application code.
 */

function indexKey(city: string): string {
  return `hotels:${city}:index`;
}

function hotelKey(city: string, name: string): string {
  return `hotels:${city}:hotel:${name}`;
}

export async function cacheHotels(city: string, hotels: Hotel[]): Promise<void> {
  const pipeline = redis.pipeline();

  // Clear any previous snapshot for this city so stale entries don't linger.
  const existing = await redis.zrange(indexKey(city), 0, -1);
  for (const name of existing) {
    pipeline.del(hotelKey(city, name));
  }
  pipeline.del(indexKey(city));

  for (const hotel of hotels) {
    pipeline.zadd(indexKey(city), hotel.price, hotel.name);
    pipeline.set(hotelKey(city, hotel.name), JSON.stringify(hotel), 'EX', config.redisTtlSeconds);
  }
  if (hotels.length > 0) {
    pipeline.expire(indexKey(city), config.redisTtlSeconds);
  }

  await pipeline.exec();
  logger.info(`Cached ${hotels.length} hotel(s) for city=${city} in Redis (TTL ${config.redisTtlSeconds}s)`);
}

export async function getHotelsByPriceRange(
  city: string,
  minPrice?: number,
  maxPrice?: number
): Promise<Hotel[]> {
  const min = minPrice === undefined ? '-inf' : minPrice;
  const max = maxPrice === undefined ? '+inf' : maxPrice;

  // ZRANGEBYSCORE does the actual price-range filtering inside Redis.
  const names = await redis.zrangebyscore(indexKey(city), min, max);
  if (names.length === 0) return [];

  const keys = names.map((name) => hotelKey(city, name));
  const raw = await redis.mget(...keys);

  return raw
    .filter((value): value is string => value !== null)
    .map((value) => JSON.parse(value) as Hotel);
}
