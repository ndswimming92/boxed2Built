// Type definitions for the application

export interface ServiceItem {
  id: number;
  type: string;
  description: string;
  startingPrice: string;
  priceRange?: string;
  includedItems: string[];
}