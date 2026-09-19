import { SupplierHotel } from '../types';

/**
 * Static mock data for both suppliers. Names deliberately overlap between
 * Supplier A and Supplier B for some hotels (e.g. "Holtin", "Taj Mahal Hotel")
 * so the dedupe/cheapest-price logic has something meaningful to do, while
 * other hotels are exclusive to one supplier to exercise the
 * "only one supplier returned it" rule.
 */
export const supplierAData: Record<string, SupplierHotel[]> = {
  delhi: [
    { hotelId: 'a1', name: 'Holtin', price: 6000, city: 'delhi', commissionPct: 10 },
    { hotelId: 'a2', name: 'Radison', price: 5900, city: 'delhi', commissionPct: 13 },
    { hotelId: 'a3', name: 'Taj Mahal Hotel', price: 12000, city: 'delhi', commissionPct: 8 },
    { hotelId: 'a4', name: 'The Imperial', price: 15000, city: 'delhi', commissionPct: 9 },
    { hotelId: 'a5', name: 'Bloom Rooms', price: 2500, city: 'delhi', commissionPct: 15 },
  ],
  mumbai: [
    { hotelId: 'a6', name: 'Taj Mahal Palace', price: 22000, city: 'mumbai', commissionPct: 8 },
    { hotelId: 'a7', name: 'The Leela', price: 17500, city: 'mumbai', commissionPct: 10 },
    { hotelId: 'a8', name: 'Ginger Hotel', price: 3200, city: 'mumbai', commissionPct: 14 },
  ],
};

export const supplierBData: Record<string, SupplierHotel[]> = {
  delhi: [
    { hotelId: 'b1', name: 'Holtin', price: 5340, city: 'delhi', commissionPct: 20 },
    { hotelId: 'b2', name: 'Taj Mahal Hotel', price: 11800, city: 'delhi', commissionPct: 11 },
    { hotelId: 'b3', name: 'Lemon Tree', price: 4200, city: 'delhi', commissionPct: 12 },
    { hotelId: 'b4', name: 'The Oberoi', price: 18000, city: 'delhi', commissionPct: 7 },
  ],
  mumbai: [
    { hotelId: 'b5', name: 'Taj Mahal Palace', price: 21500, city: 'mumbai', commissionPct: 9 },
    { hotelId: 'b6', name: 'Trident Nariman Point', price: 16000, city: 'mumbai', commissionPct: 10 },
  ],
};

export function lookupHotels(store: Record<string, SupplierHotel[]>, city: string): SupplierHotel[] {
  const key = city.trim().toLowerCase();
  return store[key] ? store[key].slice() : [];
}
