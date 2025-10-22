import { ServiceItem } from '../types';

// Service items data - Updated to achieve $80/hour profit target
export const SERVICES: ServiceItem[] = [
  {
    id: 1,
    type: 'Small Furniture',
    description: 'Nightstands, side tables, and dining chairs with quick assembly.',
    startingPrice: '$85',
    priceRange: '$85-205 per item',
    includedItems: ['Unboxing', 'Full assembly', 'Leveling and stability check', 'Placement in room', 'Debris cleanup']
  },
  {
    id: 2,
    type: 'Storage & Shelving',
    description: 'Bookshelves, storage shelves, and media consoles.',
    startingPrice: '$220',
    priceRange: '$220-330 per item',
    includedItems: ['Full assembly', 'Wall securing if needed', 'Full drawer alignment', 'Cable management setup', 'Debris cleanup']
  },
  {
    id: 3,
    type: 'Tables & Desks',
    description: 'Coffee tables, console tables, and office desks.',
    startingPrice: '$185',
    priceRange: '$185-400 per item',
    includedItems: ['Assembly', 'Leveling', 'Cord pass-through setup', 'Chair placement', 'Stability testing']
  },
  {
    id: 4,
    type: 'Dressers & Storage',
    description: 'Multi-drawer dressers and large storage furniture.',
    startingPrice: '$320',
    priceRange: '$320-390 per item',
    includedItems: ['Full assembly', 'Complete drawer alignment', 'Hardware setup', 'Anti-tip installation', 'Final inspection']
  },
  {
    id: 5,
    type: 'Beds & Frames',
    description: 'Simple bed frames, beds with drawers, and specialty beds.',
    startingPrice: '$295',
    priceRange: '$295-610 per item',
    includedItems: ['Full in-room setup', 'Bed stability check', 'Screw retightening', 'Drawer alignment (if applicable)', 'Safety checks']
  }
];

// Detailed pricing breakdown for reference - Updated to achieve $80/hour profit target
export const DETAILED_PRICING = [
  { type: 'Nightstand / Side Table', startingPrice: '$160', range: '$160-205', included: 'Unbox, full assembly, and placement in room' },
  { type: 'Chair / Dining Chair (min.)', startingPrice: '$85', range: '$85-120', included: 'Leveling and stability check' },
  { type: 'Bookshelf / Storage Shelf', startingPrice: '$220', range: '$220-280', included: 'Secured to wall if needed' },
  { type: 'Coffee Table / Console Table', startingPrice: '$185', range: '$185-245', included: 'Cable hole alignment shelf setup' },
  { type: 'TV Stand / Media Console', startingPrice: '$245', range: '$245-330', included: 'Full drawer alignment' },
  { type: 'Dresser (3-6 drawers)', startingPrice: '$320', range: '$320-390', included: 'Full drawer alignment & hardware setup' },
  { type: 'Office Desk', startingPrice: '$320', range: '$320-400', included: 'Leveling, cord pass throughs, chair placement' },
  { type: 'Bed Frame (simple)', startingPrice: '$295', range: '$295-365', included: 'Full in-room setup, bed stability check, screw retightening' },
  { type: 'Bed Frame (with drawers)', startingPrice: '$365', range: '$365-485', included: 'Drawer alignment, optional mattress placement' },
  { type: 'Crib / Toddler Bed', startingPrice: '$295', range: '$485-610', included: 'Safety and fastener check' },
  { type: 'Bunk Bed / Loft Bed (local only)', startingPrice: '$485', range: '$485-610', included: 'Ladder installation, bedframe secure, stability test' },
  { type: 'Travel Fee (20+ miles)', startingPrice: '+$60', range: '$85 beyond 1-2 hrs', included: 'Applies only to complex, oversized, or damaged builds' }
];