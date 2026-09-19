import { Router, Request, Response, NextFunction } from 'express';
import { runGetHotelsWorkflow } from '../temporal/client';
import { getHotelsByPriceRange } from '../redis/hotelCache';
import { logger } from '../logger';

export const hotelsRouter = Router();

function parseOptionalNumber(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isNaN(value) ? NaN : value;
}

/**
 * GET /api/hotels?city=delhi
 * GET /api/hotels?city=delhi&minPrice=3000&maxPrice=12000
 *
 * Runs the Temporal workflow to fetch, dedupe, and cache the hotel list for
 * the city, then always reads the response back out of Redis so that price
 * filtering (when minPrice/maxPrice are given) happens inside Redis via
 * ZRANGEBYSCORE rather than in application code.
 */
hotelsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const city = String(req.query.city || '').trim().toLowerCase();
    if (!city) {
      return res.status(400).json({ error: 'Query parameter "city" is required, e.g. /api/hotels?city=delhi' });
    }

    const minPrice = parseOptionalNumber(req.query.minPrice);
    const maxPrice = parseOptionalNumber(req.query.maxPrice);
    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
      return res.status(400).json({ error: 'minPrice and maxPrice must be numbers' });
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
    }

    await runGetHotelsWorkflow(city);
    const hotels = await getHotelsByPriceRange(city, minPrice, maxPrice);

    return res.json(hotels);
  } catch (err) {
    logger.error('Failed to fetch hotels:', err);
    return next(err);
  }
});
