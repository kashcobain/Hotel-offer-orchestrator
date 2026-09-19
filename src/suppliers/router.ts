import { Router, Request, Response } from 'express';
import { logger } from '../logger';
import { lookupHotels, supplierAData, supplierBData } from './data';

/**
 * In-memory "is this supplier down" toggle. Lets the Postman collection (and
 * anyone testing manually) simulate an outage without restarting the
 * service: POST /admin/supplier/A/toggle { "down": true }.
 */
export const supplierState = {
  A: false,
  B: false,
};

export function isSupplierDown(supplier: 'A' | 'B'): boolean {
  return supplierState[supplier];
}

function handle(store: Record<string, ReturnType<typeof lookupHotels>>, supplier: 'A' | 'B') {
  return (req: Request, res: Response) => {
    if (supplierState[supplier]) {
      logger.warn(`Supplier ${supplier} mock endpoint called while marked DOWN`);
      return res.status(503).json({ error: `Supplier ${supplier} is currently unavailable` });
    }
    const city = String(req.query.city || '').trim();
    const hotels = city ? lookupHotels(store as any, city) : [];
    return res.status(200).json(hotels);
  };
}

export const supplierARouter = Router();
supplierARouter.get('/hotels', handle(supplierAData, 'A'));

export const supplierBRouter = Router();
supplierBRouter.get('/hotels', handle(supplierBData, 'B'));

export const adminRouter = Router();
adminRouter.post('/supplier/:supplier/toggle', (req: Request, res: Response) => {
  const supplier = String(req.params.supplier || '').toUpperCase();
  if (supplier !== 'A' && supplier !== 'B') {
    return res.status(400).json({ error: 'supplier must be A or B' });
  }
  const down = Boolean(req.body?.down);
  supplierState[supplier as 'A' | 'B'] = down;
  logger.info(`Supplier ${supplier} marked ${down ? 'DOWN' : 'UP'} via admin toggle`);
  return res.json({ supplier, down });
});
