import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { pingRedis } from '../redis/client';

async function pingSupplier(url: string): Promise<'up' | 'down'> {
  try {
    // A harmless request with a city that yields no data still proves the
    // endpoint is reachable, without asserting anything about payload shape.
    await axios.get(url, { params: { city: '__healthcheck__' }, timeout: 3000, validateStatus: () => true }).then((r) => {
      if (r.status >= 500) throw new Error(`status ${r.status}`);
    });
    return 'up';
  } catch {
    return 'down';
  }
}

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const [supplierA, supplierB, redisStatus] = await Promise.all([
    pingSupplier(config.supplierAUrl),
    pingSupplier(config.supplierBUrl),
    pingRedis(),
  ]);

  const suppliersUp = supplierA === 'up' && supplierB === 'up';
  const anySupplierUp = supplierA === 'up' || supplierB === 'up';
  const status = suppliersUp && redisStatus === 'up' ? 'ok' : anySupplierUp ? 'degraded' : 'down';

  res.status(status === 'down' ? 503 : 200).json({
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      supplierA,
      supplierB,
      redis: redisStatus,
    },
  });
});
