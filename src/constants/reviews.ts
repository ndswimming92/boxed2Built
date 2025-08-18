export interface Review {
  id: number;
  author: string;
  text: string;
  rating: number;
  datePublished: string;
  source: string;
}

export const REVIEWS: Review[] = [
  {
    id: 1,
    author: "Samantha H.",
    text: "Highly recommend Nicholas if you need someone reliable, trustworthy and punctual! He took care of our furniture like it was his own and completed the tasks he said he'd do! Super professional and kind! Great quality of work!",
    rating: 5,
    datePublished: "2024-12-15",
    source: "Google"
  },
  {
    id: 2,
    author: "Taylor M.",
    text: "My man, Nicholas did an amazing job!",
    rating: 5,
    datePublished: "2024-12-10",
    source: "Google"
  },
  {
    id: 3,
    author: "Jena C.",
    text: "Nicholas is an awesome person! He was so professional and kind! He did an amazing job building our blackstone grill for us! He was so quick, cleaned up after himself and made sure everything was working properly! I highly recommend hiring him to build any furniture or self-assembly products for your home!",
    rating: 5,
    datePublished: "2024-12-05",
    source: "Google"
  }
];