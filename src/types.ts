/** Raw shape returned by a mock supplier endpoint. */
export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

/** Deduplicated, best-priced hotel offer returned to API clients. */
export interface Hotel {
  name: string;
  price: number;
  supplier: 'Supplier A' | 'Supplier B';
  commissionPct: number;
}

export type SupplierName = 'A' | 'B';

export interface SupplierFetchResult {
  supplier: SupplierName;
  hotels: SupplierHotel[];
  error?: string;
}
