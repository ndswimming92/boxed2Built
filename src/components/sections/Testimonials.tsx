import React from 'react';
import { Star, Users } from 'lucide-react';
import { REVIEWS } from '../../constants/reviews';
import ReviewCard from '../ReviewCard';
import StarRating from '../ui/StarRating';

const Testimonials: React.FC = () => {
  // Calculate aggregate rating
  const totalReviews = REVIEWS.length;
  const averageRating = REVIEWS.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

  // Generate Schema.org JSON-LD for reviews
  const reviewsSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Boxed2Built",
    "review": REVIEWS.map(review => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.author
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating,
        "bestRating": 5
      },
      "reviewBody": review.text,
      "datePublished": review.datePublished,
      "publisher": {
        "@type": "Organization",
        "name": "Google"
      }
    })),
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": averageRating,
      "reviewCount": totalReviews,
      "bestRating": 5
    }
  };

  return (
    <>
      {/* Schema.org JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(reviewsSchema)
        }}
      />
      
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-4">
              <Users className="text-blue-600 mr-3" size={32} />
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                What Our Customers Say
              </h2>
            </div>
            
            <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
              Real reviews from satisfied customers in Spring Hill, TN and surrounding areas who chose 
              Boxed2Built for their furniture assembly needs.
            </p>
            
            {/* Aggregate Rating Display */}
            <div className="flex items-center justify-center mb-8">
              <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <div className="flex items-center justify-center mb-2">
                  <StarRating rating={averageRating} size={24} />
                  <span className="ml-3 text-2xl font-bold text-gray-900">
                    {averageRating.toFixed(1)}
                  </span>
                </div>
                <p className="text-gray-600">
                  Based on {totalReviews} Google {totalReviews === 1 ? 'review' : 'reviews'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Professional furniture assembly in Spring Hill, TN
                </p>
              </div>
            </div>
          </div>

          {/* Reviews Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
            {REVIEWS.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <div className="bg-blue-600 text-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold mb-4">
                Join Our Satisfied Customers
              </h3>
              <p className="text-blue-100 mb-6">
                Experience the same professional furniture assembly service that earned us these 5-star reviews. 
                Serving Spring Hill, Columbia, Franklin & surrounding Tennessee areas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="tel:+19316741196"
                  className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Call (931) 674-1196
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg transition-colors"
                >
                  Get Free Quote
                </a>
              </div>
              <p className="text-blue-200 mb-6 font-medium">
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Testimonials;