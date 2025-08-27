import { ServiceItem } from '../types';

// Service items data - Updated with 10% price increase
export const SERVICES: ServiceItem[] = [
  {
    id: 1,
    type: 'Small Furniture',
    description: 'Nightstands, side tables, and dining chairs with quick assembly.',
    startingPrice: '$45',
    priceRange: '$45-108 per item',
    includedItems: ['Unboxing', 'Full assembly', 'Leveling and stability check', 'Placement in room', 'Debris cleanup']
  },
  {
    id: 2,
    type: 'Storage & Shelving',
    description: 'Bookshelves, storage shelves, and media consoles.',
    startingPrice: '$116',
    priceRange: '$116-172 per item',
    includedItems: ['Full assembly', 'Wall securing if needed', 'Full drawer alignment', 'Cable management setup', 'Debris cleanup']
  },
  {
    id: 3,
    type: 'Tables & Desks',
    description: 'Coffee tables, console tables, and office desks.',
    startingPrice: '$96',
    priceRange: '$96-209 per item',
    includedItems: ['Assembly', 'Leveling', 'Cord pass-through setup', 'Chair placement', 'Stability testing']
  },
  {
    id: 4,
    type: 'Dressers & Storage',
    description: 'Multi-drawer dressers and large storage furniture.',
    startingPrice: '$166',
    priceRange: '$166-204 per item',
    includedItems: ['Full assembly', 'Complete drawer alignment', 'Hardware setup', 'Anti-tip installation', 'Final inspection']
  },
  {
    id: 5,
    type: 'Beds & Frames',
    description: 'Simple bed frames, beds with drawers, and specialty beds.',
    startingPrice: '$153',
    priceRange: '$153-318 per item',
    includedItems: ['Full in-room setup', 'Bed stability check', 'Screw retightening', 'Drawer alignment (if applicable)', 'Safety checks']
  }
];

// Detailed pricing breakdown for reference - Updated with 10% increase
export const DETAILED_PRICING = [
  { type: 'Nightstand / Side Table', startingPrice: '$83', range: '$83-108', included: 'Unbox, full assembly, and placement in room' },
  { type: 'Chair / Dining Chair (min.)', startingPrice: '$45', range: '$45-64', included: 'Leveling and stability check' },
  { type: 'Bookshelf / Storage Shelf', startingPrice: '$116', range: '$116-146', included: 'Secured to wall if needed' },
  { type: 'Coffee Table / Console Table', startingPrice: '$96', range: '$96-128', included: 'Cable hole alignment shelf setup' },
  { type: 'TV Stand / Media Console', startingPrice: '$128', range: '$128-172', included: 'Full drawer alignment' },
  { type: 'Dresser (3-6 drawers)', startingPrice: '$166', range: '$166-204', included: 'Full drawer alignment & hardware setup' },
  { type: 'Office Desk', startingPrice: '$166', range: '$166-209', included: 'Leveling, cord pass throughs, chair placement' },
  { type: 'Bed Frame (simple)', startingPrice: '$153', range: '$153-191', included: 'Full in-room setup, bed stability check, screw retightening' },
  { type: 'Bed Frame (with drawers)', startingPrice: '$191', range: '$191-254', included: 'Drawer alignment, optional mattress placement' },
  { type: 'Crib / Toddler Bed', startingPrice: '$153', range: '$254-318', included: 'Safety and fastener check' },
  { type: 'Bunk Bed / Loft Bed (local only)', startingPrice: '$254', range: '$254-318', included: 'Ladder installation, bedframe secure, stability test' },
  { type: 'Travel Fee (20+ miles)', startingPrice: '+$32', range: '$45 beyond 1-2 hrs', included: 'Applies only to complex, oversized, or damaged builds' }
];