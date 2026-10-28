/**
 * The furniture the tile picker offers, and the single source of truth for the
 * estimate. Each `id` is a value `furniture_type` already accepts, so the
 * inquiry, the saved request, both emails and the admin filters keep working
 * unchanged. Prices and times are the estimator's long-standing figures.
 */
export type FurnitureId = 'Chair' | 'Table' | 'Bed' | 'Dresser' | 'Bookshelf' | 'IKEA' | 'Other';

export const FURNITURE: { id: FurnitureId; label: string; minutes: number; price: number; sub?: string }[] = [
  { id: 'Chair', label: 'Chairs & Seating', minutes: 60, price: 85 },
  { id: 'Table', label: 'Tables & Desks', minutes: 120, price: 185 },
  { id: 'Bed', label: 'Bed Frames', minutes: 180, price: 295 },
  { id: 'Dresser', label: 'Dressers & Storage', minutes: 210, price: 320 },
  { id: 'Bookshelf', label: 'Bookshelves & Media', minutes: 150, price: 220 },
  { id: 'IKEA', label: 'IKEA Flat-Pack', minutes: 120, price: 185 },
  { id: 'Other', label: 'Something Else', minutes: 120, price: 185, sub: 'grill, gym, patio…' },
];
