import { ServiceItem, TestimonialItem } from '../types';

// Service items data - Updated with new pricing model
export const SERVICES: ServiceItem[] = [
  {
    id: 1,
    type: 'Small Furniture',
    description: 'Nightstands, side tables, and dining chairs with quick assembly.',
    startingPrice: '$35',
    priceRange: '$35-85 per item',
    includedItems: ['Unboxing', 'Full assembly', 'Leveling and stability check', 'Placement in room', 'Debris cleanup']
  },
  {
    id: 2,
    type: 'Storage & Shelving',
    description: 'Bookshelves, storage shelves, and media consoles.',
    startingPrice: '$90',
    priceRange: '$90-135 per item',
    includedItems: ['Full assembly', 'Wall securing if needed', 'Full drawer alignment', 'Cable management setup', 'Debris cleanup']
  },
  {
    id: 3,
    type: 'Tables & Desks',
    description: 'Coffee tables, console tables, and office desks.',
    startingPrice: '$75',
    priceRange: '$75-165 per item',
    includedItems: ['Assembly', 'Leveling', 'Cord pass-through setup', 'Chair placement', 'Stability testing']
  },
  {
    id: 4,
    type: 'Dressers & Storage',
    description: 'Multi-drawer dressers and large storage furniture.',
    startingPrice: '$130',
    priceRange: '$130-160 per item',
    includedItems: ['Full assembly', 'Complete drawer alignment', 'Hardware setup', 'Anti-tip installation', 'Final inspection']
  },
  {
    id: 5,
    type: 'Beds & Frames',
    description: 'Simple bed frames, beds with drawers, and specialty beds.',
    startingPrice: '$120',
    priceRange: '$120-250 per item',
    includedItems: ['Full in-room setup', 'Bed stability check', 'Screw retightening', 'Drawer alignment (if applicable)', 'Safety checks']
  }
];

// Testimonial data
export const TESTIMONIALS: TestimonialItem[] = [
  {
    id: 1,
    name: 'Jessica T.',
    role: 'Spring Hill Resident',
    content: 'Boxed2Built saved my weekend! I ordered a complicated entertainment center, and they had it assembled in just 2 hours. Professional, on time, and worth every penny.',
    rating: 5
  },
  {
    id: 2,
    name: 'Michael R.',
    role: 'New Homeowner',
    content: 'Moving into a new house with IKEA furniture was stressful until I called Boxed2Built. They assembled our entire bedroom set and made it look effortless. Highly recommend!',
    rating: 5
  },
  {
    id: 3,
    name: 'Sarah K.',
    role: 'Local Business Owner',
    content: 'I needed office furniture assembled quickly for my new business location. Boxed2Built delivered exceptional service, and everything was perfectly assembled and positioned.',
    rating: 5
  }
];

// Detailed pricing breakdown for reference
export const DETAILED_PRICING = [
  { type: 'Nightstand / Side Table', startingPrice: '$65', range: '$65-85', included: 'Unbox, full assembly, and placement in room' },
  { type: 'Chair / Dining Chair (min.)', startingPrice: '$35', range: '$35-50', included: 'Leveling and stability check' },
  { type: 'Bookshelf / Storage Shelf', startingPrice: '$90', range: '$90-115', included: 'Secured to wall if needed' },
  { type: 'Coffee Table / Console Table', startingPrice: '$75', range: '$75-100', included: 'Cable hole alignment shelf setup' },
  { type: 'TV Stand / Media Console', startingPrice: '$100', range: '$100-135', included: 'Full drawer alignment' },
  { type: 'Dresser (3-6 drawers)', startingPrice: '$130', range: '$130-160', included: 'Full drawer alignment & hardware setup' },
  { type: 'Office Desk', startingPrice: '$130', range: '$130-165', included: 'Leveling, cord pass throughs, chair placement' },
  { type: 'Bed Frame (simple)', startingPrice: '$120', range: '$120-150', included: 'Full in-room setup, bed stability check, screw retightening' },
  { type: 'Bed Frame (with drawers)', startingPrice: '$150', range: '$150-200', included: 'Drawer alignment, optional mattress placement' },
  { type: 'Crib / Toddler Bed', startingPrice: '$120', range: '$200-250', included: 'Safety and fastener check' },
  { type: 'Bunk Bed / Loft Bed (local only)', startingPrice: '$200', range: '$200-250', included: 'Ladder installation, bedframe secure, stability test' },
  { type: 'Travel Fee (20+ miles)', startingPrice: '+$25', range: '$35 beyond 1-2 hrs', included: 'Applies only to complex, oversized, or damaged builds' }
];