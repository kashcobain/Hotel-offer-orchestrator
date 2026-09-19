import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';
import { cacheHotels } from '../redis/hotelCache';
import { Hotel, SupplierHotel } from '../types';

async function fetchFromSupplier(url: string, supplierLabel: string, city: string): Promise<SupplierHotel[]> {
  try {
    const response = await axios.get<SupplierHotel[]>(url, {
      params: { city },
      timeout: 5000,
    });
    logger.info(`${supplierLabel} returned ${response.data.length} hotel(s) for city=${city}`);
    return response.data;
  } catch (err: any) {
    const message = err?.response?.status
      ? `HTTP ${err.response.status} ${err.response.data?.error || ''}`.trim()
      : err?.message || 'unknown error';
    logger.error(`${supplierLabel} request failed for city=${city}: ${message}`);
    throw new Error(`${supplierLabel} unavailable: ${message}`);
  }
}

/** Activity: call Supplier A's mock endpoint for a given city. */
export async function fetchSupplierAHotels(city: string): Promise<SupplierHotel[]> {
  return fetchFromSupplier(config.supplierAUrl, 'Supplier A', city);
}

/** Activity: call Supplier B's mock endpoint for a given city. */
export async function fetchSupplierBHotels(city: string): Promise<SupplierHotel[]> {
  return fetchFromSupplier(config.supplierBUrl, 'Supplier B', city);
}

/** Activity: persist the deduplicated hotel list for a city into Redis. */
export async function cacheHotelsActivity(city: string, hotels: Hotel[]): Promise<void> {
  await cacheHotels(city, hotels);
}
