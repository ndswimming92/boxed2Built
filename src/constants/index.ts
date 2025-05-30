import { ServiceItem, TestimonialItem } from '../types';

// Service items data
export const SERVICES: ServiceItem[] = [
  {
    id: 1,
    type: 'Chairs & Stools',
    description: 'Quick assembly of dining chairs, desk chairs, bar stools, and more.',
    startingPrice: '$25',
    priceRange: '$25-45 per item',
    includedItems: ['Assembly', 'Stability testing', 'Debris cleanup']
  },
  {
    id: 2,
    type: 'Tables & Desks',
    description: 'Dining tables, coffee tables, office desks, and vanities.',
    startingPrice: '$65',
    priceRange: '$65-120 per item',
    includedItems: ['Assembly', 'Leveling', 'Stability testing', 'Debris cleanup']
  },
  {
    id: 3,
    type: 'Beds & Frames',
    description: 'Bed frames, bunk beds, daybeds, and headboards.',
    startingPrice: '$85',
    priceRange: '$85-150 per item',
    includedItems: ['Assembly', 'Placement', 'Stability testing', 'Debris cleanup']
  },
  {
    id: 4,
    type: 'Storage & Shelving',
    description: 'Bookcases, shelving units, TV stands, and cabinets.',
    startingPrice: '$75',
    priceRange: '$75-150 per item',
    includedItems: ['Assembly', 'Wall mounting (if needed)', 'Leveling', 'Debris cleanup']
  },
  {
    id: 5,
    type: 'Wardrobes & Dressers',
    description: 'Clothing storage, dressers, wardrobes, and chests.',
    startingPrice: '$95',
    priceRange: '$95-180 per item',
    includedItems: ['Assembly', 'Drawer alignment', 'Door adjustment', 'Debris cleanup']
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