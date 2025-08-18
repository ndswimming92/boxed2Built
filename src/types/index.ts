// Type definitions for the application

export interface ServiceItem {
  id: number;
  type: string;
  description: string;
  startingPrice: string;
  priceRange?: string;
  includedItems: string[];
}

export interface Review {
  id: number;
  author: string;
  text: string;
  rating: number;
  datePublished: string;
  source: string;
  googleReviewUrl?: string;
}