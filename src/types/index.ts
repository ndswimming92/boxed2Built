// Type definitions for the application

export interface ServiceItem {
  id: number;
  type: string;
  description: string;
  startingPrice: string;
  priceRange?: string;
  includedItems: string[];
}

export interface TestimonialItem {
  id: number;
  name: string;
  role: string;
  content: string;
  rating: number;
}