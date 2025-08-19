import React, { useEffect } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import MediaGallery, { MediaItem } from '../components/sections/MediaGallery';
import { ChevronRight, Camera, Video, Clock, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { trackEvent } from '../utils/analytics';
import { getCalendlyUrl } from '../utils/utm';

// Sample media data - replace with your actual content
const SAMPLE_MEDIA: MediaItem[] = [
  {
    id: '1',
    type: 'video',
    src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Replace with your actual video
    title: 'IKEA Dresser Assembly Time-lapse',
    description: 'Watch our expert assemble a 6-drawer IKEA dresser in under 2 minutes of time-lapse footage.',
    thumbnail: 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=800',
    date: '2024-12-15',
    location: 'Spring Hill, TN',
    category: 'time-lapse',
    platform: 'youtube'
  },
  {
    id: '2',
    type: 'image',
    src: 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Completed Bedroom Set Assembly',
    description: 'Beautiful bedroom furniture set professionally assembled and arranged in Spring Hill home.',
    date: '2024-12-10',
    location: 'Spring Hill, TN',
    category: 'completed-work',
    alt: 'Professionally assembled bedroom furniture set in Spring Hill Tennessee home',
    width: 1260,
    height: 750
  },
  {
    id: '3',
    type: 'video',
    src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Replace with your actual video
    title: 'Office Desk Assembly Process',
    description: 'Step-by-step time-lapse of assembling a complex office desk with cable management.',
    thumbnail: 'https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=800',
    date: '2024-12-08',
    location: 'Franklin, TN',
    category: 'time-lapse',
    platform: 'youtube'
  },
  {
    id: '4',
    type: 'image',
    src: 'https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Before: Boxes of Furniture',
    description: 'Multiple boxes of IKEA furniture before our professional assembly service.',
    date: '2024-12-05',
    location: 'Columbia, TN',
    category: 'before-after',
    alt: 'Boxes of unassembled IKEA furniture before professional assembly service',
    width: 1260,
    height: 750
  },
  {
    id: '5',
    type: 'image',
    src: 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'After: Fully Assembled Living Room',
    description: 'The same furniture now professionally assembled and arranged in the living room.',
    date: '2024-12-05',
    location: 'Columbia, TN',
    category: 'before-after',
    alt: 'Professionally assembled living room furniture in Columbia Tennessee',
    width: 1260,
    height: 750
  },
  {
    id: '6',
    type: 'image',
    src: 'https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Assembly Tools and Process',
    description: 'Professional tools and organized workspace during furniture assembly process.',
    date: '2024-12-01',
    location: 'Spring Hill, TN',
    category: 'process',
    alt: 'Professional furniture assembly tools and organized workspace',
    width: 1260,
    height: 750
  }
];

const GalleryPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Gallery - Professional Furniture Assembly Work | Boxed2Built Spring Hill TN';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'View our professional furniture assembly work in Spring Hill, TN. Time-lapse videos, before/after photos, and completed IKEA, Target, Walmart furniture projects.');
    }

    // Set canonical URL for this page
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', 'https://boxed2built.com/gallery');
  }, []);

  const handleBookingClick = () => {
    trackEvent('calendly-booking-click-gallery-page');
    window.open(getCalendlyUrl('services'), '_blank');
  };

  const handlePhoneClick = () => {
    trackEvent('phone-click-gallery-page');
  };

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Page Header */}
        <section className="bg-gradient-to-br from-blue-50 to-gray-100 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <nav className="flex items-center justify-center mb-6 text-sm">
                <a href="/" className="text-blue-700 hover:text-blue-800">Home</a>
                <ChevronRight size={16} className="mx-2 text-gray-400" />
                <span className="text-gray-600">Gallery</span>
              </nav>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Our Professional Furniture Assembly Work
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                See our expert furniture assembly in action with time-lapse videos, before & after photos, 
                and completed projects throughout Spring Hill, TN and surrounding areas.
              </p>
              
              <div className="flex flex-wrap justify-center items-center gap-8 text-sm">
                <div className="flex items-center text-gray-700">
                  <Video size={18} className="text-blue-600 mr-2" />
                  <span className="font-medium">Time-lapse Videos</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <Camera size={18} className="text-green-600 mr-2" />
                  <span className="font-medium">Before & After Photos</span>
                </div>
                <div className="flex items-center text-gray-700">
                  <CheckCircle size={18} className="text-purple-600 mr-2" />
                  <span className="font-medium">Completed Projects</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Media Gallery */}
        <MediaGallery
          items={SAMPLE_MEDIA}
          title="Professional Furniture Assembly Gallery"
          description="Explore our work through time-lapse videos, detailed photos, and completed projects in Spring Hill, Columbia, Franklin, and surrounding Tennessee areas."
          className="bg-white"
        />

        {/* Call to Action */}
        <section className="py-12 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">Ready for Your Own Professional Assembly?</h2>
              <p className="text-xl text-blue-100 mb-8">
                Let us handle your furniture assembly project with the same care and expertise you see in our gallery.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <Button
                  onClick={handleBookingClick}
                  variant="white"
                  size="lg"
                  trackingLabel="book-consultation-gallery-cta"
                >
                  <Clock size={20} className="mr-2" />
                  Book Free Consultation
                </Button>
                <a
                  href="tel:+19316741196"
                  onClick={handlePhoneClick}
                  className="inline-flex items-center justify-center px-6 py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
                >
                  <CheckCircle size={20} className="mr-2" />
                  Call (931) 674-1196
                </a>
              </div>
              
              <p className="text-xs text-blue-200 font-medium">
                Serving Spring Hill, Columbia, Franklin, Thompson's Station, Brentwood & surrounding Tennessee areas
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default GalleryPage;