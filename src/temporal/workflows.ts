import { proxyActivities, log } from '@temporalio/workflow';
import type * as activities from './activities';
import { Hotel, SupplierHotel } from '../types';

const { fetchSupplierAHotels, fetchSupplierBHotels, cacheHotelsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 2,
  },
});

/**
 * Deduplicate by hotel name across both supplier lists, keeping the cheaper
 * offer when a hotel appears in both, and keeping the single offer when it
 * only appears in one supplier's list.
 */
function dedupeCheapest(listA: SupplierHotel[], listB: SupplierHotel[]): Hotel[] {
  const byName = new Map<string, Hotel>();

  const consider = (hotel: SupplierHotel, supplier: 'Supplier A' | 'Supplier B') => {
    const existing = byName.get(hotel.name);
    if (!existing || hotel.price < existing.price) {
      byName.set(hotel.name, {
        name: hotel.name,
        price: hotel.price,
        supplier,
        commissionPct: hotel.commissionPct,
      });
    }
  };

  for (const hotel of listA) consider(hotel, 'Supplier A');
  for (const hotel of listB) consider(hotel, 'Supplier B');

  return Array.from(byName.values()).sort((a, b) => a.price - b.price);
}

/**
 * Orchestrates the full hotel-offer comparison for a city:
 *   1. Call Supplier A and Supplier B in parallel.
 *   2. Tolerate either supplier failing (e.g. simulated outage) and continue
 *      with whichever supplier(s) succeeded.
 *   3. Deduplicate by name, keeping the cheapest offer.
 *   4. Cache the result in Redis.
 */
export async function getHotelsWorkflow(city: string): Promise<Hotel[]> {
  log.info(`Starting hotel orchestration for city=${city}`);

  const [resultA, resultB] = await Promise.allSettled([
    fetchSupplierAHotels(city),
    fetchSupplierBHotels(city),
  ]);

  const listA = resultA.status === 'fulfilled' ? resultA.value : [];
  const listB = resultB.status === 'fulfilled' ? resultB.value : [];

  if (resultA.status === 'rejected') {
    log.warn(`Supplier A failed, continuing with Supplier B only`, { reason: String(resultA.reason) });
  }
  if (resultB.status === 'rejected') {
    log.warn(`Supplier B failed, continuing with Supplier A only`, { reason: String(resultB.reason) });
  }

  if (resultA.status === 'rejected' && resultB.status === 'rejected') {
    throw new Error('Both suppliers are unavailable');
  }

  const deduped = dedupeCheapest(listA, listB);
  log.info(`Deduped to ${deduped.length} hotel(s) for city=${city}`);

  await cacheHotelsActivity(city, deduped);

  return deduped;
}
